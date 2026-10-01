<template>
  <div class="progressive-image" :aria-busy="!ready && !failed"
    :data-original-ready="originalReady">
    <picture v-if="preview" class="cg-preview" :class="{ 'cg-preview-hidden': ready }" aria-hidden="true">
      <img :src="preview" alt="" aria-hidden="true" decoding="async"
        fetchpriority="high" :class="imageClass" :style="{ objectFit: fit }" />
    </picture>
    <picture v-if="loadOriginal" class="cg-original" :class="{ 'cg-original-ready': originalReady }">
      <img :key="highQualitySrc" ref="originalImage" :src="highQualitySrc" alt=""
        aria-hidden="true" decoding="async" draggable="false" fetchpriority="auto"
        :class="imageClass" :style="{ objectFit: fit }"
        @load="showOriginal" @error="originalFailed = true" />
    </picture>
    <button v-if="ready && highQualitySrc && saveData && !forceOriginal && !originalReady"
      class="cg-quality-button" type="button" @click.stop="forceOriginal = true">
      加载原画
    </button>
    <picture class="cg-full" :class="{
      'cg-ready': ready, 'cg-failed': failed, 'cg-display-hidden': originalReady
    }">
      <source v-if="mobileSrc" :srcset="mobileSrc" media="(max-width: 768px)" />
      <img :key="`${src}|${mobileSrc}`" ref="fullImage" :src="src" :alt="alt"
        :class="imageClass"
        :aria-hidden="alt ? undefined : true" decoding="async" draggable="false"
        :fetchpriority="priority" :style="{ objectFit: fit }"
        @load="showFullImage" @error="failed = true" />
    </picture>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  mobileSrc?: string
  preview?: string
  alt?: string
  fit?: 'cover' | 'contain'
  priority?: 'high' | 'low' | 'auto'
  imageClass?: string
  highQualitySrc?: string
}>(), { alt: '', fit: 'cover', priority: 'high' })

const ready = ref(false)
const failed = ref(false)
const fullImage = ref<HTMLImageElement | null>(null)
const originalImage = ref<HTMLImageElement | null>(null)
const originalReady = ref(false)
const originalFailed = ref(false)
const forceOriginal = ref(false)
const saveData = Boolean((navigator as Navigator & {
  connection?: { saveData?: boolean }
}).connection?.saveData)
const loadOriginal = computed(() => ready.value && props.highQualitySrc &&
  props.priority !== 'low' && !originalFailed.value && (!saveData || forceOriginal.value))
let version = 0
watch(() => [props.src, props.mobileSrc, props.highQualitySrc], () => {
  version += 1
  ready.value = false
  failed.value = false
  originalReady.value = false
  originalFailed.value = false
  forceOriginal.value = false
})
const emit = defineEmits<{ (event: 'original-ready'): void }>()
const showOriginal = async () => {
  const current = version
  const image = originalImage.value
  if (image?.decode) await image.decode().catch(() => undefined)
  if (current === version && image === originalImage.value) {
    originalReady.value = true
    emit('original-ready')
  }
}
const showFullImage = async () => {
  const current = version
  const image = fullImage.value
  if (image?.decode) await image.decode().catch(() => undefined)
  if (current === version) ready.value = true
}
onMounted(() => {
  if (fullImage.value?.complete && fullImage.value.naturalWidth > 0) void showFullImage()
})
</script>

<style scoped>
.progressive-image { position: absolute; inset: 0; width: 100%; height: 100%; }
.cg-preview, .cg-full, .cg-original { position: absolute; inset: 0; display: block; }
img { width: 100%; height: 100%; }
.cg-preview img { image-rendering: pixelated; }
.cg-preview { opacity: 1; transition: opacity 160ms ease; }
.cg-preview-hidden { opacity: 0; }
.cg-full { opacity: 0; transition: opacity 160ms ease; }
.cg-ready { opacity: 1; }
.cg-display-hidden { opacity: 0; }
.cg-failed { display: none; }
.cg-original { opacity: 0; transition: opacity 160ms ease; }
.cg-original-ready { opacity: 1; }
.cg-original img { image-rendering: pixelated; }
.cg-quality-button {
  position: absolute; right: 16px; top: 88px; z-index: 5;
  pointer-events: auto;
  padding: 8px 12px; border: 1px solid #777; border-radius: 4px;
  color: #ddd; background: #111c; font-size: 12px;
}
@media (prefers-reduced-motion: reduce) {
  .cg-full, .cg-preview, .cg-original { transition: none; }
}
</style>
