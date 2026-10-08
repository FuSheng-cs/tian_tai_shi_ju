import type { EndingChoice, Health, Observation, PlayMode, Session } from './domain'

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
    public status = 0,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface TurnRequest {
  requestId: string
  expectedRevision: number
  text: string
  observation?: Observation
  intent?: 'silence'
}

export interface ObservationRequest {
  requestId: string
  expectedRevision: number
  observation: Observation
}

export interface EndingRequest {
  requestId: string
  expectedRevision: number
  choice: EndingChoice
  echoMessageId?: string
}

async function request<T>(path: string, body?: unknown, timeout = 65000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(`/api/v2${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers:
        body === undefined
          ? { Accept: 'application/json' }
          : { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
    const data = (await response.json().catch(() => null)) as {
      error?: { message?: string; code?: string; retryable?: boolean }
    } | null
    if (!response.ok) {
      throw new ApiError(
        data?.error?.message || '雨夜暂时没有回应。你的话还在这里，可以重试。',
        data?.error?.code || 'REQUEST_FAILED',
        data?.error?.retryable ?? response.status >= 500,
        response.status,
      )
    }
    if (!data) throw new ApiError('收到的回应不完整。请稍后重试。', 'INVALID_RESPONSE', true)
    return data as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      error instanceof Error && error.name === 'AbortError'
        ? '这次等待有些长。你的话已经保留，重试不会重复计次。'
        : '暂时连接不到雨夜。请检查网络，再试一次。',
      'NETWORK_ERROR',
      true,
    )
  } finally {
    clearTimeout(timer)
  }
}

export const api = {
  health: () => request<Health>('/health', undefined, 10000),
  create: (mode: PlayMode) => request<Session>('/sessions', { mode }),
  restore: (id: string) => request<Session>(`/sessions/${encodeURIComponent(id)}`),
  turn: (id: string, body: TurnRequest) =>
    request<Session>(`/sessions/${encodeURIComponent(id)}/turns`, body),
  observe: (id: string, body: ObservationRequest) =>
    request<Session>(`/sessions/${encodeURIComponent(id)}/observations`, body),
  ending: (id: string, body: EndingRequest) =>
    request<Session>(`/sessions/${encodeURIComponent(id)}/ending`, body),
}
