<template>
  <div
    class="opening-sequence"
    :class="{ 'opening-sequence-exiting': isExiting }"
    role="dialog"
    aria-live="polite"
    aria-label="开场引导动画"
    tabindex="0"
    @click="advance"
    @keydown.space.prevent="advance"
    @keydown.enter.prevent="advance"
  >
    <img
      v-for="(frame, index) in frames"
      :key="frame.id"
      class="opening-frame"
      :class="{ 'opening-frame-active': index === currentIndex }"
      :src="frame.image"
      alt=""
      aria-hidden="true"
      draggable="false"
    />

    <div class="opening-vignette" aria-hidden="true"></div>
    <div class="opening-rain" aria-hidden="true"></div>
    <div class="opening-flash" :key="currentIndex" aria-hidden="true"></div>

    <div v-if="activeFrame.chapterTitle" :key="`chapter-${activeFrame.id}`" class="chapter-card">
      <span>{{ activeFrame.chapterTitle }}</span>
      <strong>{{ activeFrame.chapterMeta }}</strong>
    </div>

    <div class="opening-hud">
      <p v-if="activeCaption" class="opening-caption">
        {{ activeCaption }}
      </p>
      <button type="button" class="continue-button" @click.stop="advance">
        {{ isLastFrame ? '进入天台' : '继续' }}
      </button>
    </div>

    <button type="button" class="skip-button" @click.stop="skip">
      跳过序章
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { audioManager } from '@/modules/AudioManager'

type OpeningFrame = {
  id: string;
  image: string;
  caption: string;
  chapterTitle?: string;
  chapterMeta?: string;
}

defineOptions({
  name: 'OpeningSequenceOverlay'
})

const props = defineProps<{
  frames: readonly OpeningFrame[];
}>()

const emit = defineEmits<{
  (e: 'complete'): void;
}>()

const currentIndex = ref(0)
const isExiting = ref(false)
const fallbackFrame: OpeningFrame = { id: 'opening-fallback', image: '', caption: '' }
let exitTimer: ReturnType<typeof window.setTimeout> | null = null
let fadeTimer: ReturnType<typeof window.setTimeout> | null = null
let completed = false

const activeFrame = computed(() => props.frames[currentIndex.value] ?? props.frames[0] ?? fallbackFrame)
const activeCaption = computed(() => activeFrame.value?.caption || '')
const isLastFrame = computed(() => currentIndex.value >= props.frames.length - 1)

const clearManagedTimers = () => {
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
  clearManagedTimers()
  emit('complete')
}

const scheduleExit = (delayMs = 0) => {
  if (completed || isExiting.value) return
  exitTimer = window.setTimeout(() => {
    isExiting.value = true
    fadeTimer = window.setTimeout(finish, 420)
  }, delayMs)
}

const advance = () => {
  if (completed || isExiting.value) return

  if (isLastFrame.value) {
    scheduleExit()
    return
  }

  currentIndex.value += 1
  audioManager.playStairStep()
}

const skip = () => {
  if (completed) return
  clearManagedTimers()
  currentIndex.value = props.frames.length - 1
  audioManager.playStairStep()
  scheduleExit(220)
}

onMounted(() => {
  // Focus enables keyboard advance without adding extra visible controls.
  window.requestAnimationFrame(() => {
    const activeElement = document.querySelector<HTMLElement>('.opening-sequence')
    activeElement?.focus()
  })
})

onUnmounted(() => {
  clearManagedTimers()
})
</script>

<style scoped>
.opening-sequence {
  position: absolute;
  inset: 0;
  z-index: 60;
  overflow: hidden;
  background: #020203;
  color: rgba(244, 241, 248, 0.92);
  pointer-events: auto;
  opacity: 1;
  transition: opacity 420ms ease;
  outline: none;
}

.opening-sequence::before,
.opening-sequence::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  z-index: 3;
  height: clamp(42px, 9vh, 92px);
  pointer-events: none;
  background: #020203;
}

.opening-sequence::before {
  top: 0;
}

.opening-sequence::after {
  bottom: 0;
}

.opening-sequence-exiting {
  opacity: 0;
}

.opening-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0;
  transform: none;
  transition: opacity 520ms ease;
  filter: contrast(1.08) brightness(0.82);
}

.opening-frame-active {
  opacity: 1;
  transform: none;
}

.opening-vignette {
  position: absolute;
  inset: 0;
  z-index: 2;
  background:
    radial-gradient(ellipse at center, transparent 42%, rgba(0, 0, 0, 0.46) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.14) 0%, rgba(0, 0, 0, 0.3) 66%, rgba(0, 0, 0, 0.82) 100%);
}

.opening-rain {
  position: absolute;
  inset: -12%;
  z-index: 2;
  opacity: 0.18;
  background:
    repeating-linear-gradient(
      105deg,
      rgba(255, 255, 255, 0) 0 18px,
      rgba(255, 255, 255, 0.18) 19px,
      rgba(255, 255, 255, 0) 21px
    );
  transform: translate3d(-4%, -4%, 0);
  animation: rain-sweep 520ms linear infinite;
  mix-blend-mode: screen;
}

.opening-flash {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background:
    radial-gradient(ellipse at center, rgba(255, 255, 255, 0.14), transparent 52%),
    rgba(0, 0, 0, 0.32);
  animation: frame-flash 560ms ease-out forwards;
}

.chapter-card {
  position: absolute;
  z-index: 5;
  left: clamp(22px, 5vw, 74px);
  top: clamp(58px, 12vh, 126px);
  display: grid;
  gap: 8px;
  padding: 13px 16px 15px;
  color: rgba(246, 243, 250, 0.92);
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.58), rgba(0, 0, 0, 0.16));
  border-left: 2px solid rgba(238, 232, 248, 0.72);
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.96);
  animation: chapter-enter 2400ms ease both;
}

.chapter-card span {
  color: rgba(222, 214, 236, 0.72);
  font-size: clamp(0.78rem, 1.2vw, 0.95rem);
  line-height: 1;
}

.chapter-card strong {
  font-size: clamp(1rem, 1.75vw, 1.45rem);
  font-weight: 700;
  line-height: 1.2;
}

.opening-hud {
  position: absolute;
  z-index: 5;
  left: clamp(18px, 4vw, 56px);
  right: clamp(18px, 4vw, 56px);
  bottom: clamp(76px, 12vh, 118px);
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
}

.opening-caption {
  max-width: min(620px, 66vw);
  margin: 0;
  padding: 9px 13px;
  color: rgba(246, 243, 250, 0.88);
  background: rgba(0, 0, 0, 0.36);
  border-left: 1px solid rgba(226, 219, 238, 0.58);
  font-size: clamp(0.86rem, 1.25vw, 1.02rem);
  line-height: 1.55;
  text-shadow: 0 2px 14px rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(8px);
}

.continue-button {
  flex: 0 0 auto;
  padding: 9px 14px;
  color: rgba(246, 243, 250, 0.88);
  background: rgba(0, 0, 0, 0.38);
  border: 1px solid rgba(226, 219, 238, 0.34);
  border-radius: 6px;
  font-size: 0.86rem;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.continue-button:hover,
.continue-button:focus-visible {
  color: #fff;
  background: rgba(24, 18, 32, 0.7);
  border-color: rgba(226, 211, 246, 0.68);
}

.skip-button {
  position: absolute;
  z-index: 6;
  top: clamp(18px, 4vw, 32px);
  right: clamp(18px, 4vw, 36px);
  padding: 8px 12px;
  color: rgba(239, 234, 246, 0.78);
  background: rgba(0, 0, 0, 0.38);
  border: 1px solid rgba(224, 213, 242, 0.28);
  border-radius: 6px;
  font-size: 0.86rem;
  transition:
    color 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease;
}

.skip-button:hover,
.skip-button:focus-visible {
  color: #fff;
  background: rgba(24, 18, 32, 0.7);
  border-color: rgba(226, 211, 246, 0.68);
}

@keyframes frame-flash {
  0% {
    opacity: 1;
  }
  58% {
    opacity: 0.24;
  }
  100% {
    opacity: 0;
  }
}

@keyframes chapter-enter {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  16%,
  82% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@keyframes rain-sweep {
  0% {
    transform: translate3d(-4%, -4%, 0);
  }
  100% {
    transform: translate3d(4%, 4%, 0);
  }
}

@media (max-width: 640px) {
  .opening-frame {
    object-fit: cover;
  }

  .opening-hud {
    align-items: flex-start;
    flex-direction: column;
    bottom: 72px;
    gap: 10px;
  }

  .opening-caption {
    max-width: 100%;
    font-size: 0.92rem;
  }

  .chapter-card {
    top: 76px;
    left: 18px;
    right: 74px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .opening-frame,
  .opening-frame-active,
  .opening-rain,
  .opening-flash {
    animation: none;
    transition: none;
    transform: none;
  }
}
</style>
