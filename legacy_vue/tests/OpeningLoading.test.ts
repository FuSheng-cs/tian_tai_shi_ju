import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import OpeningSequenceOverlay from '../src/components/OpeningSequenceOverlay.vue'

vi.mock('howler', () => ({ Howler: { volume: vi.fn() }, Howl: class {} }))
const frames = [1, 2, 3, 4, 5].map((n) => ({
  id: `frame-${n}`, image: `/frame-${n}.webp`, caption: `第 ${n} 幕`
}))
beforeEach(() => setActivePinia(createPinia()))

it('only fetches the current and next frame when entering the opening', () => {
  const wrapper = mount(OpeningSequenceOverlay, { props: { frames } })
  expect(wrapper.findAll('img').map((image) => image.attributes('src'))).toEqual([
    '/frame-1.webp', '/frame-2.webp'
  ])
  wrapper.unmount()
})

it('keeps the current caption during slow image decoding and ignores repeated advance', async () => {
  let finishDecode: () => void = () => {}
  const pending = new Promise<void>((resolve) => { finishDecode = resolve })
  vi.stubGlobal('Image', class { src = ''; decode = () => pending })
  const wrapper = mount(OpeningSequenceOverlay, { props: { frames } })
  await wrapper.get('.cinematic-continue').trigger('click')
  await wrapper.get('.cinematic-continue').trigger('click')
  expect(wrapper.get('.cinematic-caption').text()).toBe('第 1 幕')
  finishDecode()
  await flushPromises()
  expect(wrapper.get('.cinematic-caption').text()).toBe('第 2 幕')
  wrapper.unmount()
  vi.unstubAllGlobals()
})

it('can skip while an image is stalled, without a late promise advancing again', async () => {
  vi.useFakeTimers()
  let finishDecode: () => void = () => {}
  vi.stubGlobal('Image', class {
    src = ''
    decode = () => new Promise<void>((resolve) => { finishDecode = resolve })
  })
  const wrapper = mount(OpeningSequenceOverlay, { props: { frames } })
  await wrapper.get('.cinematic-continue').trigger('click')
  await wrapper.get('.cinematic-skip').trigger('click')
  await vi.advanceTimersByTimeAsync(650)
  expect(wrapper.emitted('complete')).toHaveLength(1)
  finishDecode()
  await flushPromises()
  expect(wrapper.emitted('complete')).toHaveLength(1)
  wrapper.unmount()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('continues with the caption when an image fails to decode', async () => {
  vi.stubGlobal('Image', class {
    src = ''
    decode = () => Promise.reject(new Error('Image unavailable'))
  })
  const wrapper = mount(OpeningSequenceOverlay, { props: { frames } })
  await wrapper.get('.cinematic-continue').trigger('click')
  await flushPromises()
  expect(wrapper.get('.cinematic-caption').text()).toBe('第 2 幕')
  wrapper.unmount()
  vi.unstubAllGlobals()
})
