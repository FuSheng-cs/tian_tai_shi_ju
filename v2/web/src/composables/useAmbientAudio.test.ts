import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAmbientAudio } from './useAmbientAudio'

class MockParameter {
  value = 0
  cancelAndHoldAtTime() {}
  cancelScheduledValues() {}
  setValueAtTime(value: number) {
    this.value = value
  }
  linearRampToValueAtTime(value: number) {
    this.value = value
  }
  exponentialRampToValueAtTime(value: number) {
    this.value = value
  }
}

class MockNode {
  gain = new MockParameter()
  frequency = new MockParameter()
  detune = new MockParameter()
  pan = new MockParameter()
  Q = new MockParameter()
  onended: (() => void) | null = null
  disconnected = false
  connect() {}
  disconnect() {
    this.disconnected = true
  }
  start() {}
  stop() {}
}

class MockAudioContext {
  static instances: MockAudioContext[] = []
  static rejectResume = false
  state = 'suspended'
  currentTime = 0
  sampleRate = 100
  destination = new MockNode()
  nodes: MockNode[] = []
  onstatechange: (() => void) | null = null

  constructor() {
    MockAudioContext.instances.push(this)
  }
  createNode() {
    const node = new MockNode()
    this.nodes.push(node)
    return node
  }
  createGain() {
    return this.createNode()
  }
  createBiquadFilter() {
    return this.createNode()
  }
  createOscillator() {
    return this.createNode()
  }
  createStereoPanner() {
    return this.createNode()
  }
  createBufferSource() {
    return this.createNode()
  }
  createBuffer(channels: number, length: number) {
    return {
      numberOfChannels: channels,
      getChannelData: () => new Float32Array(length),
    }
  }
  async resume() {
    if (MockAudioContext.rejectResume) throw new Error('Playback was blocked')
    this.state = 'running'
    this.onstatechange?.()
  }
  async suspend() {
    this.state = 'suspended'
    this.onstatechange?.()
  }
  async close() {
    this.state = 'closed'
  }
}

const wrappers: VueWrapper[] = []
function mountAudio() {
  let audio!: ReturnType<typeof useAmbientAudio>
  const wrapper = mount(
    defineComponent({
      setup() {
        audio = useAmbientAudio()
        return () => h('div')
      },
    }),
  )
  wrappers.push(wrapper)
  return { audio, wrapper }
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  MockAudioContext.instances = []
  MockAudioContext.rejectResume = false
  vi.stubGlobal('AudioContext', MockAudioContext)
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useAmbientAudio', () => {
  it('requires an explicit enable even with a saved preference and phase changes', async () => {
    localStorage.setItem(
      'tiantaishiju:v2:ambient-audio',
      JSON.stringify({
        enabled: true,
        musicVolume: 0.6,
        rainVolume: 0.3,
      }),
    )
    const { audio } = mountAudio()
    audio.setPhase('listening')
    audio.setPhase('dawn')
    expect(MockAudioContext.instances).toHaveLength(0)
    expect(audio.soundEnabled.value).toBe(false)
    expect(audio.musicVolume.value).toBe(0.6)
    await audio.enable()
    expect(MockAudioContext.instances).toHaveLength(1)
    expect(audio.isPlaying.value).toBe(true)
  })

  it('safely loads corrupt preferences and bounds persisted volume controls', () => {
    localStorage.setItem('tiantaishiju:v2:ambient-audio', '{invalid')
    const { audio } = mountAudio()
    expect(audio.musicVolume.value).toBe(0.4)
    expect(audio.rainVolume.value).toBe(0.28)
    audio.setMusicVolume(10)
    audio.setRainVolume(-4)
    expect(audio.musicVolume.value).toBe(1)
    expect(audio.rainVolume.value).toBe(0)
    audio.setMusicVolume(Number.NaN)
    expect(audio.musicVolume.value).toBe(1)
    expect(JSON.parse(localStorage.getItem('tiantaishiju:v2:ambient-audio') ?? '{}')).toEqual({
      version: 1,
      musicVolume: 1,
      rainVolume: 0,
    })
  })

  it('works when local storage is denied', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Denied')
    })
    const { audio } = mountAudio()
    expect(() => audio.setMusicVolume(0.2)).not.toThrow()
    await audio.enable()
    expect(audio.soundEnabled.value).toBe(true)
  })

  it('fades before suspending, reuses its context, and releases nodes on unmount', async () => {
    const { audio, wrapper } = mountAudio()
    await audio.enable()
    const context = MockAudioContext.instances[0]!
    audio.setPhase('threshold')
    audio.disable()
    expect(audio.isPlaying.value).toBe(false)
    expect(context.state).toBe('running')
    await vi.advanceTimersByTimeAsync(750)
    expect(context.state).toBe('suspended')
    await audio.enable()
    expect(MockAudioContext.instances).toHaveLength(1)
    expect(audio.isPlaying.value).toBe(true)
    wrapper.unmount()
    expect(context.state).toBe('closed')
    expect(context.nodes.every((node) => node.disconnected)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not let a pending enable undo a later disable', async () => {
    const { audio } = mountAudio()
    const enabling = audio.enable()
    audio.disable()
    await enabling
    expect(audio.soundEnabled.value).toBe(false)
    expect(audio.isPlaying.value).toBe(false)
  })

  it('keeps sound disabled when the browser rejects playback, then allows a retry', async () => {
    MockAudioContext.rejectResume = true
    const { audio } = mountAudio()
    await expect(audio.enable()).resolves.toBeUndefined()
    expect(audio.soundEnabled.value).toBe(false)
    expect(audio.isPlaying.value).toBe(false)
    MockAudioContext.rejectResume = false
    await audio.enable()
    expect(audio.isPlaying.value).toBe(true)
    expect(MockAudioContext.instances).toHaveLength(1)
  })

  it('gracefully handles browsers without Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { audio } = mountAudio()
    await expect(audio.toggle()).resolves.toBeUndefined()
    expect(audio.soundEnabled.value).toBe(false)
    expect(audio.isPlaying.value).toBe(false)
  })
})
