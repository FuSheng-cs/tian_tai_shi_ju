import { onMounted, onUnmounted, ref, watch } from 'vue'

interface Preferences {
  textSize: 'normal' | 'large'
  motion: 'system' | 'reduced'
}
const storageKey = 'tiantai:v2:preferences'

function load(): Preferences {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    const data = parsed && typeof parsed === 'object' ? (parsed as Partial<Preferences>) : {}
    return {
      textSize: data.textSize === 'large' ? 'large' : 'normal',
      motion: data.motion === 'reduced' ? 'reduced' : 'system',
    }
  } catch {
    return { textSize: 'normal', motion: 'system' }
  }
}

export function usePreferences() {
  const preferences = ref(load())
  let media: MediaQueryList | undefined
  const systemReducedMotion = ref(false)
  function handleMotion(event: MediaQueryListEvent) {
    systemReducedMotion.value = event.matches
  }
  onMounted(() => {
    media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    systemReducedMotion.value = media?.matches ?? false
    media?.addEventListener?.('change', handleMotion)
  })
  onUnmounted(() => media?.removeEventListener?.('change', handleMotion))
  watch(
    preferences,
    (value) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(value))
      } catch {
        /* optional preferences */
      }
    },
    { deep: true },
  )
  return { preferences, systemReducedMotion }
}
