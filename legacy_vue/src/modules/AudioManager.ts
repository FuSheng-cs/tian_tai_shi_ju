import { Howl, Howler } from 'howler'
import { ref } from 'vue'
import { useSettingsStore } from '@/store/settingsStore'
import { ROOFTOP_BGM_SRCS, STAIR_STEP_SFX_SRCS } from '@/domain/gameContract'

const STAIR_STEP_VOLUME_SCALE = 0.48
type AudioSource = string | readonly string[]

const normalizeAudioSources = (src: AudioSource) => (Array.isArray(src) ? [...src] : [src])
const getAudioSourceKey = (src: AudioSource) => normalizeAudioSources(src).join('|')

export class AudioManager {
  readonly bgmState = ref<'idle' | 'loading' | 'playing' | 'blocked' | 'muted' | 'error'>('idle')
  private bgm: HTMLAudioElement | null = null
  private bgmSrc: string | null = null
  private bgmMap: Record<string, HTMLAudioElement> = {}
  private sfxMap: Record<string, Howl> = {}
  private stairStepSfxKeys: string[] = []
  private nextStairStepIndex = 0
  private initialized = false
  private userMuted = false
  private playbackAttempt = 0
  private readonly resumeOnGesture = () => {
    if (this.bgmState.value === 'blocked' && this.bgm) this.requestBgmPlay()
  }

  private removeUnlockListeners() {
    document.removeEventListener('pointerup', this.resumeOnGesture)
    document.removeEventListener('keydown', this.resumeOnGesture)
    document.removeEventListener('touchend', this.resumeOnGesture)
  }

  init() {
    if (this.initialized) return
    this.initialized = true

    const settingsStore = useSettingsStore()
    Howler.volume(1.0)

    this.sfxMap.click = new Howl({
      preload: false,
      src: ['/assets/audio/ui_click.wav'],
      volume: settingsStore.sfxVolume
    })

    this.sfxMap.typewriter = new Howl({
      preload: false,
      src: ['/assets/audio/typing_click.mp3'],
      volume: settingsStore.textVolume,
      loop: false
    })

    this.stairStepSfxKeys = STAIR_STEP_SFX_SRCS.map((src, index) => {
      const key = `stair_step_${index + 1}`
      this.sfxMap[key] = new Howl({
        preload: false,
        src: [src],
        volume: settingsStore.sfxVolume * STAIR_STEP_VOLUME_SCALE,
        loop: false
      })
      return key
    })

    this.playBgm(ROOFTOP_BGM_SRCS)
  }

  preloadBgm(src: AudioSource) {
    const key = getAudioSourceKey(src)
    if (this.bgmMap[key]) return
    // Native media streams while buffering; it does not decode the whole BGM first.
    const sources = normalizeAudioSources(src).sort((a, b) =>
      Number(b.endsWith('.mp3')) - Number(a.endsWith('.mp3')))
    let sourceIndex = 0
    const audio = new Audio()
    audio.preload = 'none'
    audio.loop = true
    audio.volume = useSettingsStore().bgmVolume
    audio.addEventListener('error', () => {
      if (this.bgm !== audio) return
      if (sourceIndex + 1 < sources.length) {
        sourceIndex += 1
        audio.src = sources[sourceIndex]!
        audio.load()
        if (!this.userMuted && useSettingsStore().bgmVolume > 0) this.requestBgmPlay()
      } else {
        this.playbackAttempt += 1
        this.removeUnlockListeners()
        this.bgmState.value = 'error'
      }
    })
    audio.src = sources[0]!
    this.bgmMap[key] = audio
  }

  playBgm(src: AudioSource) {
    const key = getAudioSourceKey(src)
    if (this.userMuted) return
    if (useSettingsStore().bgmVolume === 0) {
      this.bgmState.value = 'muted'
      return
    }
    if (this.bgm && this.bgmSrc === key &&
      ['playing', 'loading', 'blocked'].includes(this.bgmState.value)) return
    if (this.bgm && this.bgmSrc !== key) this.bgm.pause()
    this.preloadBgm(src)
    this.bgm = this.bgmMap[key] ?? null
    this.bgmSrc = key
    if (!this.bgm) return
    this.requestBgmPlay()
  }

  private requestBgmPlay() {
    if (!this.bgm) return
    const attempt = ++this.playbackAttempt
    this.bgmState.value = 'loading'
    void this.bgm.play().then(() => {
      if (attempt !== this.playbackAttempt) return
      this.bgmState.value = 'playing'
      this.removeUnlockListeners()
    }).catch((error: unknown) => {
      if (attempt !== this.playbackAttempt) return
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.bgmState.value = 'blocked'
        document.addEventListener('pointerup', this.resumeOnGesture)
        document.addEventListener('keydown', this.resumeOnGesture)
        document.addEventListener('touchend', this.resumeOnGesture)
      } else {
        this.bgmState.value = 'error'
      }
    })
  }

  toggleBgm() {
    if (this.bgmState.value === 'playing' || this.bgmState.value === 'loading') {
      this.userMuted = true
      this.playbackAttempt += 1
      this.removeUnlockListeners()
      this.bgm?.pause()
      this.bgmState.value = 'muted'
    } else {
      this.userMuted = false
      if (useSettingsStore().bgmVolume === 0) useSettingsStore().bgmVolume = 0.5
      if (!this.bgm) this.playBgm(ROOFTOP_BGM_SRCS)
      else {
        this.bgm.volume = useSettingsStore().bgmVolume
        if (this.bgmState.value === 'error') this.bgm.load()
        this.requestBgmPlay()
      }
    }
  }

  stopBgm() {
    this.playbackAttempt += 1
    this.removeUnlockListeners()
    this.bgm?.pause()
    this.bgmState.value = 'idle'
  }

  playSfx(name: string) {
    const settingsStore = useSettingsStore()
    const sfx = this.sfxMap[name]
    if (sfx) {
      sfx.volume(settingsStore.sfxVolume)
      sfx.rate(1)
      if (sfx.state() === 'unloaded') sfx.load()
      sfx.play()
    }
  }

  playStairStep(stepIndex?: number) {
    const settingsStore = useSettingsStore()
    const sequenceIndex = stepIndex ?? this.nextStairStepIndex
    const stepCount = this.stairStepSfxKeys.length
    const sfxKey = this.stairStepSfxKeys[((sequenceIndex % stepCount) + stepCount) % stepCount]
    const sfx = sfxKey ? this.sfxMap[sfxKey] : null
    this.nextStairStepIndex = sequenceIndex + 1

    if (sfx) {
      sfx.volume(settingsStore.sfxVolume * STAIR_STEP_VOLUME_SCALE)
      sfx.rate(1)
      if (sfx.state() === 'unloaded') sfx.load()
      sfx.play()
    }
  }

  playTypingTick() {
    const settingsStore = useSettingsStore()
    const sfx = this.sfxMap.typewriter
    if (sfx) {
      sfx.volume(settingsStore.textVolume)
      if (sfx.state() === 'unloaded') sfx.load()
      sfx.play()
    }
  }

  updateVolumes() {
    const settingsStore = useSettingsStore()
    if (this.bgm) {
      this.bgm.volume = settingsStore.bgmVolume
      if (settingsStore.bgmVolume === 0) {
        this.stopBgm()
        this.bgmState.value = 'muted'
      } else if (!this.userMuted && this.bgmState.value === 'muted') {
        this.requestBgmPlay()
      }
    }

    Object.entries(this.sfxMap).forEach(([key, sfx]) => {
      const volumeScale =
        this.stairStepSfxKeys.includes(key) ? STAIR_STEP_VOLUME_SCALE : 1
      sfx.volume(settingsStore.sfxVolume * volumeScale)
    })

    if (this.sfxMap.typewriter) {
      this.sfxMap.typewriter.volume(settingsStore.textVolume)
    }
  }
}

export const audioManager = new AudioManager()
