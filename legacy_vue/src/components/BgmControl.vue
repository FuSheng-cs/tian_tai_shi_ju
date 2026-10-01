<template>
  <button
    class="bgm-control"
    type="button"
    :aria-label="label"
    :aria-pressed="state === 'playing'"
    @pointerup.stop
    @touchend.stop
    @keydown.stop
    @click="manager.toggleBgm()"
  >
    <Volume2 v-if="state === 'playing'" :size="16" aria-hidden="true" />
    <VolumeX v-else :size="16" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Volume2, VolumeX } from 'lucide-vue-next'
import { audioManager, type AudioManager } from '@/modules/AudioManager'

const props = defineProps<{ manager?: AudioManager }>()
const manager = props.manager ?? audioManager
const state = computed(() => manager.bgmState.value)
const label = computed(() => {
  if (state.value === 'playing') return '关闭声音'
  if (state.value === 'loading') return '音乐开启中'
  if (state.value === 'error') return '重试音乐'
  return '开启声音'
})
</script>

<style scoped>
.bgm-control {
  position: absolute;
  top: max(16px, env(safe-area-inset-top));
  right: max(16px, env(safe-area-inset-right));
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px solid rgba(216, 182, 255, 0.3);
  border-radius: 6px;
  background: rgba(8, 8, 16, 0.72);
  color: #d8b6ff;
  font-size: 12px;
  cursor: pointer;
}
.bgm-control:focus-visible { outline: 2px solid #b66cff; outline-offset: 3px; }
</style>
