import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { AudioManager } from '../src/modules/AudioManager'
import { ROOFTOP_BGM_SRCS } from '../src/domain/gameContract'
import { useSettingsStore } from '../src/store/settingsStore'

const sounds = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock('howler', () => ({
  Howler: { volume: vi.fn() },
  Howl: class {
    constructor(options: Record<string, unknown>) { sounds.push(options) }
  }
}))

describe('homepage music', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sounds.length = 0
  })

  it('attempts music immediately without fetching unused sound effects', () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const NativeAudio = vi.fn(function () {
      return Object.assign(new EventTarget(), { play, pause: vi.fn(), volume: 1 })
    })
    vi.stubGlobal('Audio', NativeAudio)

    new AudioManager().init()

    expect(play).toHaveBeenCalled()
    expect(sounds.every((sound) => sound.preload === false)).toBe(true)
  })

  it('lets the first page interaction resume music after autoplay is blocked', async () => {
    const play = vi.fn()
      .mockRejectedValueOnce(new DOMException('Interaction required', 'NotAllowedError'))
      .mockResolvedValue(undefined)
    vi.stubGlobal('Audio', vi.fn(function () {
      return Object.assign(new EventTarget(), { play, pause: vi.fn(), paused: true, volume: 1 })
    }))
    const manager = new AudioManager()
    manager.init()
    await flushPromises()
    expect(manager.bgmState.value).toBe('blocked')

    document.dispatchEvent(new Event('pointerup'))
    await flushPromises()

    expect(manager.bgmState.value).toBe('playing')
    manager.stopBgm()
  })

  it('keeps the same music position and mute choice when entering the game', async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const pause = vi.fn()
    const media = Object.assign(new EventTarget(), { play, pause, paused: true, volume: 1 })
    vi.stubGlobal('Audio', vi.fn(function () { return media }))
    const manager = new AudioManager()
    manager.init()
    await flushPromises()
    play.mockClear()
    manager.playBgm(ROOFTOP_BGM_SRCS)
    expect(play).not.toHaveBeenCalled()

    manager.toggleBgm()
    manager.playBgm(ROOFTOP_BGM_SRCS)
    expect(manager.bgmState.value).toBe('muted')
    expect(play).not.toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
    manager.stopBgm()
  })

  it('does not undo mute when an earlier playback promise completes', async () => {
    let resolvePlay: () => void = () => {}
    const play = vi.fn(() => new Promise<void>((resolve) => { resolvePlay = resolve }))
    vi.stubGlobal('Audio', vi.fn(function () {
      return Object.assign(new EventTarget(), { play, pause: vi.fn(), volume: 1 })
    }))
    const manager = new AudioManager()
    manager.init()
    manager.toggleBgm()
    resolvePlay()
    await flushPromises()
    expect(manager.bgmState.value).toBe('muted')
    manager.stopBgm()
  })

  it('honors zero BGM volume without downloading music until explicitly enabled', async () => {
    const play = vi.fn().mockResolvedValue(undefined)
    const NativeAudio = vi.fn(function () {
      return Object.assign(new EventTarget(), { play, pause: vi.fn(), volume: 1 })
    })
    vi.stubGlobal('Audio', NativeAudio)
    useSettingsStore().bgmVolume = 0
    const manager = new AudioManager()
    manager.init()
    expect(NativeAudio).not.toHaveBeenCalled()
    expect(manager.bgmState.value).toBe('muted')
    manager.toggleBgm()
    await flushPromises()
    expect(manager.bgmState.value).toBe('playing')
    manager.stopBgm()
  })

  it('tries the alternate music format when the streaming source fails', async () => {
    const media = Object.assign(new EventTarget(), {
      src: '', play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
      load: vi.fn(), volume: 1
    })
    vi.stubGlobal('Audio', vi.fn(function (src: string) { media.src = src; return media }))
    const manager = new AudioManager()
    manager.init()
    await flushPromises()
    expect(media.src).toMatch(/\.mp3$/)
    media.dispatchEvent(new Event('error'))
    await flushPromises()
    expect(media.src).toMatch(/\.ogg$/)
    expect(manager.bgmState.value).toBe('playing')
    manager.stopBgm()
  })
})
