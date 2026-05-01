import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { AI_STATES, EMOTIONS, ENDINGS, GAME_RULES, MECHANIC_TAGS } from '../src/domain/gameContract'
import { useGameStore } from '../src/store/gameStore'
import { LLMService } from '../src/modules/LLMService'

vi.mock('../src/modules/LLMService', () => ({
  LLMService: {
    chat: vi.fn(),
    getHint: vi.fn(),
    getEndingSummary: vi.fn()
  }
}))

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
  })

  it('resetGame restores default state', () => {
    const store = useGameStore()
    store.roundCount = 5
    store.waitingText = 'waiting'
    store.affectionBoostCount = 2
    store.affectionBoostMessages = ['第一句', '第二句']
    store.lastAiStateTag = AI_STATES.wavering.type
    store.aiStateHistory = [AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type]
    store.endingSummary = {
      roundsUsed: 2,
      affectionBoostCount: 2,
      turningLine: '第二句',
      comment: '她听见了你。'
    }
    store.resetGame()
    
    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount)
    expect(store.messages.length).toBe(1)
    expect(store.waitingText).toBe('')
    expect(store.affectionBoostCount).toBe(0)
    expect(store.affectionBoostMessages).toEqual([])
    expect(store.lastAiStateTag).toBe(AI_STATES.guarded.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type])
    expect(store.lastEmotionTag).toBeNull()
    expect(store.emotionHistory).toEqual([])
    expect(store.endingSummary).toBeNull()
  })

  it('loadState restores only stable state', () => {
    const store = useGameStore()
    store.isWaiting = true
    store.waitingText = 'waiting'

    store.loadState({
      roundCount: 4,
      hintCount: 2,
      affection: 20,
      affectionBoostCount: 3,
      affectionBoostMessages: ['一句话'],
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
        comment: '她记住了这一句。'
      }
    })

    expect(store.roundCount).toBe(4)
    expect(store.hintCount).toBe(2)
    expect(store.affection).toBe(20)
    expect(store.affectionBoostCount).toBe(3)
    expect(store.affectionBoostMessages).toEqual(['一句话'])
    expect(store.lastAiStateTag).toBe(AI_STATES.wavering.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type])
    expect(store.lastEmotionTag).toBe(EMOTIONS.soft.type)
    expect(store.emotionHistory).toEqual([EMOTIONS.sting.type, EMOTIONS.soft.type])
    expect(store.isWaiting).toBe(false)
    expect(store.waitingText).toBe('')
    expect(store.endingSummary?.turningLine).toBe('hello')
  })

  it('loadState derives boost count for old saves', () => {
    const store = useGameStore()

    store.loadState({
      roundCount: 4,
      hintCount: 2,
      affection: 15,
      messages: [{ role: 'user', content: 'hello' }],
      isEnding: false,
      endingType: null
    })

    expect(store.affectionBoostCount).toBe(3)
    expect(store.affectionBoostMessages).toEqual([])
    expect(store.lastAiStateTag).toBe(AI_STATES.wavering.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.wavering.type])
    expect(store.lastEmotionTag).toBeNull()
    expect(store.emotionHistory).toEqual([])
    expect(store.endingSummary).toBeNull()
  })

  it('records affection boost count and turning candidate messages', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue(`${MECHANIC_TAGS.affectionBoost}她低头笑了一下。`)
    const store = useGameStore()

    await store.sendMessage('我愿意先听你说。')

    expect(store.affection).toBe(5)
    expect(store.affectionBoostCount).toBe(1)
    expect(store.affectionBoostMessages).toEqual(['我愿意先听你说。'])
    expect(store.messages[store.messages.length - 1]).toEqual({
      role: 'assistant',
      content: '她低头笑了一下。'
    })
  })

  it('parses ending tags from the shared ending contract', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue(`她把烟按灭了。\n${ENDINGS.acquaintance.tag}`)
    const store = useGameStore()

    await store.sendMessage('我会坐在这里，等你想说的时候。')

    expect(store.isEnding).toBe(true)
    expect(store.endingType).toBe(ENDINGS.acquaintance.type)
    expect(store.messages[store.messages.length - 1]?.content).toBe('她把烟按灭了。')
  })

  it('parses emotion tags as visual state without changing affection', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue(`${EMOTIONS.curiosity.tag}你问这个干什么？`)
    const store = useGameStore()

    await store.sendMessage('你拍照的时候，是在看别人，还是在躲自己？')

    expect(store.affection).toBe(0)
    expect(store.affectionBoostCount).toBe(0)
    expect(store.lastEmotionTag).toBe(EMOTIONS.curiosity.type)
    expect(store.emotionHistory).toEqual([EMOTIONS.curiosity.type])
    expect(store.messages[store.messages.length - 1]?.content).toBe('你问这个干什么？')
  })

  it('parses AI state tags as persistent CG baseline', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue(`${AI_STATES.watching.tag}……你倒是挺会问。`)
    const store = useGameStore()

    await store.sendMessage('我可以先坐一会儿，不急着劝你。')

    expect(store.lastAiStateTag).toBe(AI_STATES.watching.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type, AI_STATES.watching.type])
    expect(store.lastEmotionTag).toBeNull()
    expect(store.messages[store.messages.length - 1]?.content).toBe('……你倒是挺会问。')
  })

  it('keeps emotion tags as one-reply visual feedback', async () => {
    const store = useGameStore()
    vi.mocked(LLMService.chat).mockResolvedValueOnce(`${EMOTIONS.curiosity.tag}你为什么问这个？`)
    await store.sendMessage('你拍别人时，是不是也在躲自己？')
    expect(store.lastEmotionTag).toBe(EMOTIONS.curiosity.type)

    vi.mocked(LLMService.chat).mockResolvedValueOnce('……没什么。')
    await store.sendMessage('我可以不追问。')
    expect(store.lastEmotionTag).toBeNull()
  })

  it('parses emotion and affection tags in the same reply', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue(`${EMOTIONS.soft.tag}${MECHANIC_TAGS.affectionBoost}……你这句话，还挺烦人的。`)
    const store = useGameStore()

    await store.sendMessage('我不急着拉你下来，我只是想先听完。')

    expect(store.affection).toBe(GAME_RULES.affectionBoostValue)
    expect(store.affectionBoostCount).toBe(1)
    expect(store.lastEmotionTag).toBe(EMOTIONS.soft.type)
    expect(store.emotionHistory).toEqual([EMOTIONS.soft.type])
    expect(store.messages[store.messages.length - 1]?.content).toBe('……你这句话，还挺烦人的。')
  })

  it('falls back to death when rounds run out below rescue thresholds', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue('她没有接这句话。')
    const store = useGameStore()

    for (let i = 0; i < GAME_RULES.initialRoundCount; i += 1) {
      await store.sendMessage(`ordinary comfort ${i + 1}`)
    }

    expect(store.roundCount).toBe(0)
    expect(store.isEnding).toBe(true)
    expect(store.endingType).toBe(ENDINGS.death.type)
  })

  it('keeps ending state as the visual priority when emotion and ending tags both appear', async () => {
    vi.mocked(LLMService.chat).mockResolvedValue(`${EMOTIONS.sting.tag}她沉默了很久。\n${ENDINGS.disappear.tag}`)
    const store = useGameStore()

    await store.sendMessage('我只是路过。')

    expect(store.isEnding).toBe(true)
    expect(store.endingType).toBe(ENDINGS.disappear.type)
    expect(store.lastEmotionTag).toBe(EMOTIONS.sting.type)
    expect(store.messages[store.messages.length - 1]?.content).toBe('她沉默了很久。')
  })
})
