<template>
  <div
    class="dialogue-chances"
    role="img"
    :aria-label="`剩余对话机会 ${clampedValue} / ${clampedMax}`"
    data-test="dialogue-chances"
  >
    <span class="dialogue-chances__label">剩余对话</span>
    <span class="dialogue-chances__track" aria-hidden="true">
      <span
        v-for="index in chanceIndexes"
        :key="index"
        class="dialogue-chances__slot"
        :class="index <= clampedValue ? 'dialogue-chances__slot--available' : 'dialogue-chances__slot--spent'"
        :data-state="index <= clampedValue ? 'available' : 'spent'"
        data-test="dialogue-chance"
      ></span>
    </span>
    <span class="dialogue-chances__count" aria-hidden="true" data-test="dialogue-chances-count">
      {{ clampedValue }}/{{ clampedMax }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number
  max: number
}>()

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.floor(Number.isFinite(value) ? value : min), min), max)

const clampedMax = computed(() => Math.max(0, Math.floor(Number.isFinite(props.max) ? props.max : 0)))
const clampedValue = computed(() => clampNumber(props.value, 0, clampedMax.value))
const chanceIndexes = computed(() => Array.from({ length: clampedMax.value }, (_, index) => index + 1))
</script>

<style scoped>
.dialogue-chances {
  position: relative;
  display: grid;
  max-width: min(58vw, 232px);
  min-height: 48px;
  padding-bottom: 10px;
  align-items: center;
  gap: 7px;
  overflow: visible;
  line-height: 1;
}

.dialogue-chances__label {
  color: rgba(229, 231, 235, 0.72);
  font-size: 11px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}

.dialogue-chances__track {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  line-height: 0;
}

.dialogue-chances__slot {
  display: block;
  width: 15px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
  transition:
    opacity 240ms ease,
    background-color 240ms ease,
    transform 240ms ease;
}

.dialogue-chances__slot--available {
  background: #c4b5fd;
  box-shadow: 0 0 7px rgba(196, 181, 253, 0.48);
}

.dialogue-chances__slot--spent {
  opacity: 0.35;
  transform: translateY(1px);
}

.dialogue-chances__count {
  position: absolute;
  right: 1px;
  bottom: 0;
  color: rgba(229, 231, 235, 0.82);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.86);
}

@media (max-width: 640px) {
  .dialogue-chances {
    max-width: calc(100vw - 144px);
    min-height: 42px;
    gap: 5px;
  }

  .dialogue-chances__label,
  .dialogue-chances__count {
    font-size: 10px;
  }

  .dialogue-chances__slot {
    width: 11px;
  }
}
</style>
