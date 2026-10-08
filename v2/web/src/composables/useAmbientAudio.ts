import { onUnmounted, ref } from 'vue'
import {
  createLocalMusicAudition,
  isLocalMusicTrack,
  type LocalMusicAudition,
  type LocalMusicTrack,
  type MusicTrackStatus,
} from '../audio/localMusicAudition'
import {
  DRONE_DETUNE,
  DRONE_LEVELS,
  DRONE_PAN,
  KEY_ATTACK_SECONDS,
  KEY_PARTIALS,
  KEY_TAIL_SECONDS,
  nextPhraseDelay,
  PHASE_TRANSITION_SECONDS,
  PHASE_SCORE,
  PHRASE_OFFSETS_SECONDS,
  PHRASE_OPENING_SECONDS,
  PHRASE_VELOCITIES,
  phraseFor,
  ROOM_TAPS,
  type AmbientPhase,
} from '../audio/score'

const STORAGE_KEY = 'tiantaishiju:v2:ambient-audio'
const DEFAULT_MUSIC_VOLUME = 0.4
const DEFAULT_RAIN_VOLUME = 0.28
const MASTER_VOLUME = 0.55
const LOCATION_TRANSITION_SECONDS = 2.8
const LOCATION_SOUND = {
  rooftop: { rain: 1, lowpass: 18000 },
  threshold: { rain: 0.78, lowpass: 1450 },
} as const

export type AmbientLocation = keyof typeof LOCATION_SOUND

interface AudioPreferences {
  musicVolume: number
  rainVolume: number
}

interface AmbientEngine {
  context: AudioContext
  master: GainNode
  music: GainNode
  synthMix: GainNode
  rain: GainNode
  rainFilter: BiquadFilterNode
  rainShelter: GainNode
  rainShelterFilter: BiquadFilterNode
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
  const musicTrackStatus = ref<MusicTrackStatus>('original')
  const selectedMusicTrack = ref<string | undefined>()

  let engine: AmbientEngine | undefined
  let phraseTimer: ReturnType<typeof setTimeout> | undefined
  let suspendTimer: ReturnType<typeof setTimeout> | undefined
  let requestedEnabled = false
  let disposed = false
  let transition = 0
  let phrasePosition = 0
  let nextPhraseAt = PHRASE_OPENING_SECONDS
  let phase: AmbientPhase = 'arrival'
  let location: AmbientLocation = 'rooftop'
  let selectedTrack: LocalMusicTrack | undefined
  let audition: LocalMusicAudition | undefined

  function localTransport(): LocalMusicAudition | undefined {
    if (!import.meta.env.DEV || import.meta.env.VITE_LOCAL_AUDIO_AUDITION !== '1' || !engine) return
    audition ??= createLocalMusicAudition({
      context: engine.context,
      master: engine.master,
      synthMix: engine.synthMix,
      volume: musicVolume.value,
      canPlay: () =>
        requestedEnabled && !disposed && !document.hidden && engine?.context.state === 'running',
      onStatus: (status) => {
        musicTrackStatus.value = status
      },
    })
    return audition
  }

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
      const synthMix = track(context.createGain())
      master.gain.value = 0
      music.gain.value = musicVolume.value * PHASE_SCORE[phase].music
      rain.gain.value = rainVolume.value * PHASE_SCORE[phase].rain
      warmth.type = 'lowpass'
      warmth.frequency.value = 1650
      warmth.Q.value = 0.4
      synthMix.gain.value = 1
      music.connect(warmth)
      warmth.connect(synthMix)
      synthMix.connect(master)
      // Three very quiet early reflections give the keys a small, imperfect
      // room. No feedback loop, cavernous reverb or endless ringing tail.
      for (const tap of ROOM_TAPS) {
        const delay = track(context.createDelay(1))
        const level = track(context.createGain())
        const pan = track(context.createStereoPanner())
        const softened = track(context.createBiquadFilter())
        delay.delayTime.value = tap.seconds
        level.gain.value = tap.level
        pan.pan.value = tap.pan
        softened.type = 'lowpass'
        softened.frequency.value = 950
        softened.Q.value = 0.4
        warmth.connect(delay)
        delay.connect(softened)
        softened.connect(level)
        level.connect(pan)
        pan.connect(synthMix)
      }
      // Physical shelter is a separate bus from dramatic pacing. Only an
      // accepted scene location may muffle the rain; a phase cannot move her.
      const rainShelterFilter = track(context.createBiquadFilter())
      const rainShelter = track(context.createGain())
      rainShelterFilter.type = 'lowpass'
      rainShelterFilter.frequency.value = LOCATION_SOUND[location].lowpass
      rainShelterFilter.Q.value = 0.35
      rainShelter.gain.value = LOCATION_SOUND[location].rain
      rain.connect(rainShelterFilter)
      rainShelterFilter.connect(rainShelter)
      rainShelter.connect(master)
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
      rainHigh.frequency.value = PHASE_SCORE[phase].rainLowpass
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
        isPlaying.value =
          requestedEnabled && context.state === 'running' && !document.hidden && !disposed
      }
      const activeEngine = {
        context,
        master,
        music,
        synthMix,
        rain,
        rainFilter: rainHigh,
        rainShelter,
        rainShelterFilter,
        nodes,
        sources,
      }
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

  function startDrone(
    activeEngine: AmbientEngine,
    nextPhase: AmbientPhase,
    seconds = PHASE_TRANSITION_SECONDS,
  ): void {
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
      envelope.gain.value = DRONE_LEVELS[index] ?? 0.007
      breath.type = 'sine'
      breath.frequency.value = 0.018 + index * 0.007
      depth.gain.value = (DRONE_LEVELS[index] ?? 0.007) * 0.32
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

  function playKey(activeEngine: AmbientEngine, frequency: number, position: number): void {
    const { context, music, nodes, sources } = activeEngine
    const now = context.currentTime + (PHRASE_OFFSETS_SECONDS[position] ?? 0)
    const pan = context.createStereoPanner()
    nodes.add(pan)
    pan.pan.value = [-0.16, 0.12, -0.04][position] ?? 0
    pan.connect(music)

    // The upper partials decay sooner than the fundamental, as a damped key
    // does. This removes the fixed metallic overtone of the old bell voice.
    let remaining = KEY_PARTIALS.length
    KEY_PARTIALS.forEach((harmonic) => {
      const tone = context.createOscillator()
      const partial = context.createGain()
      nodes.add(tone)
      nodes.add(partial)
      sources.add(tone)
      tone.type = 'sine'
      tone.frequency.value = frequency * harmonic.ratio
      partial.gain.setValueAtTime(0.00001, now)
      partial.gain.exponentialRampToValueAtTime(
        (PHRASE_VELOCITIES[position] ?? 0.05) * harmonic.level,
        now + KEY_ATTACK_SECONDS,
      )
      partial.gain.exponentialRampToValueAtTime(0.00001, now + harmonic.tail)
      tone.connect(partial)
      partial.connect(pan)
      tone.onended = () => {
        tone.disconnect()
        partial.disconnect()
        sources.delete(tone)
        nodes.delete(tone)
        nodes.delete(partial)
        remaining -= 1
        if (remaining === 0) {
          pan.disconnect()
          nodes.delete(pan)
        }
      }
      tone.start(now)
      tone.stop(now + KEY_TAIL_SECONDS + 0.1)
    })
  }

  function schedulePhrase(): void {
    clearTimeout(phraseTimer)
    if (!engine) return
    const delay = Math.max(100, (nextPhraseAt - engine.context.currentTime) * 1000)
    phraseTimer = setTimeout(() => {
      if (!engine || !requestedEnabled || disposed) return
      if (engine.context.state === 'running' && !document.hidden) {
        phraseFor(phase, phrasePosition).forEach((frequency, index) => {
          playKey(engine!, frequency, index)
        })
        nextPhraseAt = engine.context.currentTime + nextPhraseDelay(phrasePosition)
        phrasePosition += 1
      } else {
        // A browser interruption must never create a burst of overdue notes.
        nextPhraseAt = engine.context.currentTime + PHRASE_OPENING_SECONDS
      }
      schedulePhrase()
    }, delay)
  }

  async function enable(): Promise<void> {
    if (disposed) return
    if (requestedEnabled && isPlaying.value) return
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
      if (document.hidden) {
        soundEnabled.value = true
        return
      }
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
      schedulePhrase()
      if (
        import.meta.env.DEV &&
        import.meta.env.VITE_LOCAL_AUDIO_AUDITION === '1' &&
        selectedTrack
      ) {
        const existing = audition
        const transport = localTransport()
        if (existing) await transport?.resume()
        else await transport?.select(selectedTrack)
      }
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
    clearTimeout(phraseTimer)
    clearTimeout(suspendTimer)
    audition?.pause(720)
    if (!engine || engine.context.state === 'closed') return
    const activeEngine = engine
    fade(activeEngine.master.gain, 0, activeEngine.context.currentTime, 0.65)
    suspendTimer = setTimeout(() => {
      if (!requestedEnabled && !disposed && activeEngine.context.state !== 'closed') {
        void activeEngine.context.suspend().catch(() => undefined)
      }
    }, 720)
  }

  function visibilityChanged(): void {
    if (!requestedEnabled || !engine || disposed) return
    if (!document.hidden) {
      void enable()
      return
    }
    // Keep the user's sound preference, but respect leaving the page. The
    // audio clock pauses with the context, preserving rests on return.
    transition += 1
    isPlaying.value = false
    clearTimeout(phraseTimer)
    clearTimeout(suspendTimer)
    audition?.pause(180)
    const activeEngine = engine
    fade(activeEngine.master.gain, 0, activeEngine.context.currentTime, 0.15)
    suspendTimer = setTimeout(() => {
      if (document.hidden && !disposed && activeEngine.context.state !== 'closed') {
        void activeEngine.context.suspend().catch(() => undefined)
      }
    }, 180)
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', visibilityChanged)
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
    audition?.setVolume(musicVolume.value)
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
    fade(
      engine.music.gain,
      musicVolume.value * PHASE_SCORE[phase].music,
      now,
      PHASE_TRANSITION_SECONDS,
    )
    fade(
      engine.rain.gain,
      rainVolume.value * PHASE_SCORE[phase].rain,
      now,
      PHASE_TRANSITION_SECONDS,
    )
    fade(engine.rainFilter.frequency, PHASE_SCORE[phase].rainLowpass, now, PHASE_TRANSITION_SECONDS)
    startDrone(engine, phase)
  }

  /** Call only with the server-confirmed scene location, never prose guesses. */
  function setLocation(nextLocation: AmbientLocation): void {
    if (nextLocation === location || !Object.hasOwn(LOCATION_SOUND, nextLocation)) return
    location = nextLocation
    if (!engine || engine.context.state === 'closed') return
    const now = engine.context.currentTime
    fade(engine.rainShelter.gain, LOCATION_SOUND[location].rain, now, LOCATION_TRANSITION_SECONDS)
    fade(
      engine.rainShelterFilter.frequency,
      LOCATION_SOUND[location].lowpass,
      now,
      LOCATION_TRANSITION_SECONDS,
    )
  }

  /** Explicit opt-in private development audition; never changes sound enablement. */
  async function setMusicTrack(url?: string, gain = 1): Promise<void> {
    if (!import.meta.env.DEV || import.meta.env.VITE_LOCAL_AUDIO_AUDITION !== '1' || disposed)
      return
    if (url !== undefined && !isLocalMusicTrack(url)) {
      selectedTrack = undefined
      selectedMusicTrack.value = undefined
      await audition?.select(undefined)
      musicTrackStatus.value = 'error'
      return
    }
    selectedTrack = url ? { url, gain: volume(gain, 1) } : undefined
    selectedMusicTrack.value = url
    musicTrackStatus.value = url ? 'selected' : 'original'
    const transport = audition ?? (url && engine ? localTransport() : undefined)
    await transport?.select(selectedTrack)
  }

  onUnmounted(() => {
    disposed = true
    transition += 1
    requestedEnabled = false
    soundEnabled.value = false
    isPlaying.value = false
    clearTimeout(phraseTimer)
    clearTimeout(suspendTimer)
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', visibilityChanged)
    }
    audition?.dispose()
    audition = undefined
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
    musicTrackStatus,
    selectedMusicTrack,
    enable,
    disable,
    toggle,
    setMusicVolume,
    setRainVolume,
    setPhase,
    setLocation,
    setMusicTrack,
  }
}
