import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ENDINGS, GAME_RULES } from '../src/domain/gameContract'
import { useGameStore } from '../src/store/gameStore'
import ChatAfterStoryView from '../src/views/ChatAfterStoryView.vue'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  playSfx: vi.fn(),
  chatAfterStory: vi.fn()
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

describe('ChatAfterStoryView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.push.mockClear()
    mocks.playSfx.mockClear()
    mocks.chatAfterStory.mockReset()
    mocks.chatAfterStory.mockResolvedValue('还没，便利店门口风也挺大。')
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
})
