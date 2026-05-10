import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AI_STATES, EMOTIONS, ENDINGS, GAME_RULES } from '../src/domain/gameContract'
import type { ChatTurnResult, TurnEvaluation } from '../src/domain/gameState'
import { LLMService } from '../src/modules/LLMService'
import { useGameStore } from '../src/store/gameStore'

vi.mock('../src/modules/LLMService', () => ({
  LLMService: {
    chat: vi.fn(),
    getHint: vi.fn(),
    getEndingSummary: vi.fn()
  }
}))

const createEvaluation = (partial: Partial<TurnEvaluation> = {}): TurnEvaluation => ({
  emotion: 'normal',
  aiState: AI_STATES.guarded.type,
  affectionDelta: 0,
  pressureDelta: 0,
  endingType: null,
  confidence: 1,
  ...partial
})

const createTurn = (reply = 'reply', evaluation: Partial<TurnEvaluation> = {}): ChatTurnResult => ({
  reply,
  evaluation: createEvaluation(evaluation)
})

const mockChatTurn = (reply = 'reply', evaluation: Partial<TurnEvaluation> = {}) => {
  vi.mocked(LLMService.chat).mockResolvedValue(createTurn(reply, evaluation))
}

describe('Game Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with correct default state', () => {
    const store = useGameStore()

    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount)
    expect(store.messages.length).toBe(1)
    expect(store.isWaiting).toBe(false)
    expect(store.lastAiStateTag).toBe(AI_STATES.guarded.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type])
    expect(store.lastEmotionTag).toBeNull()
  })

  it('resetGame restores default state', () => {
    const store = useGameStore()
    store.roundCount = 5
    store.waitingText = 'waiting'
    store.affection = 10
    store.affectionBoostCount = 2
    store.affectionBoostMessages = ['line 1', 'line 2']
    store.lastAiStateTag = AI_STATES.wavering.type
    store.aiStateHistory = [AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type]
    store.lastEmotionTag = EMOTIONS.soft.type
    store.emotionHistory = [EMOTIONS.soft.type]
    store.endingSummary = {
      roundsUsed: 2,
      affectionBoostCount: 2,
      turningLine: 'line 2',
      comment: 'she heard it'
    }

    store.resetGame()

    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount)
    expect(store.messages.length).toBe(1)
    expect(store.waitingText).toBe('')
    expect(store.affection).toBe(0)
    expect(store.affectionBoostCount).toBe(0)
    expect(store.affectionBoostMessages).toEqual([])
    expect(store.lastAiStateTag).toBe(AI_STATES.guarded.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type])
    expect(store.lastEmotionTag).toBeNull()
    expect(store.emotionHistory).toEqual([])
    expect(store.endingSummary).toBeNull()
  })

  it('loadState restores stable visual and progress state', () => {
    const store = useGameStore()
    store.isWaiting = true
    store.waitingText = 'waiting'

    store.loadState({
      roundCount: 4,
      hintCount: 2,
      affection: 20,
      affectionBoostCount: 3,
      affectionBoostMessages: ['turning line'],
      lastAiStateTag: AI_STATES.wavering.type,
      aiStateHistory: [AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type],
      lastEmotionTag: EMOTIONS.soft.type,
      emotionHistory: [EMOTIONS.sting.type, EMOTIONS.soft.type],
      messages: [{ role: 'user', content: 'hello' }],
      isEnding: true,
      endingType: ENDINGS.acquaintance.type,
      endingSummary: {
        roundsUsed: 1,
        affectionBoostCount: 3,
        turningLine: 'hello',
        comment: 'summary'
      }
    })

    expect(store.roundCount).toBe(4)
    expect(store.hintCount).toBe(2)
    expect(store.affection).toBe(20)
    expect(store.affectionBoostCount).toBe(3)
    expect(store.affectionBoostMessages).toEqual(['turning line'])
    expect(store.lastAiStateTag).toBe(AI_STATES.wavering.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type])
    expect(store.lastEmotionTag).toBe(EMOTIONS.soft.type)
    expect(store.emotionHistory).toEqual([EMOTIONS.sting.type, EMOTIONS.soft.type])
    expect(store.isWaiting).toBe(false)
    expect(store.waitingText).toBe('')
    expect(store.endingSummary?.turningLine).toBe('hello')
  })

  it('normal replies only spend the base chance and clear emotion CG', async () => {
    mockChatTurn('normal reply')
    const store = useGameStore()
    store.lastEmotionTag = EMOTIONS.soft.type

    await store.sendMessage('ordinary line')

    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount - 1)
    expect(store.affection).toBe(0)
    expect(store.lastEmotionTag).toBeNull()
    expect(store.messages[store.messages.length - 1]).toEqual({
      role: 'assistant',
      content: 'normal reply'
    })
  })

  it.each([
    [1, GAME_RULES.initialRoundCount - 2],
    [2, GAME_RULES.initialRoundCount - 3]
  ] as const)('spends extra chances when pressure_delta is %i', async (pressureDelta, expectedRounds) => {
    mockChatTurn('hurt reply', {
      emotion: EMOTIONS.sting.type,
      aiState: AI_STATES.edge.type,
      pressureDelta
    })
    const store = useGameStore()

    await store.sendMessage('hurtful line')

    expect(store.roundCount).toBe(expectedRounds)
    expect(store.lastEmotionTag).toBe(EMOTIONS.sting.type)
    expect(store.lastAiStateTag).toBe(AI_STATES.edge.type)
  })

  it('applies base, pressure, and affection refund in the same turn', async () => {
    mockChatTurn('soft reply', {
      emotion: EMOTIONS.soft.type,
      aiState: AI_STATES.watching.type,
      pressureDelta: 2,
      affectionDelta: 5
    })
    const store = useGameStore()

    await store.sendMessage('a clumsy but specific line')

    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount - 2)
    expect(store.affection).toBe(GAME_RULES.affectionBoostValue)
    expect(store.affectionBoostCount).toBe(1)
    expect(store.affectionBoostMessages).toEqual(['a clumsy but specific line'])
    expect(store.lastEmotionTag).toBe(EMOTIONS.soft.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type, AI_STATES.watching.type])
  })

  it.each([
    EMOTIONS.sting.type,
    EMOTIONS.surprise.type,
    EMOTIONS.soft.type,
    EMOTIONS.curiosity.type
  ])('triggers %s emotion CG from structured evaluation', async (emotion) => {
    mockChatTurn('emotion reply', { emotion })
    const store = useGameStore()

    await store.sendMessage('line')

    expect(store.lastEmotionTag).toBe(emotion)
    expect(store.emotionHistory).toEqual([emotion])
  })

  it('stores AI state changes without duplicating consecutive identical states', async () => {
    const store = useGameStore()
    vi.mocked(LLMService.chat)
      .mockResolvedValueOnce(createTurn('watching', { aiState: AI_STATES.watching.type }))
      .mockResolvedValueOnce(createTurn('watching again', { aiState: AI_STATES.watching.type }))

    await store.sendMessage('first line')
    await store.sendMessage('second line')

    expect(store.lastAiStateTag).toBe(AI_STATES.watching.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type, AI_STATES.watching.type])
  })

  it('uses structured ending before local fallback', async () => {
    mockChatTurn('she leaves the roof', {
      emotion: EMOTIONS.sting.type,
      endingType: ENDINGS.disappear.type
    })
    const store = useGameStore()

    await store.sendMessage('bad line')

    expect(store.isEnding).toBe(true)
    expect(store.endingType).toBe(ENDINGS.disappear.type)
    expect(store.lastEmotionTag).toBe(EMOTIONS.sting.type)
    expect(store.messages[store.messages.length - 1]?.content).toBe('she leaves the roof')
  })

  it('falls back to death when chances run out without a structured ending', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue(createTurn('plain reply'))
    const store = useGameStore()

    for (let i = 0; i < GAME_RULES.initialRoundCount; i += 1) {
      await store.sendMessage(`ordinary comfort ${i + 1}`)
    }

    expect(store.roundCount).toBe(0)
    expect(store.isEnding).toBe(true)
    expect(store.endingType).toBe(ENDINGS.death.type)
  })

  it('keeps conservative fallback behavior when chat has no evaluation payload', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue({
      reply: 'fallback reply',
      evaluation: createEvaluation()
    })
    const store = useGameStore()

    await store.sendMessage('line')

    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount - 1)
    expect(store.lastEmotionTag).toBeNull()
    expect(store.isEnding).toBe(false)
  })
})
