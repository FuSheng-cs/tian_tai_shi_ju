import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalMusicAudition,
  isLocalMusicTrack,
  type MusicTrackStatus,
} from './localMusicAudition'

class Parameter {
  value = 0
  ramps: { value: number; time: number }[] = []
  cancelAndHoldAtTime() {}
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value
    this.ramps.push({ value, time })
  }
}

class Node {
  gain = new Parameter()
  connections: Node[] = []
  disconnected = false
  connect(node: Node) {
    this.connections.push(node)
  }
  disconnect() {
    this.disconnected = true
  }
}

class Media extends EventTarget {
  static instances: Media[] = []
  static plays: (() => Promise<void>)[] = []
  src = ''
  loop = false
  preload = ''
  paused = true
  currentTime = 0
  constructor() {
    super()
    Media.instances.push(this)
  }
  play = vi.fn(() =>
    (Media.plays.shift()?.() ?? Promise.resolve()).then(() => {
      this.paused = false
      this.dispatchEvent(new Event('playing'))
    }),
  )
  pause = vi.fn(() => {
    this.paused = true
  })
  load = vi.fn()
  removeAttribute(name: string) {
    if (name === 'src') this.src = ''
  }
}

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const transports: ReturnType<typeof createLocalMusicAudition>[] = []
function fixture(initiallyPlayable = true) {
  const master = new Node()
  const synth = new Node()
  synth.gain.value = 1
  const nodes: Node[] = []
  const sources: { node: Node; media: Media }[] = []
  const statuses: MusicTrackStatus[] = []
  let playable = initiallyPlayable
  const context = {
    currentTime: 10,
    createGain() {
      const node = new Node()
      nodes.push(node)
      return node
    },
    createMediaElementSource(media: Media) {
      const node = new Node()
      nodes.push(node)
      sources.push({ node, media })
      return node
    },
  }
  const transport = createLocalMusicAudition({
    context: context as unknown as AudioContext,
    master: master as unknown as GainNode,
    synthMix: synth as unknown as GainNode,
    volume: 0.4,
    canPlay: () => playable,
    onStatus: (status) => statuses.push(status),
  })
  transports.push(transport)
  return {
    transport,
    master,
    synth,
    nodes,
    sources,
    statuses,
    context,
    setPlayable(value: boolean) {
      playable = value
    },
  }
}

const home = { url: '/__local-audio/home.mp3', gain: 0.501765 }
const tea = { url: '/__local-audio/chamomile-tea.mp3', gain: 0.514636 }

beforeEach(() => {
  vi.useFakeTimers()
  Media.instances = []
  Media.plays = []
  vi.stubGlobal('Audio', Media)
})

afterEach(() => {
  for (const transport of transports.splice(0)) transport.dispose()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('private local music audition', () => {
  it('accepts only the four exact private routes', async () => {
    expect(isLocalMusicTrack(home.url)).toBe(true)
    expect(isLocalMusicTrack(tea.url)).toBe(true)
    expect(isLocalMusicTrack('/__local-audio/late-night-earl-grey.mp3')).toBe(true)
    expect(isLocalMusicTrack('/__local-audio/peppermint-tea.mp3')).toBe(true)
    const { transport, statuses } = fixture()
    for (const url of [
      'https://example.com/home.mp3',
      '//example.com/home.mp3',
      '/__local-audio/other.mp3',
      '/__local-audio/home.mp3?download=1',
      '/__local-audio/../home.mp3',
      '/__local-audio/home.mp3#fragment',
    ]) {
      expect(isLocalMusicTrack(url)).toBe(false)
      await transport.select({ url, gain: 1 })
    }
    expect(Media.instances).toHaveLength(0)
    expect(statuses.at(-1)).toBe('error')
  })

  it('stages a selection without fetching and uses the unfiltered music path after enable', async () => {
    const { transport, statuses, setPlayable, sources, nodes, master, synth } = fixture(false)
    await transport.select(home)
    expect(Media.instances).toHaveLength(0)
    expect(statuses.at(-1)).toBe('selected')
    setPlayable(true)
    await transport.resume()
    expect(statuses.at(-1)).toBe('ready')
    expect(Media.instances[0]!.src).toBe(home.url)
    expect(Media.instances[0]!.loop).toBe(true)
    expect(sources[0]!.node.connections[0]!.gain.value).toBe(home.gain)
    expect(sources[0]!.node.connections[0]!.connections).toEqual([nodes[0]])
    expect(nodes[0]!.connections).toEqual([master])
    expect(nodes[0]!.gain.value).toBe(0.4)
    expect(synth.gain.value).toBe(0)
  })

  it('keeps the original score while loading, then retires the previous file after a switch', async () => {
    const { transport, synth, sources, statuses } = fixture()
    const first = deferred()
    Media.plays.push(() => first.promise)
    const starting = transport.select(home)
    expect(statuses.at(-1)).toBe('loading')
    expect(synth.gain.value).toBe(1)
    first.resolve()
    await starting
    const second = deferred()
    Media.plays.push(() => second.promise)
    const switching = transport.select(tea)
    expect(sources[0]!.node.connections[0]!.gain.value).toBe(home.gain)
    second.resolve()
    await switching
    expect(sources[0]!.node.connections[0]!.gain.value).toBe(0)
    expect(sources[1]!.node.connections[0]!.gain.value).toBe(tea.gain)
    await vi.advanceTimersByTimeAsync(1300)
    expect(Media.instances[0]!.paused).toBe(true)
    expect(Media.instances[0]!.src).toBe('')
    expect(Media.instances.filter((media) => !media.paused)).toHaveLength(1)
  })

  it('lets only the latest request play even if an old play promise resolves late', async () => {
    const { transport, statuses, synth } = fixture()
    const stale = deferred()
    Media.plays.push(() => stale.promise)
    const first = transport.select(home)
    await transport.select(tea)
    stale.resolve()
    await first
    await Promise.resolve()
    expect(Media.instances[0]!.paused).toBe(true)
    expect(Media.instances[0]!.src).toBe('')
    expect(Media.instances[1]!.paused).toBe(false)
    expect(statuses.at(-1)).toBe('ready')
    expect(synth.gain.value).toBe(0)
  })

  it('applies the user music control after the track trim and returns to the original score', async () => {
    const { transport, nodes, sources, synth, statuses } = fixture()
    await transport.select(home)
    transport.setVolume(0)
    expect(nodes[0]!.gain.value).toBe(0)
    expect(sources[0]!.node.connections[0]!.gain.value).toBe(home.gain)
    await transport.select(undefined)
    expect(statuses.at(-1)).toBe('original')
    expect(synth.gain.value).toBe(1)
    await vi.advanceTimersByTimeAsync(1300)
    expect(Media.instances.every((media) => media.paused && media.src === '')).toBe(true)
  })

  it('falls back to the original when a replacement cannot play and supports retry', async () => {
    const { transport, synth, statuses } = fixture()
    await transport.select(home)
    Media.plays.push(() => Promise.reject(new Error('Decode failed')))
    await transport.select(tea)
    expect(statuses.at(-1)).toBe('error')
    expect(synth.gain.value).toBe(1)
    await vi.advanceTimersByTimeAsync(1300)
    expect(Media.instances.every((media) => media.paused)).toBe(true)
    await transport.select(tea)
    expect(statuses.at(-1)).toBe('ready')
    expect(synth.gain.value).toBe(0)
  })

  it('times out a hanging load and never lets its late completion restart music', async () => {
    const { transport, synth, statuses } = fixture()
    const waiting = deferred()
    Media.plays.push(() => waiting.promise)
    const loading = transport.select(home)
    await vi.advanceTimersByTimeAsync(12_050)
    await loading
    expect(statuses.at(-1)).toBe('error')
    expect(synth.gain.value).toBe(1)
    waiting.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(Media.instances[0]!.paused).toBe(true)
    expect(Media.instances[0]!.src).toBe('')
  })

  it('recovers from an active media error without leaving a misleading selected song audible', async () => {
    const { transport, synth, statuses } = fixture()
    await transport.select(home)
    Media.instances[0]!.dispatchEvent(new Event('error'))
    expect(statuses.at(-1)).toBe('error')
    expect(synth.gain.value).toBe(1)
    await vi.advanceTimersByTimeAsync(1300)
    expect(Media.instances[0]!.paused).toBe(true)
  })

  it('tolerates brief buffering but restores original music after a sustained stall', async () => {
    const { transport, statuses } = fixture()
    await transport.select(home)
    const media = Media.instances[0]!
    media.dispatchEvent(new Event('waiting'))
    await vi.advanceTimersByTimeAsync(2000)
    media.dispatchEvent(new Event('playing'))
    await vi.advanceTimersByTimeAsync(7000)
    expect(statuses.at(-1)).toBe('ready')
    media.dispatchEvent(new Event('waiting'))
    await vi.advanceTimersByTimeAsync(5000)
    media.dispatchEvent(new Event('stalled'))
    await vi.advanceTimersByTimeAsync(3100)
    expect(statuses.at(-1)).toBe('error')
  })

  it('pauses the actual media after the master fade and resumes its position without refetch', async () => {
    const { transport, setPlayable } = fixture()
    await transport.select(home)
    const media = Media.instances[0]!
    media.currentTime = 37
    setPlayable(false)
    transport.pause(180)
    expect(media.paused).toBe(false)
    await vi.advanceTimersByTimeAsync(200)
    expect(media.paused).toBe(true)
    setPlayable(true)
    await transport.resume()
    expect(media.currentTime).toBe(37)
    expect(media.paused).toBe(false)
    expect(Media.instances).toHaveLength(1)
  })

  it('keeps media paused if a resume finishes after sound has been disabled', async () => {
    const { transport, setPlayable } = fixture()
    await transport.select(home)
    setPlayable(false)
    transport.pause()
    setPlayable(true)
    const waiting = deferred()
    Media.plays.push(() => waiting.promise)
    const resuming = transport.resume()
    setPlayable(false)
    transport.pause()
    waiting.resolve()
    await resuming
    await Promise.resolve()
    expect(Media.instances[0]!.paused).toBe(true)
  })

  it('cancels a pending file when the player returns to the original score', async () => {
    const { transport, synth, statuses } = fixture()
    const waiting = deferred()
    Media.plays.push(() => waiting.promise)
    const loading = transport.select(home)
    await transport.select(undefined)
    waiting.resolve()
    await loading
    await Promise.resolve()
    expect(statuses.at(-1)).toBe('original')
    expect(synth.gain.value).toBe(1)
    expect(Media.instances[0]!.paused).toBe(true)
  })

  it('releases nodes, listeners, pending playback and timers on disposal', async () => {
    const { transport, nodes, statuses } = fixture()
    const waiting = deferred()
    Media.plays.push(() => waiting.promise)
    const loading = transport.select(home)
    transport.dispose()
    const lastStatus = statuses.at(-1)
    waiting.resolve()
    await loading
    Media.instances[0]!.dispatchEvent(new Event('error'))
    expect(statuses.at(-1)).toBe(lastStatus)
    expect(Media.instances[0]!.paused).toBe(true)
    expect(nodes.every((node) => node.disconnected)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})
