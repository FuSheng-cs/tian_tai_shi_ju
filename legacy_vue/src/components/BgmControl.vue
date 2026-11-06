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
    <PixelIcon :name="state === 'playing' ? 'volume' : 'volume_off'" class="h-4 w-4" />
    <span>{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PixelIcon from '@/components/PixelIcon.vue'
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
  border: 1px solid #aaa5b0;
  border-radius: 0;
  background: rgb(251 251 251 / 90%);
  color: #34313a;
  font-size: 12px;
  cursor: pointer;
}
.bgm-control:focus-visible { outline: 2px solid #74647f; outline-offset: 3px; }
</style>
