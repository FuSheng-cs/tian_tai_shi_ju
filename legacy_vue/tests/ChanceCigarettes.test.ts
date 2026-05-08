import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ChanceCigarettes from '../src/components/ChanceCigarettes.vue'

const states = (value: number, max = 10) =>
  mount(ChanceCigarettes, { props: { value, max } })
    .findAll('[data-test="chance-cigarette"]')
    .map((item) => item.attributes('data-state'))

describe('ChanceCigarettes', () => {
  it('renders one lit cigarette for every available chance', () => {
    expect(states(10)).toEqual(Array(10).fill('lit'))
  })

  it('renders spent cigarettes for used chances', () => {
    expect(states(3)).toEqual([
      'lit',
      'lit',
      'lit',
      'spent',
      'spent',
      'spent',
      'spent',
      'spent',
      'spent',
      'spent'
    ])
  })

  it('renders all cigarettes spent at zero chances', () => {
    expect(states(0)).toEqual(Array(10).fill('spent'))
  })

  it('clamps out-of-range values into the visible chance range', () => {
    expect(states(99)).toEqual(Array(10).fill('lit'))
    expect(states(-3)).toEqual(Array(10).fill('spent'))
  })

  it('exposes the remaining chance count to assistive technology', () => {
    const wrapper = mount(ChanceCigarettes, { props: { value: 4, max: 10 } })

    expect(wrapper.attributes('aria-label')).toBe('剩余机会 4 / 10')
  })

  it('labels the cigarettes as remaining chances for players', () => {
    const wrapper = mount(ChanceCigarettes, { props: { value: 4, max: 10 } })

    expect(wrapper.text()).toContain('剩余次数')
  })
})
