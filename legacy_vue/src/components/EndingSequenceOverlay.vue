<template>
  <div
    class="cinematic-sequence ending-sequence"
    :class="{ 'cinematic-sequence-exiting': isExiting }"
    role="dialog"
    aria-live="polite"
    :aria-label="ariaLabel"
    tabindex="0"
    @click="advance"
    @keydown.space.prevent="advance"
    @keydown.enter.prevent="advance"
  >
    <picture
      v-for="(frame, index) in frames"
      :key="frame.id"
      class="cinematic-frame"
      :class="{ 'cinematic-frame-active': index === currentIndex }"
    >
      <source v-if="frame.mobileImage" :srcset="frame.mobileImage" media="(max-width: 768px)" />
      <img :src="frame.image" alt="" aria-hidden="true" draggable="false" />
    </picture>

    <div class="cinematic-vignette" aria-hidden="true"></div>
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
      <p v-if="activeCaption" class="cinematic-caption ending-sequence-caption">
        {{ activeCaption }}
      </p>
      <button
        type="button"
        class="cinematic-continue ending-sequence-continue"
        @click.stop="advance"
      >
        {{ isLastFrame ? completeLabel : nextLabel }}
      </button>
    </div>

    <button type="button" class="cinematic-skip ending-sequence-skip" @click.stop="skip">
      {{ skipLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { audioManager } from '@/modules/AudioManager'
import { useCinematicSequence, type CinematicFrame } from '@/composables/useCinematicSequence'
import './cinematicSequenceOverlay.css'

defineOptions({
  name: 'EndingSequenceOverlay'
})

const props = withDefaults(
  defineProps<{
    frames: readonly CinematicFrame[]
    ariaLabel?: string
    nextLabel?: string
    completeLabel?: string
    skipLabel?: string
  }>(),
  {
    ariaLabel: '结局镜头',
    nextLabel: '继续',
    completeLabel: '查看结局',
    skipLabel: '跳过镜头'
  }
)

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const { currentIndex, isExiting, activeFrame, activeCaption, isLastFrame, advance, skip } =
  useCinematicSequence({
    frames: () => props.frames,
    fallbackFrame: { id: 'ending-fallback', image: '', caption: '' },
    focusSelector: '.ending-sequence',
    skipExitDelayMs: 900,
    onAdvanceStep: () => {
      audioManager.playSfx('click')
    },
    onLastFrameConfirm: () => audioManager.playSfx('click'),
    onSkip: () => audioManager.playSfx('click'),
    onComplete: () => emit('complete')
  })
</script>

<style scoped>
.ending-sequence {
  --cinematic-vignette-bg:
    radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.52) 100%),
    linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.18) 0%,
      rgba(0, 0, 0, 0.34) 64%,
      rgba(0, 0, 0, 0.86) 100%
    );
  --cinematic-flash-bg: rgba(0, 0, 0, 0.58);
  --cinematic-chapter-bg: linear-gradient(90deg, rgba(0, 0, 0, 0.62), rgba(0, 0, 0, 0.16));
  --cinematic-caption-bg: rgba(0, 0, 0, 0.4);
  --cinematic-control-bg: rgba(0, 0, 0, 0.42);
  --cinematic-control-hover-bg: rgba(24, 18, 32, 0.72);
}
</style>
