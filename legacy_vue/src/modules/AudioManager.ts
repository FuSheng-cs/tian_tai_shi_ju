import { Howl, Howler } from 'howler'
import { useSettingsStore } from '@/store/settingsStore'
import { ROOFTOP_BGM_SRC } from '@/domain/gameContract'

class AudioManager {
  private bgm: Howl | null = null
  private bgmSrc: string | null = null
  private bgmMap: Record<string, Howl> = {}
  private sfxMap: Record<string, Howl> = {}
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

    this.sfxMap.stair_step = new Howl({
      src: ['/assets/audio/sfx_stair_step.wav'],
      volume: settingsStore.sfxVolume,
      loop: false
    })

    this.preloadBgm(ROOFTOP_BGM_SRC)
  }

  preloadBgm(src: string) {
    if (this.bgmMap[src]) return

    const settingsStore = useSettingsStore()
    this.bgmMap[src] = new Howl({
      src: [src],
      loop: true,
      preload: true,
      volume: settingsStore.bgmVolume
    })
  }

  playBgm(src: string) {
    const settingsStore = useSettingsStore()

    if (this.bgm && this.bgmSrc === src) {
      this.bgm.volume(settingsStore.bgmVolume)
      if (!this.bgm.playing()) {
        this.bgm.play()
      }
      return
    }

    if (this.bgm && this.bgmSrc !== src) {
      this.bgm.stop()
    }

    this.preloadBgm(src)
    this.bgm = this.bgmMap[src]
    this.bgmSrc = src
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
      sfx.volume(settingsStore.sfxVolume)
      sfx.rate(1)
      sfx.play()
    }
  }

  playStairStep() {
    const settingsStore = useSettingsStore()
    const sfx = this.sfxMap.stair_step
    if (sfx) {
      sfx.volume(settingsStore.sfxVolume * (0.82 + Math.random() * 0.18))
      sfx.rate(0.94 + Math.random() * 0.12)
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

    Object.values(this.sfxMap).forEach((sfx) => {
      sfx.volume(settingsStore.sfxVolume)
    })

    if (this.sfxMap.typewriter) {
      this.sfxMap.typewriter.volume(settingsStore.textVolume)
    }
  }
}

export const audioManager = new AudioManager()
