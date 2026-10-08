/** Private development transport. No media is created until sound is enabled. */
export type MusicTrackStatus = 'original' | 'selected' | 'loading' | 'ready' | 'error'

export interface LocalMusicTrack {
  url: string
  gain: number
}

interface AuditionOptions {
  context: AudioContext
  master: GainNode
  synthMix: GainNode
  volume: number
  canPlay: () => boolean
  onStatus: (status: MusicTrackStatus) => void
}

interface TrackVoice {
  track: LocalMusicTrack
  media: HTMLAudioElement
  source: MediaElementAudioSourceNode
  gain: GainNode
  cancelLoad?: () => void
  loadTimer?: ReturnType<typeof setTimeout>
  stallTimer?: ReturnType<typeof setTimeout>
  retireTimer?: ReturnType<typeof setTimeout>
  removeListeners: () => void
  released: boolean
}

const CROSSFADE_SECONDS = 1.2
const LOAD_TIMEOUT_MS = 12_000
const STALL_TIMEOUT_MS = 8_000
const CANCELLED = Symbol('cancelled local audition')

export function isLocalMusicTrack(url: string): boolean {
  return [
    '/__local-audio/chamomile-tea.mp3',
    '/__local-audio/home.mp3',
    '/__local-audio/late-night-earl-grey.mp3',
    '/__local-audio/peppermint-tea.mp3',
  ].includes(url)
}

function fade(
  parameter: AudioParam,
  target: number,
  now: number,
  seconds = CROSSFADE_SECONDS,
): void {
  if (typeof parameter.cancelAndHoldAtTime === 'function') {
    parameter.cancelAndHoldAtTime(now)
  } else {
    const current = parameter.value
    parameter.cancelScheduledValues(now)
    parameter.setValueAtTime(current, now)
  }
  parameter.linearRampToValueAtTime(target, now + seconds)
}

export function createLocalMusicAudition(options: AuditionOptions) {
  const { context, master, synthMix, canPlay, onStatus } = options
  const output = context.createGain()
  output.gain.value = options.volume
  output.connect(master)
  const voices = new Set<TrackVoice>()
  let selected: LocalMusicTrack | undefined
  let active: TrackVoice | undefined
  let pending: TrackVoice | undefined
  let revision = 0
  let playback = 0
  let disposed = false
  let pauseTimer: ReturnType<typeof setTimeout> | undefined

  function release(voice: TrackVoice): void {
    if (voice.released) return
    voice.released = true
    voice.cancelLoad?.()
    voice.cancelLoad = undefined
    clearTimeout(voice.loadTimer)
    clearTimeout(voice.stallTimer)
    clearTimeout(voice.retireTimer)
    voice.removeListeners()
    voice.media.pause()
    voice.media.removeAttribute('src')
    voice.media.load()
    voice.source.disconnect()
    voice.gain.disconnect()
    voices.delete(voice)
  }

  function cancelPending(): void {
    if (!pending) return
    release(pending)
    pending = undefined
  }

  function retire(voice: TrackVoice): void {
    if (!canPlay() || voice.media.paused) {
      release(voice)
      return
    }
    fade(voice.gain.gain, 0, context.currentTime)
    clearTimeout(voice.retireTimer)
    voice.retireTimer = setTimeout(() => release(voice), CROSSFADE_SECONDS * 1000 + 50)
  }

  function useOriginal(status: MusicTrackStatus): void {
    playback += 1
    cancelPending()
    active = undefined
    for (const voice of voices) retire(voice)
    fade(synthMix.gain, 1, context.currentTime)
    onStatus(status)
  }

  function makeVoice(track: LocalMusicTrack): TrackVoice {
    const media = new Audio()
    let source: MediaElementAudioSourceNode | undefined
    let gain: GainNode | undefined
    try {
      media.preload = 'auto'
      media.loop = true
      source = context.createMediaElementSource(media)
      gain = context.createGain()
      gain.gain.value = 0
      source.connect(gain)
      gain.connect(output)
      const voice: TrackVoice = {
        track,
        media,
        source,
        gain,
        removeListeners: () => undefined,
        released: false,
      }
      const failed = () => {
        if (voice.released || disposed) return
        if (pending === voice) voice.cancelLoad?.()
        // A bad candidate must not leave another file playing under its label.
        if (pending === voice || active === voice) useOriginal('error')
      }
      const waiting = () => {
        if (active !== voice || !canPlay() || voice.released) return
        if (voice.stallTimer !== undefined) return
        voice.stallTimer = setTimeout(failed, STALL_TIMEOUT_MS)
      }
      const playing = () => {
        clearTimeout(voice.stallTimer)
        voice.stallTimer = undefined
      }
      media.addEventListener('error', failed)
      media.addEventListener('waiting', waiting)
      media.addEventListener('stalled', waiting)
      media.addEventListener('playing', playing)
      voice.removeListeners = () => {
        media.removeEventListener('error', failed)
        media.removeEventListener('waiting', waiting)
        media.removeEventListener('stalled', waiting)
        media.removeEventListener('playing', playing)
      }
      voices.add(voice)
      media.src = track.url
      return voice
    } catch (error) {
      source?.disconnect()
      gain?.disconnect()
      media.pause()
      media.removeAttribute('src')
      media.load()
      throw error
    }
  }

  async function playVoice(voice: TrackVoice, selectionRevision: number): Promise<boolean> {
    voice.cancelLoad?.()
    clearTimeout(voice.loadTimer)
    const attempt = ++playback
    let cancel: (() => void) | undefined
    let loadTimer: ReturnType<typeof setTimeout> | undefined
    try {
      const cancelledOrTimedOut = new Promise<never>((_, reject) => {
        cancel = () => reject(CANCELLED)
        voice.cancelLoad = cancel
        loadTimer = setTimeout(() => reject(new Error('Local track timed out')), LOAD_TIMEOUT_MS)
        voice.loadTimer = loadTimer
      })
      // play() is called now, not from a later canplay callback, preserving the
      // explicit user's playback gesture wherever the browser requires it.
      const started = voice.media.play().then(() => {
        if (
          disposed ||
          voice.released ||
          selectionRevision !== revision ||
          attempt !== playback ||
          !canPlay()
        ) {
          voice.media.pause()
          throw CANCELLED
        }
      })
      await Promise.race([started, cancelledOrTimedOut])
      if (
        disposed ||
        voice.released ||
        selectionRevision !== revision ||
        attempt !== playback ||
        !canPlay()
      ) {
        if (!voice.released) voice.media.pause()
        return false
      }
      return true
    } catch (error) {
      if (
        error !== CANCELLED &&
        !disposed &&
        selectionRevision === revision &&
        attempt === playback
      ) {
        useOriginal('error')
      }
      return false
    } finally {
      clearTimeout(loadTimer)
      if (voice.cancelLoad === cancel) voice.cancelLoad = undefined
    }
  }

  async function resume(): Promise<void> {
    clearTimeout(pauseTimer)
    if (disposed || !selected || !canPlay()) return
    const selectionRevision = revision
    if (active?.track.url === selected.url) {
      const voice = active
      const resumed = !voice.media.paused || (await playVoice(voice, selectionRevision))
      if (resumed && selectionRevision === revision && active === voice && !disposed && canPlay()) {
        onStatus('ready')
      }
      return
    }
    cancelPending()
    let candidate: TrackVoice
    try {
      candidate = makeVoice(selected)
      pending = candidate
      onStatus('loading')
    } catch {
      useOriginal('error')
      return
    }
    if (
      !(await playVoice(candidate, selectionRevision)) ||
      selectionRevision !== revision ||
      candidate.released ||
      disposed ||
      !canPlay()
    ) {
      if (pending === candidate) pending = undefined
      release(candidate)
      return
    }
    pending = undefined
    const previous = active
    active = candidate
    fade(synthMix.gain, 0, context.currentTime)
    fade(candidate.gain.gain, candidate.track.gain, context.currentTime)
    if (previous) retire(previous)
    onStatus('ready')
  }

  async function select(track?: LocalMusicTrack): Promise<void> {
    if (disposed) return
    revision += 1
    playback += 1
    cancelPending()
    if (track && !isLocalMusicTrack(track.url)) {
      selected = undefined
      useOriginal('error')
      return
    }
    selected = track
    if (!track) {
      useOriginal('original')
      return
    }
    if (active?.track.url === track.url) {
      active.track = track
      fade(active.gain.gain, track.gain, context.currentTime)
      onStatus('ready')
      if (canPlay()) await resume()
      return
    }
    if (!canPlay()) {
      useOriginal('selected')
      return
    }
    await resume()
  }

  function pause(delayMs = 0): void {
    playback += 1
    clearTimeout(pauseTimer)
    const wasLoading = !!pending
    cancelPending()
    for (const voice of voices) {
      voice.cancelLoad?.()
      clearTimeout(voice.stallTimer)
      voice.stallTimer = undefined
    }
    if (wasLoading) onStatus(selected ? 'selected' : 'original')
    const stopMedia = () => {
      for (const voice of voices) {
        if (voice === active) voice.media.pause()
        else release(voice)
      }
    }
    if (delayMs > 0) pauseTimer = setTimeout(stopMedia, delayMs)
    else stopMedia()
  }

  function setVolume(value: number): void {
    if (!disposed) fade(output.gain, value, context.currentTime, 0.35)
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    revision += 1
    pause()
    for (const voice of voices) release(voice)
    output.disconnect()
  }

  return { select, resume, pause, setVolume, dispose }
}

export type LocalMusicAudition = ReturnType<typeof createLocalMusicAudition>
