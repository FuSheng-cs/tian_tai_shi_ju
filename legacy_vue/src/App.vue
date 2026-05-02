<template>
  <router-view v-slot="{ Component }">
    <transition name="fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
  <AchievementToast />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useSettingsStore } from '@/store/settingsStore'
import { audioManager } from '@/modules/AudioManager'
import AchievementToast from '@/components/AchievementToast.vue'

const settings = useSettingsStore()

onMounted(() => {
  settings.applyTheme()
  audioManager.init()
})
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
