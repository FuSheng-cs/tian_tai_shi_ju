import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT_AFTER_SAVE_SLOT_SESSION_KEY, ENDINGS, GAME_RULES } from '../src/domain/gameContract'
import { useGameStore } from '../src/store/gameStore'
import ChatAfterStoryView from '../src/views/ChatAfterStoryView.vue'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  playSfx: vi.fn(),
  chatAfterStory: vi.fn(),
  getSlots: vi.fn(() => []),
  saveChatAfter: vi.fn(() => true),
  loadChatAfter: vi.fn(() => null)
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push })
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

describe('ChatAfterStoryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    mocks.push.mockClear()
    mocks.playSfx.mockClear()
    mocks.chatAfterStory.mockReset()
    mocks.chatAfterStory.mockResolvedValue('还没，便利店门口风也挺大。')
    mocks.getSlots.mockReset()
    mocks.getSlots.mockReturnValue([])
    mocks.saveChatAfter.mockReset()
    mocks.saveChatAfter.mockReturnValue(true)
    mocks.loadChatAfter.mockReset()
    mocks.loadChatAfter.mockReturnValue(null)
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
    expect(sessionStorage.getItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY)).toBe('2')
  })

  it('restores an after-story save without rebuilding the opening messages', () => {
    sessionStorage.setItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY, '3')
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
