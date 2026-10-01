<template>
  <div
    class="cinematic-sequence opening-sequence"
    :class="{ 'cinematic-sequence-exiting': isExiting }"
    role="dialog"
    aria-live="polite"
    aria-label="开场引导动画"
    tabindex="0"
    @click="advance"
    @keydown.space.prevent="advance"
    @keydown.enter.prevent="advance"
  >
    <picture
      v-for="{ frame, index } in visibleFrames"
      :key="frame.id"
      class="cinematic-frame"
      :class="{ 'cinematic-frame-active': index === currentIndex }"
    >
      <source v-if="frame.mobileImage" :srcset="frame.mobileImage" media="(max-width: 768px)" />
      <img :src="frame.image" alt="" aria-hidden="true" draggable="false"
        decoding="async" :fetchpriority="index === currentIndex ? 'high' : 'low'" />
    </picture>

    <div class="cinematic-vignette" aria-hidden="true"></div>
    <div class="cinematic-rain" aria-hidden="true"></div>
    <div class="cinematic-flash" :key="currentIndex" aria-hidden="true"></div>

    <div
      v-if="activeFrame.chapterTitle"
      :key="`chapter-${activeFrame.id}`"
      class="cinematic-chapter"
    >
      <span>{{ activeFrame.chapterTitle }}</span>
      <strong>{{ activeFrame.chapterMeta }}</strong>
    </div>

    <div class="cinematic-hud">
      <p v-if="activeCaption" class="cinematic-caption opening-caption">
        {{ activeCaption }}
      </p>
      <button type="button" class="cinematic-continue continue-button" @click.stop="advance">
        {{ isLastFrame ? '进入天台' : '继续' }}
      </button>
    </div>

    <button type="button" class="cinematic-skip skip-button" @click.stop="skip">跳过序章</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { audioManager } from '@/modules/AudioManager'
import { useCinematicSequence, type CinematicFrame } from '@/composables/useCinematicSequence'
import './cinematicSequenceOverlay.css'

defineOptions({
  name: 'OpeningSequenceOverlay'
})

const props = defineProps<{
  frames: readonly CinematicFrame[]
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const prepareFrame = async (index: number) => {
  const frame = props.frames[index]
  if (!frame) return
  const image = new Image()
  image.decoding = 'async'
  image.src = frame.mobileImage && window.matchMedia('(max-width: 768px)').matches
    ? frame.mobileImage : frame.image
  if (!image.decode) return
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      image.decode().catch(() => undefined),
      new Promise<void>((resolve) => { timeout = setTimeout(resolve, 6000) })
    ])
  } finally {
    clearTimeout(timeout)
  }
}

const { currentIndex, isExiting, activeFrame, activeCaption, isLastFrame, advance, skip } =
  useCinematicSequence({
    frames: () => props.frames,
    fallbackFrame: { id: 'opening-fallback', image: '', caption: '' },
    focusSelector: '.opening-sequence',
    skipExitDelayMs: 220,
    onAdvanceStep: (fromIndex) => audioManager.playStairStep(fromIndex),
    onLastFrameConfirm: (lastIndex) => audioManager.playStairStep(lastIndex),
    onSkip: (lastIndex) => audioManager.playStairStep(lastIndex),
    onComplete: () => emit('complete'),
    beforeAdvance: prepareFrame
  })

const visibleFrames = computed(() => props.frames
  .map((frame, index) => ({ frame, index }))
  .filter(({ index }) => Math.abs(index - currentIndex.value) <= 1))
</script>

<style scoped>
.opening-sequence {
  --cinematic-vignette-bg:
    radial-gradient(ellipse at center, transparent 42%, rgba(0, 0, 0, 0.46) 100%),
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.14) 0%,
      rgba(0, 0, 0, 0.3) 66%,
      rgba(0, 0, 0, 0.82) 100%
    );
  --cinematic-flash-bg:
    radial-gradient(ellipse at center, rgba(255, 255, 255, 0.14), transparent 52%),
    rgba(0, 0, 0, 0.32);
  --cinematic-chapter-bg: linear-gradient(90deg, rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.16));
  --cinematic-caption-bg: rgba(0, 0, 0, 0.36);
  --cinematic-control-bg: rgba(0, 0, 0, 0.38);
  --cinematic-control-hover-bg: rgba(24, 18, 32, 0.7);
}
</style>
