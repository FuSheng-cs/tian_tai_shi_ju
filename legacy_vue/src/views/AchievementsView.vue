<template>
  <main class="achievements-view archive-scroll h-screen min-h-0 overflow-x-hidden overflow-y-scroll bg-[#050506] text-gray-100">
    <div class="fixed inset-0" aria-hidden="true">
      <picture>
        <source :srcset="ROOFTOP_BG_MOBILE" media="(max-width: 768px)" />
        <img
          :src="ROOFTOP_BG_DESKTOP"
          alt=""
          class="h-full w-full object-cover opacity-35"
        />
      </picture>
      <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,6,0.64),rgba(5,5,6,0.94))]"></div>
      <div class="absolute inset-0 bg-[repeating-linear-gradient(110deg,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_18px)] opacity-20"></div>
    </div>

    <section class="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-purple-200/70">Rain Night Archive</p>
          <h1 class="mt-2 text-3xl font-bold tracking-wide text-white md:text-4xl">雨夜档案</h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-gray-300">
            “永恒，是由一个个此刻组成的。”
          </p>
        </div>

        <div class="min-w-44 rounded border border-white/10 bg-black/45 px-4 py-3 text-right backdrop-blur">
          <div class="text-xs text-gray-500">档案完成度</div>
          <div class="mt-1 font-mono text-xl text-purple-100">已点亮 {{ progress.unlocked }} / {{ progress.total }}</div>
        </div>
      </header>

      <div class="mt-6 space-y-7 pb-10">
        <section
          v-for="group in groupedAchievements"
          :key="group.category.id"
          class="achievement-group"
          :aria-labelledby="`achievement-group-${group.category.id}`"
        >
          <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 :id="`achievement-group-${group.category.id}`" class="text-lg font-bold text-gray-100">
                {{ group.category.label }}
              </h2>
              <p class="text-sm text-gray-500">{{ group.category.description }}</p>
            </div>
            <span class="text-xs font-mono text-gray-500">
              {{ group.progress.unlocked }} / {{ group.progress.total }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="achievement in group.achievements"
              :key="achievement.id"
              class="achievement-card min-h-36 rounded border p-4 transition-colors"
              :class="isUnlocked(achievement.id)
                ? 'border-purple-300/35 bg-[#0e0c15]/88 shadow-[0_0_24px_rgba(168,85,247,0.13)]'
                : 'border-white/8 bg-black/42 text-gray-500'"
            >
              <div class="flex items-start gap-3">
                <div
                  class="grid h-11 w-11 shrink-0 place-items-center rounded border"
                  :class="isUnlocked(achievement.id)
                    ? 'border-purple-300/30 bg-purple-300/10 text-purple-100'
                    : 'border-white/10 bg-white/5 text-gray-600'"
                >
                  <component
                    :is="getAchievementIcon(achievement)"
                    :size="22"
                    :stroke-width="1.8"
                    aria-hidden="true"
                  />
                </div>

                <div class="min-w-0">
                  <div class="mb-1 text-[11px] uppercase tracking-[0.16em]" :class="isUnlocked(achievement.id) ? 'text-purple-200/70' : 'text-gray-600'">
                    {{ isUnlocked(achievement.id) ? '档案点亮' : '档案未明' }}
                  </div>
                  <h3 class="text-base font-bold" :class="isUnlocked(achievement.id) ? 'text-white' : 'text-gray-500'">
                    {{ getAchievementName(achievement) }}
                  </h3>
                  <p class="mt-2 text-sm leading-6" :class="isUnlocked(achievement.id) ? 'text-gray-300' : 'text-gray-500'">
                    {{ getAchievementDescription(achievement) }}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>

      <div class="mt-auto flex justify-center border-t border-white/10 pt-6">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded border border-white/15 bg-black/55 px-6 py-2.5 text-sm font-bold text-gray-100 transition-colors hover:border-purple-300/50 hover:bg-purple-950/35"
          @click="goBack"
        >
          <ArrowLeft :size="18" :stroke-width="1.8" aria-hidden="true" />
          返回标题
        </button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Archive,
  ArrowLeft,
  Bookmark,
  CircleAlert,
  CloudRain,
  DoorOpen,
  Ear,
  Eye,
  Feather,
  Footprints,
  Heart,
  LockKeyhole,
  MessageCircle,
  Moon,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Waves,
  Wind
} from 'lucide-vue-next'
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_ORDER,
  ACHIEVEMENTS,
  AchievementTracker,
  type AchievementDefinition
} from '@/modules/AchievementTracker'
import { audioManager } from '@/modules/AudioManager'

const router = useRouter()
const unlockedIds = ref<string[]>(AchievementTracker.getUnlocked())
const progress = ref(AchievementTracker.getProgress())
const ROOFTOP_BG_DESKTOP = '/assets/images/bg_rooftop_night_1920.webp'
const ROOFTOP_BG_MOBILE = '/assets/images/bg_rooftop_night_750.webp'

const iconMap = {
  archive: Archive,
  bookmark: Bookmark,
  cloud: CloudRain,
  door: DoorOpen,
  ear: Ear,
  eye: Eye,
  fall: CircleAlert,
  footsteps: Footprints,
  heart: Heart,
  message: MessageCircle,
  moon: Moon,
  rotate: RotateCcw,
  save: Save,
  spark: Sparkles,
  star: Star,
  thread: Feather,
  waves: Waves,
  wind: Wind
} as const

const refreshAchievements = () => {
  unlockedIds.value = AchievementTracker.getUnlocked()
  progress.value = AchievementTracker.getProgress()
}

const groupedAchievements = computed(() =>
  ACHIEVEMENT_CATEGORY_ORDER.map((categoryId) => {
    const achievements = ACHIEVEMENTS.filter((achievement) => achievement.category === categoryId)
    return {
      category: ACHIEVEMENT_CATEGORIES[categoryId],
      progress: {
        unlocked: achievements.filter((achievement) => unlockedIds.value.includes(achievement.id)).length,
        total: achievements.length
      },
      achievements
    }
  })
)

const isUnlocked = (id: string) => unlockedIds.value.includes(id)

const getAchievementName = (achievement: AchievementDefinition) =>
  isUnlocked(achievement.id) || !achievement.hidden ? achievement.name : '???'

const getAchievementDescription = (achievement: AchievementDefinition) =>
  isUnlocked(achievement.id) ? achievement.description : achievement.lockedHint

const getAchievementIcon = (achievement: AchievementDefinition) =>
  isUnlocked(achievement.id)
    ? iconMap[achievement.icon as keyof typeof iconMap] ?? Sparkles
    : LockKeyhole

const goBack = () => {
  audioManager.playSfx('click')
  router.push('/')
}

onMounted(() => {
  refreshAchievements()
  window.addEventListener('achievement-unlocked', refreshAchievements)
})

onBeforeUnmount(() => {
  window.removeEventListener('achievement-unlocked', refreshAchievements)
})
</script>

<style scoped>
.archive-scroll {
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(168, 85, 247, 0.5) rgba(5, 5, 6, 0.28);
}

.archive-scroll::-webkit-scrollbar {
  width: 10px;
}

.archive-scroll::-webkit-scrollbar-track {
  background: rgba(5, 5, 6, 0.28);
}

.archive-scroll::-webkit-scrollbar-thumb {
  background: rgba(168, 85, 247, 0.48);
  border: 2px solid rgba(5, 5, 6, 0.28);
  border-radius: 999px;
}

.archive-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(196, 181, 253, 0.68);
}
</style>
