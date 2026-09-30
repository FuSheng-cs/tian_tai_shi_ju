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
    localStorage.setItem('tiantaishiju_safety_achievements', JSON.stringify(['first_try', ENDINGS.refusal.type]))

    const wrapper = mount(AchievementsView)

    expect(wrapper.classes()).toContain('overflow-y-scroll')
    expect(wrapper.text()).toContain('安全对话档案')
    expect(wrapper.text()).toContain('已点亮 2 / 17')
    expect(wrapper.text()).toContain('相遇')
    expect(wrapper.text()).toContain('倾听')
    expect(wrapper.text()).toContain('安全')
    expect(wrapper.text()).toContain('结局')
    expect(wrapper.text()).toContain('收藏')
  })

  it('shows unlocked archive text and hides locked hidden achievement names', () => {
    localStorage.setItem('tiantaishiju_safety_achievements', JSON.stringify(['first_try']))

    const wrapper = mount(AchievementsView)

    expect(wrapper.text()).toContain('初次相遇')
    expect(wrapper.text()).toContain('第一次在天台遇见她。')
    expect(wrapper.text()).toContain('???')
    expect(wrapper.text()).not.toContain('相识')
    expect(wrapper.text()).toContain('陪她走到下一个安全的地方。')
  })
})
