<template>
  <main class="achievements-view archive-scroll h-screen min-h-0 overflow-x-hidden overflow-y-scroll bg-[#f7f7f7] text-gray-900">
    <div class="fixed inset-0" aria-hidden="true">
      <picture>
        <source :srcset="ROOFTOP_BG_MOBILE" media="(max-width: 768px)" />
        <img
          :src="ROOFTOP_BG_DESKTOP"
          alt=""
          class="h-full w-full object-cover opacity-20"
        />
      </picture>
      <div class="absolute inset-0 bg-white/75"></div>
    </div>

    <section class="relative z-10 mx-auto flex min-h-full w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header class="flex flex-col gap-4 border-b border-gray-400 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs tracking-[0.18em] text-gray-600">天台十句</p>
          <h1 class="mt-2 text-3xl font-bold tracking-wide text-gray-900 md:text-4xl">雨夜档案</h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-gray-700">
            “永恒，是由一个个此刻组成的。”
          </p>
        </div>

        <div class="min-w-44 border border-gray-400 bg-white/90 px-4 py-3 text-right">
          <div class="text-xs text-gray-500">档案完成度</div>
          <div class="mt-1 font-mono text-xl text-gray-900">已点亮 {{ progress.unlocked }} / {{ progress.total }}</div>
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
              <h2 :id="`achievement-group-${group.category.id}`" class="text-lg font-bold text-gray-900">
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
                ? 'border-[#958899] bg-white/95'
                : 'border-gray-300 bg-gray-100/95 text-gray-600'"
            >
              <div class="flex items-start gap-3">
                <div
                  class="grid h-11 w-11 shrink-0 place-items-center rounded border"
                  :class="isUnlocked(achievement.id)
                    ? 'border-[#afa2b1] bg-[#eee9f0] text-[#625969]'
                    : 'border-gray-300 bg-white text-gray-600'"
                >
                  <PixelIcon :name="getAchievementIcon(achievement)" />
                </div>

                <div class="min-w-0">
                  <div class="mb-1 text-[11px] uppercase tracking-[0.16em]" :class="isUnlocked(achievement.id) ? 'text-[#655969]' : 'text-gray-600'">
                    {{ isUnlocked(achievement.id) ? '档案点亮' : '档案未明' }}
                  </div>
                  <h3 class="text-base font-bold" :class="isUnlocked(achievement.id) ? 'text-gray-900' : 'text-gray-600'">
                    {{ getAchievementName(achievement) }}
                  </h3>
                  <p class="mt-2 text-sm leading-6" :class="isUnlocked(achievement.id) ? 'text-gray-700' : 'text-gray-600'">
                    {{ getAchievementDescription(achievement) }}
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>

      <div class="mt-auto flex justify-center border-t border-gray-400 pt-6">
        <button
          type="button"
          class="inline-flex items-center gap-2 border border-gray-500 bg-white px-6 py-2.5 text-sm font-bold text-gray-900 transition-colors hover:border-[#87768d] hover:bg-[#f1edf2]"
          @click="goBack"
        >
          <PixelIcon name="arrow_left" class="h-[18px] w-[18px]" />
          返回标题
        </button>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '@/components/PixelIcon.vue'
import { CG_ASSETS } from '@/domain/cgAssets.generated'
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_ORDER,
  ACHIEVEMENTS,
  AchievementTracker,
  type AchievementDefinition
} from '@/modules/AchievementTracker'

const router = useRouter()
const unlockedIds = ref<string[]>(AchievementTracker.getUnlocked())
const progress = ref(AchievementTracker.getProgress())
const ROOFTOP_BG_DESKTOP = CG_ASSETS['ending/death_05'].image
const ROOFTOP_BG_MOBILE = CG_ASSETS['ending/death_05'].mobileImage

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
  isUnlocked(achievement.id) ? achievement.icon : 'lock'

const goBack = () => {
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
  scrollbar-color: #8e8492 #eeeeee;
}

.achievements-view picture img { image-rendering: pixelated; }

.archive-scroll::-webkit-scrollbar {
  width: 10px;
}

.archive-scroll::-webkit-scrollbar-track {
  background: #eeeeee;
}

.archive-scroll::-webkit-scrollbar-thumb {
  background: #8e8492;
  border: 2px solid #eeeeee;
  border-radius: 999px;
}

.archive-scroll::-webkit-scrollbar-thumb:hover {
  background: #6f6275;
}
</style>
