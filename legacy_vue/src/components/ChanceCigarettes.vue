<template>
  <div
    class="chance-cigarettes"
    role="img"
    :aria-label="`剩余机会 ${clampedValue} / ${clampedMax}`"
    data-test="chance-cigarettes"
  >
    <span class="sr-only">剩余机会 {{ clampedValue }} / {{ clampedMax }}</span>
    <span class="chance-cigarettes__label" aria-hidden="true">剩余次数</span>
    <span class="chance-cigarettes__row" aria-hidden="true">
      <span
        v-for="index in cigaretteIndexes"
        :key="index"
        class="chance-cigarettes__slot"
        :class="isLit(index) ? 'chance-cigarettes__slot--lit' : 'chance-cigarettes__slot--spent'"
        :data-state="isLit(index) ? 'lit' : 'spent'"
        data-test="chance-cigarette"
      >
        <img
          class="chance-cigarettes__image"
          :src="CIGARETTE_CHANCE_IMAGE"
          alt=""
          draggable="false"
        />
      </span>
    </span>
    <span class="chance-cigarettes__count" aria-hidden="true" data-test="chance-cigarettes-count">
      {{ clampedValue }}/{{ clampedMax }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const CIGARETTE_CHANCE_IMAGE = '/assets/images/ui_cigarette_chance.webp'

const props = defineProps<{
  value: number;
  max: number;
}>()

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(Math.floor(Number.isFinite(value) ? value : min), min), max)

const clampedMax = computed(() => Math.max(0, Math.floor(Number.isFinite(props.max) ? props.max : 0)))
const clampedValue = computed(() => clampNumber(props.value, 0, clampedMax.value))
const cigaretteIndexes = computed(() => Array.from({ length: clampedMax.value }, (_, index) => index + 1))
const isLit = (index: number) => index <= clampedValue.value
</script>

<style scoped>
.chance-cigarettes {
  --cigarette-size: 21px;

  position: relative;
  display: grid;
  max-width: min(58vw, 232px);
  min-height: 48px;
  padding-bottom: 10px;
  align-items: center;
  gap: 3px;
  overflow: visible;
  line-height: 1;
}

.chance-cigarettes__label {
  color: rgba(229, 231, 235, 0.72);
  font-size: 11px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}

.chance-cigarettes__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1px;
  line-height: 0;
}

.chance-cigarettes__count {
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

.chance-cigarettes__slot {
  display: grid;
  width: var(--cigarette-size);
  height: var(--cigarette-size);
  flex: 0 0 var(--cigarette-size);
  place-items: center;
  transition:
    opacity 360ms ease,
    filter 360ms ease,
    transform 360ms ease;
}

.chance-cigarettes__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
}

.chance-cigarettes__slot--lit {
  filter:
    drop-shadow(0 0 3px rgba(255, 236, 189, 0.95))
    drop-shadow(0 0 7px rgba(255, 196, 94, 0.48));
  opacity: 1;
}

.chance-cigarettes__slot--spent {
  filter: grayscale(1) brightness(0.42) contrast(0.9);
  opacity: 0.34;
  transform: translateY(1px);
}

@media (max-width: 640px) {
  .chance-cigarettes {
    --cigarette-size: 16px;

    max-width: calc(100vw - 144px);
    min-height: 42px;
    padding-bottom: 9px;
    gap: 2px;
  }

  .chance-cigarettes__label {
    font-size: 10px;
  }

  .chance-cigarettes__count {
    font-size: 10px;
  }

  .chance-cigarettes__row {
    gap: 0;
  }
}
</style>
