import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import ProgressiveImage from '../src/components/ProgressiveImage.vue'

it('keeps the small CG visible while the full image loads, including after image changes', async () => {
  const wrapper = mount(ProgressiveImage, { props: {
    src: '/full.webp', preview: '/small.webp', alt: '场景'
  } })
  expect(wrapper.attributes('aria-busy')).toBe('true')
  expect(wrapper.get('img[aria-hidden="true"]').attributes('src')).toBe('/small.webp')
  await wrapper.get('img[alt="场景"]').trigger('load')
  await flushPromises()
  expect(wrapper.attributes('aria-busy')).toBe('false')
  await wrapper.setProps({ src: '/next.webp', preview: '/next-small.webp' })
  expect(wrapper.attributes('aria-busy')).toBe('true')
  expect(wrapper.get('img[aria-hidden="true"]').attributes('src')).toBe('/next-small.webp')
  wrapper.unmount()
})

it('keeps the display CG while the original loads, then shows the original file', async () => {
  const wrapper = mount(ProgressiveImage, { props: {
    src: '/display.webp', preview: '/tiny.webp', highQualitySrc: '/original.webp', alt: '场景'
  } })
  expect(wrapper.find('img[src="/original.webp"]').exists()).toBe(false)
  await wrapper.get('img[alt="场景"]').trigger('load')
  await flushPromises()
  expect(wrapper.find('img[src="/original.webp"]').exists()).toBe(true)
  expect(wrapper.attributes('data-original-ready')).toBe('false')
  await wrapper.get('img[src="/original.webp"]').trigger('load')
  await flushPromises()
  expect(wrapper.attributes('data-original-ready')).toBe('true')
  await wrapper.setProps({ src: '/next.webp', highQualitySrc: '/next-original.webp' })
  expect(wrapper.attributes('data-original-ready')).toBe('false')
  wrapper.unmount()
})

it('retains the display image if the original fails and does not load hidden-frame originals', async () => {
  const wrapper = mount(ProgressiveImage, { props: {
    src: '/display.webp', highQualitySrc: '/original.webp', priority: 'low'
  } })
  await wrapper.get('.cg-full img').trigger('load')
  await flushPromises()
  expect(wrapper.find('.cg-original').exists()).toBe(false)
  await wrapper.setProps({ priority: 'high' })
  expect(wrapper.find('.cg-original').exists()).toBe(true)
  await wrapper.get('.cg-original img').trigger('error')
  expect(wrapper.find('.cg-original').exists()).toBe(false)
  expect(wrapper.get('.cg-full').classes()).toContain('cg-ready')
  wrapper.unmount()
})

it('lets a player in data-saving mode request the original explicitly', async () => {
  vi.stubGlobal('navigator', { connection: { saveData: true } })
  const wrapper = mount(ProgressiveImage, { props: {
    src: '/display.webp', highQualitySrc: '/original.webp'
  } })
  await wrapper.get('.cg-full img').trigger('load')
  await flushPromises()
  expect(wrapper.find('.cg-original').exists()).toBe(false)
  await wrapper.get('button').trigger('click')
  expect(wrapper.find('.cg-original').exists()).toBe(true)
  wrapper.unmount()
  vi.unstubAllGlobals()
})
