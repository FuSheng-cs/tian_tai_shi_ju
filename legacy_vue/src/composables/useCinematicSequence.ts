import { computed, onMounted, onUnmounted, ref } from 'vue'

export type CinematicFrame = {
  id: string
  image: string
  mobileImage?: string
  caption: string
  chapterTitle?: string
  chapterMeta?: string
}

export const CINEMATIC_FADE_OUT_MS = 420

type CinematicSequenceOptions = {
  frames: () => readonly CinematicFrame[]
  fallbackFrame: CinematicFrame
  focusSelector: string
  skipExitDelayMs: number
  onAdvanceStep: (fromIndex: number) => void
  onLastFrameConfirm: (lastIndex: number) => void
  onSkip: (lastIndex: number) => void
  onComplete: () => void
  beforeAdvance?: (index: number) => Promise<void>
}

export const useCinematicSequence = (options: CinematicSequenceOptions) => {
  const currentIndex = ref(0)
  const isExiting = ref(false)
  let exitTimer: ReturnType<typeof window.setTimeout> | null = null
  let fadeTimer: ReturnType<typeof window.setTimeout> | null = null
  let completed = false
  let preparing = false
  let transitionVersion = 0

  const activeFrame = computed(
    () => options.frames()[currentIndex.value] ?? options.frames()[0] ?? options.fallbackFrame
  )
  const activeCaption = computed(() => activeFrame.value?.caption || '')
  const isLastFrame = computed(() => currentIndex.value >= options.frames().length - 1)

  const clearSequenceTimers = () => {
    if (exitTimer) {
      window.clearTimeout(exitTimer)
      exitTimer = null
    }
    if (fadeTimer) {
      window.clearTimeout(fadeTimer)
      fadeTimer = null
    }
  }

  const finish = () => {
    if (completed) return
    completed = true
    clearSequenceTimers()
    options.onComplete()
  }

  const scheduleExit = (delayMs = 0) => {
    if (completed || isExiting.value) return
    exitTimer = window.setTimeout(() => {
      isExiting.value = true
      fadeTimer = window.setTimeout(finish, CINEMATIC_FADE_OUT_MS)
    }, delayMs)
  }

  const advance = async () => {
    if (completed || isExiting.value || preparing) return

    if (isLastFrame.value) {
      options.onLastFrameConfirm(currentIndex.value)
      scheduleExit()
      return
    }

    const fromIndex = currentIndex.value
    const version = ++transitionVersion
    if (options.beforeAdvance) {
      preparing = true
      await options.beforeAdvance(fromIndex + 1)
      preparing = false
      if (completed || isExiting.value || version !== transitionVersion) return
    }
    currentIndex.value += 1
    options.onAdvanceStep(fromIndex)
  }

  const skip = () => {
    if (completed || isExiting.value) return
    clearSequenceTimers()
    transitionVersion += 1
    currentIndex.value = options.frames().length - 1
    options.onSkip(currentIndex.value)
    scheduleExit(options.skipExitDelayMs)
  }

  onMounted(() => {
    // Focus enables keyboard advance without adding extra visible controls.
    window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(options.focusSelector)?.focus()
    })
  })

  onUnmounted(() => {
    completed = true
    clearSequenceTimers()
  })

  return {
    currentIndex,
    isExiting,
    activeFrame,
    activeCaption,
    isLastFrame,
    advance,
    skip
  }
}
