import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAmbientAudio } from './useAmbientAudio'

class MockParameter {
  value = 0
  ramps: { value: number; at: number }[] = []
  cancelAndHoldAtTime() {}
  cancelScheduledValues() {}
  setValueAtTime(value: number) {
    this.value = value
  }
  linearRampToValueAtTime(value: number, at: number) {
    this.value = value
    this.ramps.push({ value, at })
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
  delayTime = new MockParameter()
  onended: (() => void) | null = null
  disconnected = false
  connections: MockNode[] = []
  connect(node: MockNode) {
    this.connections.push(node)
  }
  disconnect() {
    this.disconnected = true
  }
  startedAt: number | undefined
  start(at = 0) {
    this.startedAt = at
  }
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
  mediaSources: MockNode[] = []
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
  createDelay() {
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
  createMediaElementSource() {
    const source = this.createNode()
    this.mediaSources.push(source)
    return source
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

class MockMedia extends EventTarget {
  static instances: MockMedia[] = []
  static rejectPlayback = false
  paused = true
  src = ''
  loop = false
  preload = ''
  constructor() {
    super()
    MockMedia.instances.push(this)
  }
  async play() {
    if (MockMedia.rejectPlayback) throw new Error('File playback rejected')
    this.paused = false
  }
  pause() {
    this.paused = true
  }
  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }
  load() {}
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
  MockMedia.instances = []
  MockMedia.rejectPlayback = false
  vi.stubGlobal('AudioContext', MockAudioContext)
  vi.stubGlobal('Audio', MockMedia)
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})

afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

  it('keeps the authored rests when enable is called again while already playing', async () => {
    const { audio } = mountAudio()
    await audio.enable()
    const context = MockAudioContext.instances[0]!
    const initialSources = context.nodes.filter((node) => node.startedAt !== undefined).length
    context.currentTime = 4
    await vi.advanceTimersByTimeAsync(4000)
    await audio.enable()
    context.currentTime = 4.8
    await vi.advanceTimersByTimeAsync(800)
    const newNotes = context.nodes
      .filter((node) => node.startedAt !== undefined)
      .slice(initialSources)
    expect(newNotes).toHaveLength(9)
    expect(newNotes.map((node) => node.startedAt)).toEqual([
      4.8, 4.8, 4.8, 7.6, 7.6, 7.6, 11.7, 11.7, 11.7,
    ])
    context.currentTime = 24.8
    await vi.advanceTimersByTimeAsync(20_000)
    expect(context.nodes.filter((node) => node.startedAt !== undefined)).toHaveLength(
      initialSources + 9,
    )
  })

  it('pauses a hidden page and returns without catching up missed phrases', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get')
    const { audio } = mountAudio()
    await audio.enable()
    const context = MockAudioContext.instances[0]!
    context.currentTime = 2
    await vi.advanceTimersByTimeAsync(2000)
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(200)
    expect(context.state).toBe('suspended')
    expect(audio.soundEnabled.value).toBe(true)
    expect(audio.isPlaying.value).toBe(false)
    const sourceCount = context.nodes.filter((node) => node.startedAt !== undefined).length
    await vi.advanceTimersByTimeAsync(300_000)
    expect(context.nodes.filter((node) => node.startedAt !== undefined)).toHaveLength(sourceCount)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(audio.isPlaying.value).toBe(true)
    await vi.advanceTimersByTimeAsync(2700)
    expect(context.nodes.filter((node) => node.startedAt !== undefined)).toHaveLength(sourceCount)
    context.currentTime = 4.8
    await vi.advanceTimersByTimeAsync(100)
    expect(context.nodes.filter((node) => node.startedAt !== undefined)).toHaveLength(
      sourceCount + 9,
    )
  })

  it('does not resume a hidden page after the player has disabled sound', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get')
    const { audio } = mountAudio()
    await audio.enable()
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    audio.disable()
    await vi.advanceTimersByTimeAsync(750)
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(MockAudioContext.instances[0]!.state).toBe('suspended')
    expect(audio.soundEnabled.value).toBe(false)
    expect(audio.isPlaying.value).toBe(false)
  })

  it('keeps rain usable when music is muted, including phase transitions', async () => {
    const { audio } = mountAudio()
    await audio.enable()
    audio.setMusicVolume(0)
    audio.setRainVolume(0.5)
    audio.setPhase('threshold')
    expect(audio.musicVolume.value).toBe(0)
    expect(audio.rainVolume.value).toBe(0.5)
    expect(audio.isPlaying.value).toBe(true)
    const context = MockAudioContext.instances[0]!
    expect(context.nodes.some((node) => node.frequency.value === 2600)).toBe(true)
    expect(context.nodes[1]!.gain.value).toBe(0)
    expect(context.nodes[2]!.gain.value).toBeCloseTo(0.39)
  })

  it('applies confirmed shelter at first enable without autoplay or changing preferences', async () => {
    const { audio } = mountAudio()
    audio.setLocation('threshold')
    audio.setPhase('arrival')
    expect(MockAudioContext.instances).toHaveLength(0)
    expect(audio.soundEnabled.value).toBe(false)
    await audio.enable()
    const context = MockAudioContext.instances[0]!
    expect(context.nodes.some((node) => node.frequency.value === 1450)).toBe(true)
    expect(context.nodes.some((node) => node.gain.value === 0.78)).toBe(true)
    expect(audio.rainVolume.value).toBe(0.28)
    expect(audio.musicVolume.value).toBe(0.4)
    expect(context.nodes[2]!.gain.value).toBeCloseTo(0.28)
  })

  it('keeps spatial fades separate from phase and volume, and restores an accepted rooftop return', async () => {
    const { audio } = mountAudio()
    await audio.enable()
    const context = MockAudioContext.instances[0]!
    const shelterFilter = context.nodes.find((node) => node.frequency.value === 18000)!
    expect(shelterFilter).toBeDefined()
    context.currentTime = 12
    audio.setLocation('threshold')
    const shelterGain = context.nodes.find((node) => node.gain.value === 0.78)!
    expect(shelterFilter.frequency.ramps.at(-1)).toEqual({ value: 1450, at: 14.8 })
    expect(shelterGain.gain.ramps.at(-1)).toEqual({ value: 0.78, at: 14.8 })
    audio.setPhase('threshold')
    audio.setRainVolume(0.6)
    expect(shelterFilter.frequency.ramps).toHaveLength(1)
    expect(shelterGain.gain.ramps).toHaveLength(1)
    expect(context.nodes[2]!.gain.value).toBeCloseTo(0.6 * 0.78)
    expect(audio.rainVolume.value).toBe(0.6)
    audio.setLocation('threshold')
    expect(shelterFilter.frequency.ramps).toHaveLength(1)
    context.currentTime = 20
    audio.setLocation('rooftop')
    expect(shelterFilter.frequency.ramps.at(-1)).toEqual({ value: 18000, at: 22.8 })
    expect(shelterGain.gain.ramps.at(-1)).toEqual({ value: 1, at: 22.8 })
    expect(context.nodes[2]!.gain.value).toBeCloseTo(0.6 * 0.78)
    expect(MockAudioContext.instances).toHaveLength(1)
  })

  it('does not override rain mute, manual pause or background suspension when location changes', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get')
    const { audio } = mountAudio()
    await audio.enable()
    const context = MockAudioContext.instances[0]!
    audio.setRainVolume(0)
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(200)
    audio.setLocation('threshold')
    audio.setPhase('dawn')
    expect(context.state).toBe('suspended')
    expect(context.nodes[0]!.gain.value).toBe(0)
    expect(context.nodes[2]!.gain.value).toBe(0)
    expect(audio.isPlaying.value).toBe(false)
    audio.disable()
    audio.setLocation('rooftop')
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(context.state).toBe('suspended')
    expect(audio.soundEnabled.value).toBe(false)
    expect(audio.rainVolume.value).toBe(0)
    expect(MockAudioContext.instances).toHaveLength(1)
  })

  it('does not accept private tracks without the development audition flag or in production', async () => {
    vi.stubEnv('VITE_LOCAL_AUDIO_AUDITION', '')
    const { audio } = mountAudio()
    await audio.setMusicTrack('/__local-audio/home.mp3')
    expect(audio.musicTrackStatus.value).toBe('original')
    vi.stubEnv('VITE_LOCAL_AUDIO_AUDITION', '1')
    vi.stubEnv('DEV', false)
    await audio.setMusicTrack('/__local-audio/home.mp3')
    expect(audio.selectedMusicTrack.value).toBeUndefined()
    expect(MockAudioContext.instances).toHaveLength(0)
    expect(MockMedia.instances).toHaveLength(0)
  })

  it('stages a private selection without autoplay, then uses the existing context and bounded track gain', async () => {
    vi.stubEnv('VITE_LOCAL_AUDIO_AUDITION', '1')
    const { audio } = mountAudio()
    await audio.setMusicTrack('/__local-audio/home.mp3', 9)
    expect(audio.musicTrackStatus.value).toBe('selected')
    expect(audio.selectedMusicTrack.value).toBe('/__local-audio/home.mp3')
    expect(audio.soundEnabled.value).toBe(false)
    expect(MockAudioContext.instances).toHaveLength(0)
    expect(MockMedia.instances).toHaveLength(0)
    await audio.enable()
    expect(audio.musicTrackStatus.value).toBe('ready')
    expect(MockAudioContext.instances).toHaveLength(1)
    const context = MockAudioContext.instances[0]!
    const trackGain = context.mediaSources[0]!.connections[0]!
    const fileVolume = trackGain.connections[0]!
    expect(trackGain.gain.value).toBe(1)
    audio.setMusicVolume(0)
    audio.setRainVolume(0.5)
    audio.setPhase('threshold')
    expect(fileVolume.gain.value).toBe(0)
    expect(context.nodes[2]!.gain.value).toBeCloseTo(0.39)
    expect(audio.musicVolume.value).toBe(0)
  })

  it('pauses media itself when hidden and respects a later manual disable', async () => {
    vi.stubEnv('VITE_LOCAL_AUDIO_AUDITION', '1')
    const hidden = vi.spyOn(document, 'hidden', 'get')
    const { audio } = mountAudio()
    await audio.setMusicTrack('/__local-audio/home.mp3', 0.5)
    await audio.enable()
    const media = MockMedia.instances[0]!
    expect(media.paused).toBe(false)
    hidden.mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(200)
    expect(media.paused).toBe(true)
    expect(MockAudioContext.instances[0]!.state).toBe('suspended')
    hidden.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(1)
    expect(media.paused).toBe(false)
    expect(MockMedia.instances).toHaveLength(1)
    audio.disable()
    await vi.advanceTimersByTimeAsync(750)
    audio.setLocation('threshold')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(media.paused).toBe(true)
    expect(audio.soundEnabled.value).toBe(false)
  })

  it('keeps sound enabled on a file error so the original score and rain remain available', async () => {
    vi.stubEnv('VITE_LOCAL_AUDIO_AUDITION', '1')
    MockMedia.rejectPlayback = true
    const { audio } = mountAudio()
    await audio.setMusicTrack('/__local-audio/home.mp3')
    await audio.enable()
    expect(audio.musicTrackStatus.value).toBe('error')
    expect(audio.selectedMusicTrack.value).toBe('/__local-audio/home.mp3')
    expect(audio.isPlaying.value).toBe(true)
    expect(audio.soundEnabled.value).toBe(true)
    expect(MockMedia.instances[0]!.paused).toBe(true)
    MockMedia.rejectPlayback = false
    await audio.setMusicTrack('/__local-audio/home.mp3')
    expect(audio.musicTrackStatus.value).toBe('ready')
    await audio.setMusicTrack(undefined)
    expect(audio.musicTrackStatus.value).toBe('original')
    expect(audio.selectedMusicTrack.value).toBeUndefined()
  })
})
