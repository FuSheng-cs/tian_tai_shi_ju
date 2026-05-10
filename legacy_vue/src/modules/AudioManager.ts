import { Howl, Howler } from 'howler'
import { useSettingsStore } from '@/store/settingsStore'
import { FALL_IMPACT_SFX_SRC, ROOFTOP_BGM_SRCS, STAIR_STEP_SFX_SRCS } from '@/domain/gameContract'

const STAIR_STEP_VOLUME_SCALE = 0.48
const FALL_IMPACT_VOLUME_SCALE = 0.82
const FALL_IMPACT_SFX_KEY = 'fall_impact'
type AudioSource = string | readonly string[]

const normalizeAudioSources = (src: AudioSource) => Array.isArray(src) ? [...src] : [src]
const getAudioSourceKey = (src: AudioSource) => normalizeAudioSources(src).join('|')

class AudioManager {
  private bgm: Howl | null = null
  private bgmSrc: string | null = null
  private bgmMap: Record<string, Howl> = {}
  private sfxMap: Record<string, Howl> = {}
  private stairStepSfxKeys: string[] = []
  private nextStairStepIndex = 0
  private initialized = false

  init() {
    if (this.initialized) return
    this.initialized = true

    const settingsStore = useSettingsStore()
    Howler.volume(1.0)

    this.sfxMap.click = new Howl({
      src: ['/assets/audio/ui_click.wav'],
      volume: settingsStore.sfxVolume
    })

    this.sfxMap.typewriter = new Howl({
      src: ['/assets/audio/typing_click.mp3'],
      volume: settingsStore.textVolume,
      loop: false
    })

    this.sfxMap[FALL_IMPACT_SFX_KEY] = new Howl({
      src: [FALL_IMPACT_SFX_SRC],
      volume: settingsStore.sfxVolume * FALL_IMPACT_VOLUME_SCALE,
      loop: false
    })

    this.stairStepSfxKeys = STAIR_STEP_SFX_SRCS.map((src, index) => {
      const key = `stair_step_${index + 1}`
      this.sfxMap[key] = new Howl({
        src: [src],
        volume: settingsStore.sfxVolume * STAIR_STEP_VOLUME_SCALE,
        loop: false
      })
      return key
    })

    this.preloadBgm(ROOFTOP_BGM_SRCS)
  }

  preloadBgm(src: AudioSource) {
    const key = getAudioSourceKey(src)
    if (this.bgmMap[key]) return

    const settingsStore = useSettingsStore()
    this.bgmMap[key] = new Howl({
      src: normalizeAudioSources(src),
      loop: true,
      preload: true,
      volume: settingsStore.bgmVolume
    })
  }

  playBgm(src: AudioSource) {
    const settingsStore = useSettingsStore()
    const key = getAudioSourceKey(src)

    if (this.bgm && this.bgmSrc === key) {
      this.bgm.volume(settingsStore.bgmVolume)
      if (!this.bgm.playing()) {
        this.bgm.play()
      }
      return
    }

    if (this.bgm && this.bgmSrc !== key) {
      this.bgm.stop()
    }

    this.preloadBgm(src)
    this.bgm = this.bgmMap[key]
    this.bgmSrc = key
    this.bgm.loop(true)
    this.bgm.volume(settingsStore.bgmVolume)
    this.bgm.play()
  }

  stopBgm() {
    if (this.bgm) {
      this.bgm.stop()
    }
  }

  playSfx(name: string) {
    const settingsStore = useSettingsStore()
    const sfx = this.sfxMap[name]
    if (sfx) {
      const volumeScale = name === FALL_IMPACT_SFX_KEY ? FALL_IMPACT_VOLUME_SCALE : 1
      sfx.volume(settingsStore.sfxVolume * volumeScale)
      sfx.rate(1)
      sfx.play()
    }
  }

  playStairStep(stepIndex?: number) {
    const settingsStore = useSettingsStore()
    const sequenceIndex = stepIndex ?? this.nextStairStepIndex
    const sfxKey = this.stairStepSfxKeys[
      ((sequenceIndex % this.stairStepSfxKeys.length) + this.stairStepSfxKeys.length) % this.stairStepSfxKeys.length
    ]
    const sfx = sfxKey ? this.sfxMap[sfxKey] : null
    this.nextStairStepIndex = sequenceIndex + 1

    if (sfx) {
      sfx.volume(settingsStore.sfxVolume * STAIR_STEP_VOLUME_SCALE)
      sfx.rate(1)
      sfx.play()
    }
  }

  playTypingTick() {
    const settingsStore = useSettingsStore()
    const sfx = this.sfxMap.typewriter
    if (sfx) {
      sfx.volume(settingsStore.textVolume)
      sfx.play()
    }
  }

  startTypewriter() {}
  stopTypewriter() {}

  updateVolumes() {
    const settingsStore = useSettingsStore()
    if (this.bgm) {
      this.bgm.volume(settingsStore.bgmVolume)
    }

    Object.entries(this.sfxMap).forEach(([key, sfx]) => {
      const volumeScale = key === FALL_IMPACT_SFX_KEY
        ? FALL_IMPACT_VOLUME_SCALE
        : this.stairStepSfxKeys.includes(key)
          ? STAIR_STEP_VOLUME_SCALE
          : 1
      sfx.volume(settingsStore.sfxVolume * volumeScale)
    })

    if (this.sfxMap.typewriter) {
      this.sfxMap.typewriter.volume(settingsStore.textVolume)
    }
  }
}

export const audioManager = new AudioManager()
