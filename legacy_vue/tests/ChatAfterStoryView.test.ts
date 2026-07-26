import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT_AFTER_SLOT_QUERY_KEY, ENDINGS, GAME_RULES } from '../src/domain/gameContract'
import { useGameStore } from '../src/store/gameStore'
import ChatAfterStoryView from '../src/views/ChatAfterStoryView.vue'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  route: { query: {} as Record<string, string> },
  playSfx: vi.fn(),
  chatAfterStory: vi.fn(),
  getSlots: vi.fn(() => []),
  saveChatAfter: vi.fn(() => true),
  loadChatAfter: vi.fn(() => null),
  evaluateSaveSlots: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRoute: () => mocks.route,
  useRouter: () => ({ push: mocks.push, replace: mocks.replace })
}))

vi.mock('../src/modules/AudioManager', () => ({
  audioManager: {
    playSfx: mocks.playSfx
  }
}))

vi.mock('../src/modules/LLMService', () => ({
  LLMService: {
    chatAfterStory: mocks.chatAfterStory
  }
}))

vi.mock('../src/modules/SaveSystem', () => ({
  SAVE_SLOT_KINDS: {
    game: 'game',
    chatAfter: 'chatAfter'
  },
  SaveSystem: {
    getSlots: mocks.getSlots,
    saveChatAfter: mocks.saveChatAfter,
    loadChatAfter: mocks.loadChatAfter
  }
}))

vi.mock('../src/modules/AchievementTracker', () => ({
  AchievementTracker: {
    evaluateSaveSlots: mocks.evaluateSaveSlots
  }
}))

describe('ChatAfterStoryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    mocks.push.mockClear()
    mocks.replace.mockClear()
    mocks.route.query = {}
    mocks.playSfx.mockClear()
    mocks.chatAfterStory.mockReset()
    mocks.chatAfterStory.mockResolvedValue('还没，便利店门口风也挺大。')
    mocks.getSlots.mockReset()
    mocks.getSlots.mockReturnValue([])
    mocks.saveChatAfter.mockReset()
    mocks.saveChatAfter.mockReturnValue(true)
    mocks.loadChatAfter.mockReset()
    mocks.loadChatAfter.mockReturnValue(null)
    mocks.evaluateSaveSlots.mockClear()
    vi.stubGlobal('alert', vi.fn())
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('continues from the resolved true ending in opening messages and backend context', async () => {
    const store = useGameStore()
    store.endingType = ENDINGS.acquaintance.type
    store.affection = 26
    store.affectionBoostCount = 5
    store.roundCount = GAME_RULES.initialRoundCount - 9
    store.endingSummary = {
      roundsUsed: 9,
      affectionBoostCount: 5,
      turningLine: '我先不急着拉你下来，我在这儿陪你待一会儿。',
      comment: '她愿意把明天也留一点给你。'
    }
    store.messages = [
      { role: 'user', content: '我先不急着拉你下来，我在这儿陪你待一会儿。' },
      { role: 'assistant', content: '她把手机递过来：存个艾就行。' }
    ]

    const wrapper = mount(ChatAfterStoryView)

    expect(wrapper.text()).toContain('我到楼下了')
    expect(wrapper.text()).toContain('你刚才说的「我先不急着拉你下来，我在这儿陪你待一会儿。」')

    await wrapper.find('textarea').setValue('到家了吗？')
    await wrapper.find('textarea').trigger('keydown.enter')
    await flushPromises()

    expect(mocks.chatAfterStory).toHaveBeenCalledWith(
      '到家了吗？',
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', content: expect.stringContaining('我到楼下了') }),
        expect.objectContaining({ role: 'assistant', content: expect.stringContaining('你刚才说的') })
      ]),
      expect.objectContaining({
        endingType: ENDINGS.acquaintance.type,
        turningLine: '我先不急着拉你下来，我在这儿陪你待一会儿。',
        endingReply: '她把手机递过来：存个艾就行。',
        roundsUsed: 9,
        affectionBoostCount: 5,
        affection: 26
      })
    )
    expect(wrapper.text()).toContain('还没，便利店门口风也挺大。')
  })

  it('saves the after-story chat into a selected save slot', async () => {
    const store = useGameStore()
    store.endingType = ENDINGS.acquaintance.type
    store.affection = 26
    store.affectionBoostCount = 5
    store.roundCount = GAME_RULES.initialRoundCount - 9
    store.endingSummary = {
      roundsUsed: 9,
      affectionBoostCount: 5,
      turningLine: '我先不急着拉你下来，我在这儿陪你待一会儿。',
      comment: '她愿意把明天也留一点给你。'
    }
    store.messages = [
      { role: 'user', content: '我先不急着拉你下来，我在这儿陪你待一会儿。' },
      { role: 'assistant', content: '她把手机递过来：存个艾就行。' }
    ]
    mocks.getSlots.mockReturnValue([{ id: 2, timestamp: 1710000000000, data: 'slot', kind: 'game' }])
    const wrapper = mount(ChatAfterStoryView)

    await wrapper.find('[data-test="chat-after-save"]').trigger('click')
    await wrapper.findAll('[data-test="chat-after-save-slot"]')[1].trigger('click')

    expect(mocks.saveChatAfter).toHaveBeenCalledWith(2, {
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', content: expect.stringContaining('我到楼下了') })
      ]),
      afterStoryContext: expect.objectContaining({
        endingType: ENDINGS.acquaintance.type,
        turningLine: '我先不急着拉你下来，我在这儿陪你待一会儿。',
        endingReply: '她把手机递过来：存个艾就行。'
      })
    })
    expect(mocks.replace).toHaveBeenCalledWith({ query: { [CHAT_AFTER_SLOT_QUERY_KEY]: 2 } })
    expect(mocks.evaluateSaveSlots).toHaveBeenCalledWith([
      { id: 2, timestamp: 1710000000000, data: 'slot', kind: 'game' }
    ])
  })

  it('counts used turns from user messages when the ending summary is not ready', async () => {
    const store = useGameStore()
    store.endingType = ENDINGS.acquaintance.type
    store.affection = 25
    store.affectionBoostCount = 5
    store.roundCount = 7
    store.endingSummary = null
    store.messages = [
      ...Array.from({ length: 8 }, (_, index) => ({
        role: 'user' as const,
        content: `第 ${index + 1} 句`
      })),
      { role: 'assistant' as const, content: '她把手机递过来。' }
    ]

    const wrapper = mount(ChatAfterStoryView)

    await wrapper.find('textarea').setValue('到家了吗？')
    await wrapper.find('textarea').trigger('keydown.enter')
    await flushPromises()

    expect(mocks.chatAfterStory).toHaveBeenCalledWith(
      '到家了吗？',
      expect.anything(),
      expect.objectContaining({ roundsUsed: 8 })
    )
  })

  it('restores an after-story save without rebuilding the opening messages', () => {
    mocks.route.query = { [CHAT_AFTER_SLOT_QUERY_KEY]: '3' }
    mocks.loadChatAfter.mockReturnValue({
      messages: [
        { role: 'assistant', content: '这是保存过的聊天。' },
        { role: 'user', content: '我回来了。' }
      ],
      afterStoryContext: {
        endingType: ENDINGS.acquaintance.type,
        lastPlayerLine: '旧的关键句。',
        endingReply: '旧的结局回复。',
        turningLine: '旧的关键句。',
        endingComment: '旧的总结。',
        roundsUsed: 7,
        affectionBoostCount: 3,
        affection: 18
      }
    })

    const wrapper = mount(ChatAfterStoryView)

    expect(mocks.loadChatAfter).toHaveBeenCalledWith(3)
    expect(wrapper.text()).toContain('这是保存过的聊天。')
    expect(wrapper.text()).toContain('我回来了。')
    expect(wrapper.text()).not.toContain('我到楼下了')
  })
})
