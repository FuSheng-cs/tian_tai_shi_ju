<template>
  <Teleport to="body">
    <TransitionGroup
      name="achievement-toast"
      tag="div"
      class="achievement-toast-list pointer-events-none fixed right-4 top-4 z-[90] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:right-6 sm:top-6"
      aria-live="polite"
    >
      <aside
        v-for="toast in toasts"
        :key="toast.key"
        class="achievement-toast-card pointer-events-none border border-[#99909d] bg-white/95 p-4 text-gray-900 shadow-[4px_4px_0_rgba(50,45,53,0.18)]"
      >
        <div class="text-[11px] uppercase tracking-[0.22em] text-[#746478]">档案点亮</div>
        <div class="mt-1 text-base font-bold text-gray-900">{{ toast.achievement.name }}</div>
        <p class="mt-1 text-sm leading-5 text-gray-600">{{ toast.achievement.unlockText }}</p>
      </aside>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { AchievementTracker, type AchievementDefinition } from '@/modules/AchievementTracker'

interface AchievementToastItem {
  key: string;
  achievement: AchievementDefinition;
}

const TOAST_DURATION_MS = 3200
const toasts = ref<AchievementToastItem[]>([])
let nextToastId = 0
const timers = new Map<string, number>()

const removeToast = (key: string) => {
  toasts.value = toasts.value.filter((toast) => toast.key !== key)
  const timer = timers.get(key)
  if (timer) {
    window.clearTimeout(timer)
    timers.delete(key)
  }
}

const resolveAchievement = (detail: unknown) => {
  if (typeof detail === 'string') return AchievementTracker.getAchievement(detail)
  if (!detail || typeof detail !== 'object') return null

  const maybeDetail = detail as { id?: unknown; achievement?: unknown }
  if (maybeDetail.achievement && typeof maybeDetail.achievement === 'object') {
    const achievement = maybeDetail.achievement as AchievementDefinition
    if (achievement.id) return achievement
  }

  return typeof maybeDetail.id === 'string'
    ? AchievementTracker.getAchievement(maybeDetail.id)
    : null
}

const handleAchievementUnlocked = (event: Event) => {
  const achievement = resolveAchievement((event as CustomEvent).detail)
  if (!achievement) return

  const key = `${achievement.id}-${Date.now()}-${nextToastId}`
  nextToastId += 1
  toasts.value = [...toasts.value, { key, achievement }].slice(-3)
  const timer = window.setTimeout(() => removeToast(key), TOAST_DURATION_MS)
  timers.set(key, timer)
}

onMounted(() => {
  window.addEventListener('achievement-unlocked', handleAchievementUnlocked)
})

onBeforeUnmount(() => {
  window.removeEventListener('achievement-unlocked', handleAchievementUnlocked)
  for (const timer of timers.values()) {
    window.clearTimeout(timer)
  }
  timers.clear()
})
</script>

<style scoped>
.achievement-toast-enter-active,
.achievement-toast-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}

.achievement-toast-enter-from,
.achievement-toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 640px) {
  .achievement-toast-list {
    top: max(76px, calc(env(safe-area-inset-top) + 64px));
    right: 12px;
    width: min(230px, calc(100vw - 140px));
    gap: 6px;
  }

  .achievement-toast-card { padding: 8px 10px; }
  .achievement-toast-card p { font-size: 12px; line-height: 1.4; }
}

@media (prefers-reduced-motion: reduce) {
  .achievement-toast-enter-active,
  .achievement-toast-leave-active {
    transition: opacity 120ms ease;
  }

  .achievement-toast-enter-from,
  .achievement-toast-leave-to {
    transform: none;
  }
}
</style>
