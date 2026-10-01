import { mount, flushPromises } from '@vue/test-utils'
import { expect, it } from 'vitest'
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
