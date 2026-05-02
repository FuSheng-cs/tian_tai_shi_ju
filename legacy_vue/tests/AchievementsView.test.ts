import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ENDINGS } from '../src/domain/gameContract'
import AchievementsView from '../src/views/AchievementsView.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('../src/modules/AudioManager', () => ({
  audioManager: {
    playSfx: vi.fn()
  }
}))

describe('AchievementsView', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('groups achievements and shows overall progress', () => {
    localStorage.setItem('damo_achievements', JSON.stringify(['first_try', ENDINGS.death.type]))

    const wrapper = mount(AchievementsView)

    expect(wrapper.text()).toContain('雨夜档案')
    expect(wrapper.text()).toContain('已点亮 2 / 18')
    expect(wrapper.text()).toContain('相遇')
    expect(wrapper.text()).toContain('倾听')
    expect(wrapper.text()).toContain('压力')
    expect(wrapper.text()).toContain('结局')
    expect(wrapper.text()).toContain('收藏')
  })

  it('shows unlocked archive text and hides locked hidden achievement names', () => {
    localStorage.setItem('damo_achievements', JSON.stringify(['first_try']))

    const wrapper = mount(AchievementsView)

    expect(wrapper.text()).toContain('初次相遇')
    expect(wrapper.text()).toContain('第一次在天台遇见她。')
    expect(wrapper.text()).toContain('???')
    expect(wrapper.text()).not.toContain('相识')
    expect(wrapper.text()).toContain('让她今晚留下，已经是一件很难的事。')
  })
})
