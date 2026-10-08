import { onUnmounted, ref } from 'vue'
import {
  BELL_PHRASE,
  BELL_RESTS_MS,
  DRONE_DETUNE,
  DRONE_PAN,
  PHASE_SCORE,
  type AmbientPhase,
} from '../audio/score'

const STORAGE_KEY = 'tiantaishiju:v2:ambient-audio'
const DEFAULT_MUSIC_VOLUME = 0.4
const DEFAULT_RAIN_VOLUME = 0.28
const MASTER_VOLUME = 0.55

interface AudioPreferences {
  musicVolume: number
  rainVolume: number
}

interface AmbientEngine {
  context: AudioContext
  master: GainNode
  music: GainNode
  rain: GainNode
  nodes: Set<AudioNode>
  sources: Set<AudioScheduledSourceNode>
  drone?: {
    gain: GainNode
    sources: AudioScheduledSourceNode[]
    nodes: AudioNode[]
  }
}

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext }

function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback
}

function readPreferences(): AudioPreferences {
  const defaults = {
    musicVolume: DEFAULT_MUSIC_VOLUME,
    rainVolume: DEFAULT_RAIN_VOLUME,
  }

  try {
    if (typeof window === 'undefined') return defaults
    const serialized = window.localStorage.getItem(STORAGE_KEY)
    if (!serialized) return defaults
    const saved: unknown = JSON.parse(serialized)
    if (!saved || typeof saved !== 'object') return defaults
    const values = saved as Record<string, unknown>
    return {
      musicVolume: volume(values.musicVolume, defaults.musicVolume),
      rainVolume: volume(values.rainVolume, defaults.rainVolume),
    }
  } catch {
    // Private browsing and damaged saved preferences must not prevent play.
    return defaults
  }
}

function fade(parameter: AudioParam, target: number, now: number, duration = 0.35): void {
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    parameter.cancelAndHoldAtTime(now)
  } else {
    const current = parameter.value
    parameter.cancelScheduledValues(now)
    parameter.setValueAtTime(current, now)
  }
  parameter.linearRampToValueAtTime(target, now + duration)
}

/**
 * An original, deliberately quiet rooftop soundscape, synthesized locally.
 * Volume controls use 0–1. Playback always requires enable() from a user gesture;
 * only volume preferences survive a reload, never an autoplay instruction.
 */
export function useAmbientAudio() {
  const preferences = readPreferences()
  const soundEnabled = ref(false)
  const musicVolume = ref(preferences.musicVolume)
  const rainVolume = ref(preferences.rainVolume)
  const isPlaying = ref(false)

  let engine: AmbientEngine | undefined
  let bellTimer: ReturnType<typeof setTimeout> | undefined
  let suspendTimer: ReturnType<typeof setTimeout> | undefined
  let requestedEnabled = false
  let disposed = false
  let transition = 0
  let phrasePosition = 0
  let phase: AmbientPhase = 'arrival'

  function persistPreferences(): void {
    try {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          musicVolume: musicVolume.value,
          rainVolume: rainVolume.value,
        }),
      )
    } catch {
      // Sound remains usable when storage is full or unavailable.
    }
  }

  function createEngine(): AmbientEngine | undefined {
    if (typeof window === 'undefined') return undefined
    const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext
    if (!AudioContextClass) return undefined

    const context = new AudioContextClass()
    const nodes = new Set<AudioNode>()
    const sources = new Set<AudioScheduledSourceNode>()
    const track = <T extends AudioNode>(node: T): T => {
      nodes.add(node)
      return node
    }
    const source = <T extends AudioScheduledSourceNode>(node: T): T => {
      track(node)
      sources.add(node)
      return node
    }

    try {
      const master = track(context.createGain())
      const music = track(context.createGain())
      const rain = track(context.createGain())
      const warmth = track(context.createBiquadFilter())
      master.gain.value = 0
      music.gain.value = musicVolume.value * PHASE_SCORE[phase].music
      rain.gain.value = rainVolume.value * PHASE_SCORE[phase].rain
      warmth.type = 'lowpass'
      warmth.frequency.value = 1650
      warmth.Q.value = 0.4
      music.connect(warmth)
      warmth.connect(master)
      rain.connect(master)
      master.connect(context.destination)

      // A long stereo noise bed makes a soft, distant rain curtain. The filter
      // removes low rumble and the sharp hiss that can tire a reader's ears.
      const noiseBuffer = context.createBuffer(2, context.sampleRate * 8, context.sampleRate)
      for (let channel = 0; channel < noiseBuffer.numberOfChannels; channel += 1) {
        const samples = noiseBuffer.getChannelData(channel)
        let softened = 0
        for (let index = 0; index < samples.length; index += 1) {
          const white = Math.random() * 2 - 1
          softened = softened * 0.96 + white * 0.04
          samples[index] = white * 0.52 + softened * 1.8
        }
      }
      const noise = source(context.createBufferSource())
      const rainLow = track(context.createBiquadFilter())
      const rainHigh = track(context.createBiquadFilter())
      const rainLevel = track(context.createGain())
      const weather = source(context.createOscillator())
      const weatherDepth = track(context.createGain())
      noise.buffer = noiseBuffer
      noise.loop = true
      rainLow.type = 'highpass'
      rainLow.frequency.value = 460
      rainLow.Q.value = 0.35
      rainHigh.type = 'lowpass'
      rainHigh.frequency.value = 4300
      rainHigh.Q.value = 0.35
      rainLevel.gain.value = 0.18
      weather.frequency.value = 0.031
      weatherDepth.gain.value = 0.025
      weather.connect(weatherDepth)
      weatherDepth.connect(rainLevel.gain)
      noise.connect(rainLow)
      rainLow.connect(rainHigh)
      rainHigh.connect(rainLevel)
      rainLevel.connect(rain)
      noise.start()
      weather.start()

      context.onstatechange = () => {
        isPlaying.value = requestedEnabled && context.state === 'running' && !disposed
      }
      const activeEngine = { context, master, music, rain, nodes, sources }
      startDrone(activeEngine, phase, 1.6)
      return activeEngine
    } catch {
      sources.forEach((node) => {
        try {
          node.stop()
        } catch {
          /* A source can fail before it starts. */
        }
      })
      nodes.forEach((node) => node.disconnect())
      void context.close().catch(() => undefined)
      return undefined
    }
  }

  function startDrone(activeEngine: AmbientEngine, nextPhase: AmbientPhase, seconds = 7): void {
    const { context, nodes, sources, music } = activeEngine
    const now = context.currentTime
    const previous = activeEngine.drone
    if (previous) {
      fade(previous.gain.gain, 0, now, seconds)
      let remaining = previous.sources.length
      previous.sources.forEach((source) => {
        source.onended = () => {
          sources.delete(source)
          remaining -= 1
          if (remaining === 0) {
            previous.nodes.forEach((node) => {
              node.disconnect()
              nodes.delete(node)
            })
          }
        }
        source.stop(now + seconds + 0.05)
      })
    }

    const groupGain = context.createGain()
    groupGain.gain.setValueAtTime(0, now)
    groupGain.gain.linearRampToValueAtTime(1, now + seconds)
    groupGain.connect(music)
    nodes.add(groupGain)
    const group = {
      gain: groupGain,
      sources: [] as AudioScheduledSourceNode[],
      nodes: [groupGain] as AudioNode[],
    }
    PHASE_SCORE[nextPhase].chord.forEach((frequency, index) => {
      const tone = context.createOscillator()
      const envelope = context.createGain()
      const breath = context.createOscillator()
      const depth = context.createGain()
      const pan = context.createStereoPanner()
      tone.type = 'sine'
      tone.frequency.value = frequency
      tone.detune.value = DRONE_DETUNE[index] ?? 0
      envelope.gain.value = index === 0 ? 0.055 : 0.027
      breath.type = 'sine'
      breath.frequency.value = 0.018 + index * 0.007
      depth.gain.value = 0.009
      pan.pan.value = DRONE_PAN[index] ?? 0
      breath.connect(depth)
      depth.connect(envelope.gain)
      tone.connect(envelope)
      envelope.connect(pan)
      pan.connect(groupGain)
      for (const node of [tone, envelope, breath, depth, pan]) {
        nodes.add(node)
        group.nodes.push(node)
      }
      for (const source of [tone, breath]) {
        sources.add(source)
        group.sources.push(source)
        source.start(now)
      }
    })
    activeEngine.drone = group
  }

  function playBell(activeEngine: AmbientEngine): void {
    const { context, music, nodes, sources } = activeEngine
    const now = context.currentTime
    // A small authored motif, with generous rests rather than random notes.
    const frequency = BELL_PHRASE[phrasePosition % BELL_PHRASE.length] ?? BELL_PHRASE[0]
    const envelope = context.createGain()
    const pan = context.createStereoPanner()
    nodes.add(envelope)
    nodes.add(pan)
    pan.pan.value = Math.sin(phrasePosition * 1.7) * 0.32
    envelope.gain.setValueAtTime(0.00001, now)
    envelope.gain.exponentialRampToValueAtTime(0.095, now + 0.065)
    envelope.gain.exponentialRampToValueAtTime(0.00001, now + 7.5)
    envelope.connect(pan)
    pan.connect(music)

    const harmonics = [1, 2]
    let remaining = harmonics.length
    harmonics.forEach((harmonic) => {
      const tone = context.createOscillator()
      const partial = context.createGain()
      nodes.add(tone)
      nodes.add(partial)
      sources.add(tone)
      tone.type = 'sine'
      tone.frequency.value = frequency * harmonic
      partial.gain.value = harmonic === 1 ? 1 : 0.085
      tone.connect(partial)
      partial.connect(envelope)
      tone.onended = () => {
        tone.disconnect()
        partial.disconnect()
        sources.delete(tone)
        nodes.delete(tone)
        nodes.delete(partial)
        remaining -= 1
        if (remaining === 0) {
          envelope.disconnect()
          pan.disconnect()
          nodes.delete(envelope)
          nodes.delete(pan)
        }
      }
      tone.start(now)
      tone.stop(now + 7.6)
    })
    phrasePosition += 1
  }

  function scheduleBell(delay = 2400): void {
    clearTimeout(bellTimer)
    bellTimer = setTimeout(() => {
      if (!engine || !requestedEnabled || disposed) return
      if (engine.context.state === 'running') playBell(engine)
      scheduleBell(BELL_RESTS_MS[phrasePosition % BELL_RESTS_MS.length] ?? 9300)
    }, delay)
  }

  async function enable(): Promise<void> {
    if (disposed) return
    requestedEnabled = true
    const currentTransition = ++transition
    clearTimeout(suspendTimer)

    try {
      engine ??= createEngine()
      if (!engine) {
        requestedEnabled = false
        soundEnabled.value = false
        isPlaying.value = false
        return
      }
      const activeEngine = engine
      await activeEngine.context.resume()
      if (disposed || currentTransition !== transition || !requestedEnabled) return
      if (activeEngine.context.state !== 'running') {
        requestedEnabled = false
        soundEnabled.value = false
        isPlaying.value = false
        return
      }
      fade(activeEngine.master.gain, MASTER_VOLUME, activeEngine.context.currentTime, 1.1)
      soundEnabled.value = true
      isPlaying.value = true
      scheduleBell()
    } catch {
      if (currentTransition !== transition) return
      requestedEnabled = false
      soundEnabled.value = false
      isPlaying.value = false
    }
  }

  function disable(): void {
    transition += 1
    requestedEnabled = false
    soundEnabled.value = false
    isPlaying.value = false
    clearTimeout(bellTimer)
    clearTimeout(suspendTimer)
    if (!engine || engine.context.state === 'closed') return
    const activeEngine = engine
    fade(activeEngine.master.gain, 0, activeEngine.context.currentTime, 0.65)
    suspendTimer = setTimeout(() => {
      if (!requestedEnabled && !disposed && activeEngine.context.state !== 'closed') {
        void activeEngine.context.suspend().catch(() => undefined)
      }
    }, 720)
  }

  async function toggle(): Promise<void> {
    if (requestedEnabled) disable()
    else await enable()
  }

  function setMusicVolume(value: number): void {
    musicVolume.value = volume(value, musicVolume.value)
    if (engine && engine.context.state !== 'closed') {
      fade(
        engine.music.gain,
        musicVolume.value * PHASE_SCORE[phase].music,
        engine.context.currentTime,
      )
    }
    persistPreferences()
  }

  function setRainVolume(value: number): void {
    rainVolume.value = volume(value, rainVolume.value)
    if (engine && engine.context.state !== 'closed') {
      fade(engine.rain.gain, rainVolume.value * PHASE_SCORE[phase].rain, engine.context.currentTime)
    }
    persistPreferences()
  }

  function setPhase(nextPhase: AmbientPhase): void {
    if (nextPhase === phase || !Object.hasOwn(PHASE_SCORE, nextPhase)) return
    phase = nextPhase
    if (!engine || engine.context.state === 'closed') return
    const now = engine.context.currentTime
    fade(engine.music.gain, musicVolume.value * PHASE_SCORE[phase].music, now, 7)
    fade(engine.rain.gain, rainVolume.value * PHASE_SCORE[phase].rain, now, 7)
    startDrone(engine, phase)
  }

  onUnmounted(() => {
    disposed = true
    transition += 1
    requestedEnabled = false
    soundEnabled.value = false
    isPlaying.value = false
    clearTimeout(bellTimer)
    clearTimeout(suspendTimer)
    if (!engine) return
    engine.context.onstatechange = null
    engine.sources.forEach((node) => {
      node.onended = null
      try {
        node.stop()
      } catch {
        /* An already ended source is safe to release. */
      }
    })
    engine.nodes.forEach((node) => node.disconnect())
    if (engine.context.state !== 'closed') void engine.context.close().catch(() => undefined)
    engine = undefined
  })

  return {
    soundEnabled,
    musicVolume,
    rainVolume,
    isPlaying,
    enable,
    disable,
    toggle,
    setMusicVolume,
    setRainVolume,
    setPhase,
  }
}
