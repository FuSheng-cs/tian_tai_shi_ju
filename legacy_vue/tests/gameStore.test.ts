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
  trustDelta: 0,
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
  it('allows exactly ten messages even when every turn increases trust', async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockChatTurn('她哭了，但没有答应离开。', { aiState: 'crying', trustDelta: 5 })
    const store = useGameStore()
    for (let i = 0; i < 11; i++) await store.sendMessage(`陪伴 ${i}`)
    expect(LLMService.chat).toHaveBeenCalledTimes(10)
    expect(store.roundCount).toBe(0)
    expect(store.trustGainCount).toBe(10)
    expect(store.trust).toBe(15)
    expect(store.endingType).toBe('end_refusal')
    expect(store.messages.at(-1)?.content).toContain('拒绝离开天台')
  })

  it('accepts an AI safe exit when this turn reaches full trust', async () => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockChatTurn('艾哭了，和你一起离开了天台。', { aiState: 'leaving', trustDelta: 5, endingType: 'end_safe_exit' })
    const store = useGameStore()
    store.roundCount = 1
    store.trust = 10
    await store.sendMessage('我陪你一起下楼。')
    expect(store.trust).toBe(15)
    expect(store.roundCount).toBe(0)
    expect(store.endingType).toBe('end_safe_exit')
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('blocks premature safe exit and replaces the departure narrative', async () => {
    mockChatTurn('她和你离开了天台。', { aiState: 'leaving', endingType: 'end_safe_exit', trustDelta: 5 })
    const store = useGameStore()
    store.trust = 5
    await store.sendMessage('一起走吧')
    expect(store.trust).toBe(10)
    expect(store.isEnding).toBe(false)
    expect(store.lastAiStateTag).toBe('wavering')
    expect(store.messages.at(-1)?.content).toContain('停住脚步')
  })

  it('refuses on the last turn if pressure drops full trust below the requirement', async () => {
    mockChatTurn('她和你离开了天台。', { aiState: 'leaving', endingType: 'end_safe_exit', pressureDelta: 1 })
    const store = useGameStore()
    store.trust = 15
    store.roundCount = 1
    await store.sendMessage('快走')
    expect(store.trust).toBe(14)
    expect(store.endingType).toBe('end_refusal')
    expect(store.messages.at(-1)?.content).toContain('拒绝离开')
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
    store.trust = 10
    store.trustGainCount = 2
    store.trustGainMessages = ['line 1', 'line 2']
    store.lastAiStateTag = AI_STATES.wavering.type
    store.aiStateHistory = [AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type]
    store.lastEmotionTag = EMOTIONS.soft.type
    store.emotionHistory = [EMOTIONS.soft.type]
    store.endingSummary = {
      roundsUsed: 2,
      trustGainCount: 2,
      turningLine: 'line 2',
      comment: 'she heard it'
    }

    store.resetGame()

    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount)
    expect(store.messages.length).toBe(1)
    expect(store.waitingText).toBe('')
    expect(store.trust).toBe(0)
    expect(store.trustGainCount).toBe(0)
    expect(store.trustGainMessages).toEqual([])
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
      trust: 20,
      trustGainCount: 3,
      trustGainMessages: ['turning line'],
      lastAiStateTag: AI_STATES.wavering.type,
      aiStateHistory: [AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type],
      lastEmotionTag: EMOTIONS.soft.type,
      emotionHistory: [EMOTIONS.sting.type, EMOTIONS.soft.type],
      messages: [{ role: 'user', content: 'hello' }],
      isEnding: true,
      endingType: ENDINGS.safeExit.type,
      endingSummary: {
        roundsUsed: 1,
        trustGainCount: 3,
        turningLine: 'hello',
        comment: 'summary'
      }
    })

    expect(store.roundCount).toBe(4)
    expect(store.hintCount).toBe(2)
    expect(store.trust).toBe(15)
    expect(store.trustGainCount).toBe(3)
    expect(store.trustGainMessages).toEqual(['turning line'])
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
    expect(store.trust).toBe(0)
    expect(store.lastEmotionTag).toBeNull()
    expect(store.messages[store.messages.length - 1]).toEqual({
      role: 'assistant',
      content: 'normal reply'
    })
  })

  it.each([
    [1, GAME_RULES.initialRoundCount - 1],
    [2, GAME_RULES.initialRoundCount - 1]
  ] as const)('spends only one chance when pressure_delta is %i', async (pressureDelta, expectedRounds) => {
    mockChatTurn('hurt reply', {
      emotion: EMOTIONS.sting.type,
      aiState: AI_STATES.wavering.type,
      pressureDelta
    })
    const store = useGameStore()

    await store.sendMessage('hurtful line')

    expect(store.roundCount).toBe(expectedRounds)
    expect(store.lastEmotionTag).toBe(EMOTIONS.sting.type)
    expect(store.lastAiStateTag).toBe(AI_STATES.wavering.type)
  })

  it('applies trust changes without refunding chances', async () => {
    mockChatTurn('soft reply', {
      emotion: EMOTIONS.soft.type,
      aiState: AI_STATES.watching.type,
      pressureDelta: 2,
      trustDelta: 5
    })
    const store = useGameStore()

    await store.sendMessage('a clumsy but specific line')

    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount - 1)
    expect(store.trust).toBe(GAME_RULES.trustBoostValue)
    expect(store.trustGainCount).toBe(1)
    expect(store.trustGainMessages).toEqual(['a clumsy but specific line'])
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

  it('uses structured ending before local fallback when trust is full', async () => {
    mockChatTurn('she leaves the roof', {
      emotion: EMOTIONS.sting.type,
      endingType: ENDINGS.safeExit.type
    })
    const store = useGameStore()

    store.trust = 15
    await store.sendMessage('bad line')

    expect(store.isEnding).toBe(true)
    expect(store.endingType).toBe(ENDINGS.safeExit.type)
    expect(store.lastEmotionTag).toBe(EMOTIONS.sting.type)
    expect(store.messages[store.messages.length - 1]?.content).toBe('she leaves the roof')
  })

  it('falls back to refusal when chances run out without a structured ending', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue(createTurn('plain reply'))
    const store = useGameStore()

    for (let i = 0; i < GAME_RULES.initialRoundCount; i += 1) {
      await store.sendMessage(`ordinary comfort ${i + 1}`)
    }

    expect(store.roundCount).toBe(0)
    expect(store.isEnding).toBe(true)
    expect(store.endingType).toBe(ENDINGS.refusal.type)
  })

  it('does not infer safe exit from exchanging contact details', async () => {
    const acquaintanceReply = '她把手机递过来：存个艾。明天九点，别迟到。'
    vi.mocked(LLMService.chat).mockResolvedValue(createTurn(acquaintanceReply))
    const store = useGameStore()

    for (let i = 0; i < GAME_RULES.initialRoundCount; i += 1) {
      await store.sendMessage(`ordinary line ${i + 1}`)
    }

    expect(store.isEnding).toBe(true)
    expect(store.endingType).toBe(ENDINGS.refusal.type)
    expect(store.trust).toBe(0)
    expect(store.trustGainCount).toBe(0)
  })

  it('uses the last player line as the refusal turning line', async () => {
    const store = useGameStore()
    store.messages.push(
      { role: 'user', content: '随便你怎么想，我都会一直陪着你' },
      { role: 'assistant', content: '……' },
      { role: 'user', content: '今晚风很冷，先下去喝口热水好吗' }
    )
    store.isEnding = true
    store.endingType = ENDINGS.refusal.type

    const summary = await store.generateEndingSummary()

    expect(summary?.turningLine).toBe('今晚风很冷，先下去喝口热水好吗')
  })

  it('discards ending summary results that resolve after resetGame', async () => {
    let resolveSummary: (value: { turningLine: string; comment: string }) => void = () => {}
    vi.mocked(LLMService.getEndingSummary).mockImplementation(
      () => new Promise((resolve) => { resolveSummary = resolve })
    )
    const store = useGameStore()
    store.messages.push({ role: 'user', content: 'last line of the old run' })
    store.isEnding = true
    store.endingType = ENDINGS.safeExit.type

    const pending = store.generateEndingSummary()
    store.resetGame()
    resolveSummary({ turningLine: 'stale line', comment: 'stale comment' })

    expect(await pending).toBeNull()
    expect(store.endingSummary).toBeNull()
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
