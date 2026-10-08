import { computed, ref, shallowRef } from 'vue'
import { api, ApiError, type EndingRequest, type TurnRequest } from '../api'
import type { EndingChoice, Health, Observation, PlayMode, Session } from '../domain'

const storageKey = 'tiantai:v2:session'

function readSessionId(): string | null {
  try {
    const value = localStorage.getItem(storageKey)
    return value && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null
  } catch {
    return null
  }
}

function requestId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  )
}

export function useGame() {
  const session = shallowRef<Session | null>(null)
  const health = shallowRef<Health | null>(null)
  const healthLoading = ref(false)
  const healthError = ref('')
  const savedId = ref(readSessionId())
  const busy = ref(false)
  const error = ref('')
  const notice = ref('')
  const pendingTurn = shallowRef<TurnRequest | null>(null)
  const pendingEnding = shallowRef<EndingRequest | null>(null)
  const hasPending = computed(() => Boolean(pendingTurn.value || pendingEnding.value))

  function accept(next: Session) {
    if (session.value?.id === next.id && session.value.revision > next.revision) return
    session.value = next
    savedId.value = next.id
    try {
      localStorage.setItem(storageKey, next.id)
    } catch {
      notice.value = '浏览器未允许保存进度。请保留这个页面；关闭后可能无法找回这一夜。'
    }
  }

  async function checkHealth() {
    healthLoading.value = true
    healthError.value = ''
    try {
      health.value = await api.health()
    } catch (cause) {
      healthError.value = cause instanceof Error ? cause.message : '暂时无法连接服务器。'
    } finally {
      healthLoading.value = false
    }
  }

  async function start(mode: PlayMode): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    error.value = ''
    try {
      accept(await api.create(mode))
      pendingTurn.value = null
      pendingEnding.value = null
      return true
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '暂时无法开始。'
      return false
    } finally {
      busy.value = false
    }
  }

  async function resume(): Promise<boolean> {
    if (!savedId.value || busy.value) return false
    busy.value = true
    error.value = ''
    try {
      const restored = await api.restore(savedId.value)
      accept(restored)
      if (pendingTurn.value && restored.revision > pendingTurn.value.expectedRevision)
        pendingTurn.value = null
      if (pendingEnding.value && restored.revision > pendingEnding.value.expectedRevision)
        pendingEnding.value = null
      return true
    } catch (cause) {
      if (cause instanceof ApiError && [404, 410].includes(cause.status)) {
        savedId.value = null
        session.value = null
        try {
          localStorage.removeItem(storageKey)
        } catch {
          /* storage may be unavailable */
        }
        error.value = '上一次的雨夜已不在服务器中。可以重新开始一夜。'
      } else error.value = cause instanceof Error ? cause.message : '暂时无法读取进度。'
      return false
    } finally {
      busy.value = false
    }
  }

  async function handleFailure(cause: unknown): Promise<boolean> {
    if (cause instanceof ApiError && cause.code === 'turn_in_progress') {
      error.value = cause.message
      return false
    }
    if (cause instanceof ApiError && cause.status === 409 && session.value) {
      try {
        accept(await api.restore(session.value.id))
        pendingTurn.value = null
        pendingEnding.value = null
        error.value = '进度在另一个页面更新过，已同步到最新一刻。请确认后再开口。'
      } catch {
        error.value = '进度需要同步，但连接暂时中断。你的话仍已保留，请重试。'
      }
      return false
    }
    if (cause instanceof ApiError && !cause.retryable && cause.status < 500) {
      pendingTurn.value = null
      pendingEnding.value = null
    }
    error.value = cause instanceof Error ? cause.message : '暂时没有收到回应，请重试。'
    return false
  }

  async function send(text: string, observation?: Observation): Promise<boolean> {
    if (!session.value || busy.value || session.value.status !== 'active') return false
    const payload = pendingTurn.value ?? {
      requestId: requestId(),
      expectedRevision: session.value.revision,
      text: text.trim(),
      ...(observation ? { observation } : {}),
    }
    pendingTurn.value = payload
    busy.value = true
    error.value = ''
    try {
      accept(await api.turn(session.value.id, payload))
      pendingTurn.value = null
      return true
    } catch (cause) {
      return await handleFailure(cause)
    } finally {
      busy.value = false
    }
  }

  async function end(choice: EndingChoice): Promise<boolean> {
    if (!session.value || busy.value || session.value.status !== 'choosing') return false
    const payload = pendingEnding.value ?? {
      requestId: requestId(),
      expectedRevision: session.value.revision,
      choice,
    }
    pendingEnding.value = payload
    busy.value = true
    error.value = ''
    try {
      accept(await api.ending(session.value.id, payload))
      pendingEnding.value = null
      return true
    } catch (cause) {
      return await handleFailure(cause)
    } finally {
      busy.value = false
    }
  }

  return {
    session,
    health,
    healthLoading,
    healthError,
    savedId,
    busy,
    error,
    notice,
    pendingTurn,
    pendingEnding,
    hasPending,
    checkHealth,
    start,
    resume,
    send,
    end,
  }
}
