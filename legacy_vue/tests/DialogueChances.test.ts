import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DialogueChances from '../src/components/DialogueChances.vue'

const states = (value: number, max = 10) =>
  mount(DialogueChances, { props: { value, max } })
    .findAll('[data-test="dialogue-chance"]')
    .map((item) => item.attributes('data-state'))

describe('DialogueChances', () => {
  it('renders one lit dialogue slot for every available chance', () => {
    expect(states(10)).toEqual(Array(10).fill('available'))
  })

  it('renders spent dialogue slots for used chances', () => {
    expect(states(3)).toEqual([
      'available',
      'available',
      'available',
      'spent',
      'spent',
      'spent',
      'spent',
      'spent',
      'spent',
      'spent'
    ])
  })

  it('renders all dialogue slots spent at zero chances', () => {
    expect(states(0)).toEqual(Array(10).fill('spent'))
  })

  it('clamps out-of-range values into the visible chance range', () => {
    expect(states(99)).toEqual(Array(10).fill('available'))
    expect(states(-3)).toEqual(Array(10).fill('spent'))
  })

  it('exposes the remaining chance count to assistive technology', () => {
    const wrapper = mount(DialogueChances, { props: { value: 4, max: 10 } })

    expect(wrapper.attributes('aria-label')).toBe('剩余对话机会 4 / 10')
  })

  it('labels the dialogue slots as remaining chances for players', () => {
    const wrapper = mount(DialogueChances, { props: { value: 4, max: 10 } })

    expect(wrapper.text()).toContain('剩余对话')
  })

  it('shows the numeric chance count in the bottom corner', () => {
    const wrapper = mount(DialogueChances, { props: { value: 4, max: 10 } })

    expect(wrapper.find('[data-test="dialogue-chances-count"]').text()).toBe('4/10')
  })
})
