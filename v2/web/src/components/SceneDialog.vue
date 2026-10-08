<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{ open: boolean; title: string; drawer?: boolean }>(), {
  drawer: false,
})
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()

function sync() {
  if (props.open && !dialog.value?.open) dialog.value?.showModal()
  else if (!props.open && dialog.value?.open) dialog.value?.close()
}
watch(() => props.open, sync, { flush: 'post' })
onMounted(sync)

function backdrop(event: MouseEvent) {
  if (event.target !== dialog.value) return
  const bounds = dialog.value.getBoundingClientRect()
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    emit('close')
}

function trapFocus(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = Array.from(
    dialog.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ),
  ).filter((element) => element.getClientRects().length > 0 && !element.hidden)
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) {
    event.preventDefault()
    dialog.value.focus()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || !dialog.value.contains(document.activeElement))
  ) {
    event.preventDefault()
    last.focus()
  } else if (
    !event.shiftKey &&
    (document.activeElement === last || !dialog.value.contains(document.activeElement))
  ) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="scene-dialog"
    :class="{ 'scene-drawer': drawer }"
    :aria-label="title"
    @cancel.prevent="emit('close')"
    @close="emit('close')"
    @click="backdrop"
    @keydown="trapFocus"
  >
    <div class="dialog-heading">
      <span class="eyebrow">{{ title }}</span>
      <button class="icon-button close-button" aria-label="关闭" @click="emit('close')">✕</button>
    </div>
    <slot />
  </dialog>
</template>
