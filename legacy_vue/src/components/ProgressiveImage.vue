<template>
  <div class="progressive-image" :aria-busy="!ready && !failed">
    <picture v-if="preview" class="cg-preview" :class="{ 'cg-preview-hidden': ready }" aria-hidden="true">
      <img :src="preview" alt="" aria-hidden="true" decoding="async"
        fetchpriority="high" :class="imageClass" :style="{ objectFit: fit }" />
    </picture>
    <picture class="cg-full" :class="{ 'cg-ready': ready, 'cg-failed': failed }">
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
import { onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  src: string
  mobileSrc?: string
  preview?: string
  alt?: string
  fit?: 'cover' | 'contain'
  priority?: 'high' | 'low' | 'auto'
  imageClass?: string
}>(), { alt: '', fit: 'cover', priority: 'high' })

const ready = ref(false)
const failed = ref(false)
const fullImage = ref<HTMLImageElement | null>(null)
let version = 0
watch(() => [props.src, props.mobileSrc], () => {
  version += 1
  ready.value = false
  failed.value = false
})
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
.cg-preview, .cg-full { position: absolute; inset: 0; display: block; }
img { width: 100%; height: 100%; }
.cg-preview img { image-rendering: pixelated; }
.cg-preview { opacity: 1; transition: opacity 160ms ease; }
.cg-preview-hidden { opacity: 0; }
.cg-full { opacity: 0; transition: opacity 160ms ease; }
.cg-ready { opacity: 1; }
.cg-failed { display: none; }
@media (prefers-reduced-motion: reduce) { .cg-full, .cg-preview { transition: none; } }
</style>
