import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { expect, it, vi } from 'vitest'
import { AudioManager } from '../src/modules/AudioManager'
import BgmControl from '../src/components/BgmControl.vue'

vi.mock('howler', () => ({ Howler: { volume: vi.fn() }, Howl: class {} }))

it('offers an accessible way to enable blocked homepage music and then mute it', async () => {
  setActivePinia(createPinia())
  const play = vi.fn()
    .mockRejectedValueOnce(new DOMException('Interaction required', 'NotAllowedError'))
    .mockResolvedValue(undefined)
  vi.stubGlobal('Audio', vi.fn(function () {
    return Object.assign(new EventTarget(), { play, pause: vi.fn(), volume: 1 })
  }))
  const manager = new AudioManager()
  manager.init()
  await flushPromises()
  const wrapper = mount(BgmControl, { props: { manager }, attachTo: document.body })
  await wrapper.get('button[aria-label="开启声音"]').trigger('pointerup')
  await wrapper.get('button[aria-label="开启声音"]').trigger('click')
  await flushPromises()
  await wrapper.get('button[aria-label="关闭声音"]').trigger('click')
  await flushPromises()
  expect(wrapper.get('button').attributes('aria-label')).toBe('开启声音')
  manager.stopBgm()
  wrapper.unmount()
  vi.unstubAllGlobals()
})
