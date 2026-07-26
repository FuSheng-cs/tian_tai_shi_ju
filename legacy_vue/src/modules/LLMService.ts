import type { AiStateType } from '@/domain/gameContract'
import {
  createDefaultTurnEvaluation,
  normalizeAffectionDelta,
  normalizeAiStateType,
  normalizeConfidence,
  normalizeEndingType,
  normalizePressureDelta,
  normalizeTurnEmotionType,
  type AfterStoryContext,
  type ChatTurnResult,
  type EndingSummaryContext,
  type LLMConversationContext,
  type Message,
  type TurnEvaluation
} from '@/domain/gameState'

const LS_KEYS = {
  PROVIDER: 'damo_llm_provider',
  API_KEY: 'damo_llm_api_key',
  MODEL: 'damo_llm_model',
  BASE_URL: 'damo_llm_base_url'
} as const

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
const DEFAULT_PROVIDER: LLMProviderId = 'qwen'

export type LLMProviderId =
  | 'qwen'
  | 'deepseek'
  | 'doubao'
  | 'kimi'
  | 'zhipu'
  | 'openai'
  | 'claude'
  | 'custom'

export interface LLMProviderOption {
  id: LLMProviderId
  name: string
  vendor: string
  region: 'domestic' | 'global' | 'custom'
  protocol: 'openai-compatible' | 'anthropic'
  defaultModel: string
  defaultBaseUrl: string
  keyPlaceholder: string
  credentialUrl: string
  hint: string
  models: string[]
}

export const LLM_PROVIDERS: LLMProviderOption[] = [
  {
    id: 'qwen',
    name: '通义千问',
    vendor: '阿里云 DashScope',
    region: 'domestic',
    protocol: 'openai-compatible',
    defaultModel: 'qwen-plus',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    credentialUrl: 'dashscope.aliyuncs.com',
    hint: '中文叙事稳定，适合作为默认模型。',
    models: ['qwen-plus', 'qwen-max', 'qwen-turbo']
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    vendor: '深度求索',
    region: 'domestic',
    protocol: 'openai-compatible',
    defaultModel: 'deepseek-chat',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    credentialUrl: 'platform.deepseek.com',
    hint: 'OpenAI 兼容接口，中文性价比高。',
    models: ['deepseek-chat', 'deepseek-reasoner']
  },
  {
    id: 'doubao',
    name: '豆包',
    vendor: '火山引擎',
    region: 'domestic',
    protocol: 'openai-compatible',
    defaultModel: 'doubao-pro-4k',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    keyPlaceholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    credentialUrl: 'console.volcengine.com/ark',
    hint: '模型名通常需要填写火山方舟上的接入点名称。',
    models: ['doubao-pro-4k', 'doubao-pro-32k']
  },
  {
    id: 'kimi',
    name: 'Kimi',
    vendor: '月之暗面',
    region: 'domestic',
    protocol: 'openai-compatible',
    defaultModel: 'moonshot-v1-8k',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    credentialUrl: 'platform.moonshot.cn',
    hint: '上下文能力较强，适合保留较长对话记忆。',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    vendor: '智谱 AI',
    region: 'domestic',
    protocol: 'openai-compatible',
    defaultModel: 'glm-4-flash',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    keyPlaceholder: 'xxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxx',
    credentialUrl: 'open.bigmodel.cn',
    hint: '国产 OpenAI 兼容接口，模型名可按控制台调整。',
    models: ['glm-4-flash', 'glm-4-plus', 'glm-4-air']
  },
  {
    id: 'openai',
    name: 'OpenAI',
    vendor: 'GPT 系列',
    region: 'global',
    protocol: 'openai-compatible',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    credentialUrl: 'platform.openai.com',
    hint: '官方 GPT 系列接口，使用 Chat Completions 兼容格式。',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini']
  },
  {
    id: 'claude',
    name: 'Claude',
    vendor: 'Anthropic',
    region: 'global',
    protocol: 'anthropic',
    defaultModel: 'claude-sonnet-5',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    keyPlaceholder: 'sk-ant-xxxxxxxxxxxxxxxx',
    credentialUrl: 'console.anthropic.com',
    hint: '使用 Anthropic Messages API，后端会自动转换请求格式。',
    models: ['claude-sonnet-5', 'claude-opus-5', 'claude-haiku-4-5-20251001']
  },
  {
    id: 'custom',
    name: '自定义兼容',
    vendor: 'OpenAI Compatible',
    region: 'custom',
    protocol: 'openai-compatible',
    defaultModel: '',
    defaultBaseUrl: '',
    keyPlaceholder: 'sk- 或服务商提供的 Key',
    credentialUrl: '',
    hint: '用于 One API、New API、中转地址或其他 OpenAI 兼容服务。',
    models: []
  }
]

export const LLM_PROVIDER_BY_ID = Object.fromEntries(
  LLM_PROVIDERS.map((provider) => [provider.id, provider])
) as Record<LLMProviderId, LLMProviderOption>

export const isKnownLLMProvider = (providerId: string): providerId is LLMProviderId =>
  providerId in LLM_PROVIDER_BY_ID

export const normalizeProviderId = (providerId: string | null): LLMProviderId =>
  providerId && isKnownLLMProvider(providerId) ? providerId : DEFAULT_PROVIDER

export const getLLMProvider = (providerId: string) =>
  LLM_PROVIDER_BY_ID[normalizeProviderId(providerId)]

export interface LLMConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

export interface EndingSummaryReview {
  turningLine: string
  comment: string
}

export function loadLLMConfig(): LLMConfig {
  return {
    provider: normalizeProviderId(localStorage.getItem(LS_KEYS.PROVIDER)),
    apiKey: localStorage.getItem(LS_KEYS.API_KEY) || '',
    model: localStorage.getItem(LS_KEYS.MODEL) || '',
    baseUrl: localStorage.getItem(LS_KEYS.BASE_URL) || ''
  }
}

export function saveLLMConfig(cfg: LLMConfig) {
  localStorage.setItem(LS_KEYS.PROVIDER, normalizeProviderId(cfg.provider))
  localStorage.setItem(LS_KEYS.API_KEY, cfg.apiKey)
  localStorage.setItem(LS_KEYS.MODEL, cfg.model)
  localStorage.setItem(LS_KEYS.BASE_URL, cfg.baseUrl)
}

type BackendPayload = Record<string, unknown>

async function postBackend(endpoint: string, body: object): Promise<BackendPayload | null> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const data = (await response.json()) as BackendPayload

    if (data.error) {
      console.error(`[LLMService] Backend error on /${endpoint}:`, data.error)
    }

    return data
  } catch (e) {
    console.error(`[LLMService] Network error on /${endpoint}:`, e)
    return null
  }
}

async function callBackend(endpoint: string, body: object): Promise<string> {
  const data = await postBackend(endpoint, body)
  if (!data) return '网络连接失败，请检查后端服务是否启动。'
  if (data.error) return (data.reply || data.error) as string
  return (data.reply ?? '') as string
}

async function callBackendJson<T>(endpoint: string, body: object): Promise<T | null> {
  const data = await postBackend(endpoint, body)
  if (!data || data.error) return null
  return data as T
}

const readEvaluationField = (raw: Record<string, unknown>, snakeKey: string, camelKey: string) =>
  raw[snakeKey] ?? raw[camelKey]

const normalizeTurnEvaluation = (
  raw: unknown,
  fallbackAiState?: AiStateType | null
): TurnEvaluation => {
  const defaultEvaluation = createDefaultTurnEvaluation(fallbackAiState)
  if (!raw || typeof raw !== 'object') return defaultEvaluation

  const record = raw as Record<string, unknown>
  return {
    emotion: normalizeTurnEmotionType(readEvaluationField(record, 'emotion', 'emotion')),
    aiState:
      normalizeAiStateType(readEvaluationField(record, 'ai_state', 'aiState')) ??
      defaultEvaluation.aiState,
    affectionDelta: normalizeAffectionDelta(
      readEvaluationField(record, 'affection_delta', 'affectionDelta')
    ),
    pressureDelta: normalizePressureDelta(
      readEvaluationField(record, 'pressure_delta', 'pressureDelta')
    ),
    endingType: normalizeEndingType(readEvaluationField(record, 'ending_type', 'endingType')),
    confidence: normalizeConfidence(readEvaluationField(record, 'confidence', 'confidence'))
  }
}

async function callBackendTurn(
  endpoint: string,
  body: object,
  fallbackAiState?: AiStateType | null
): Promise<ChatTurnResult> {
  const data = await postBackend(endpoint, body)

  if (!data) {
    return {
      reply: '（她没有接话，只是看向远处的灯。）',
      evaluation: createDefaultTurnEvaluation(fallbackAiState)
    }
  }

  const replyText = typeof data.reply === 'string' ? data.reply : ''
  const errorText = typeof data.error === 'string' ? data.error : ''

  return {
    reply: replyText || errorText,
    evaluation: normalizeTurnEvaluation(data.evaluation, fallbackAiState)
  }
}

const getRequestConfig = () => {
  const cfg = loadLLMConfig()
  return {
    provider: cfg.provider,
    api_key: cfg.apiKey,
    model: cfg.model,
    base_url: cfg.baseUrl
  }
}

const serializeAfterStoryContext = (context?: AfterStoryContext) =>
  context
    ? {
        ending_type: context.endingType,
        last_player_line: context.lastPlayerLine,
        ending_reply: context.endingReply,
        turning_line: context.turningLine,
        ending_comment: context.endingComment,
        rounds_used: context.roundsUsed,
        affection_boost_count: context.affectionBoostCount,
        affection: context.affection
      }
    : undefined

export class LLMService {
  static async chat(
    userMessage: string,
    history: Message[],
    loopContext: LLMConversationContext
  ): Promise<ChatTurnResult> {
    return callBackendTurn(
      'chat',
      {
        history: history,
        user_message: userMessage,
        rounds_left: loopContext.roundsLeft,
        affection: loopContext.affection,
        affection_boost_count: loopContext.affectionBoostCount,
        turns_used: loopContext.turnsUsed,
        ai_state: loopContext.aiState,
        ...getRequestConfig()
      },
      loopContext.aiState
    )
  }

  static async chatAfterStory(
    userMessage: string,
    history: Message[],
    afterStoryContext?: AfterStoryContext
  ): Promise<string> {
    return callBackend('chat-after', {
      history: history,
      user_message: userMessage,
      after_story_context: serializeAfterStoryContext(afterStoryContext),
      ...getRequestConfig()
    })
  }

  static async getHint(history: Message[], _loopContext: LLMConversationContext): Promise<string> {
    return callBackend('hint', {
      history: history,
      ...getRequestConfig()
    })
  }

  static async getEndingSummary(
    history: Message[],
    endingContext: EndingSummaryContext
  ): Promise<EndingSummaryReview | null> {
    type EndingSummaryPayload = { turning_line?: string; comment?: string }
    const result = await callBackendJson<EndingSummaryPayload>('ending-summary', {
      history: history,
      ending_type: endingContext.endingType,
      rounds_used: endingContext.roundsUsed,
      affection_boost_count: endingContext.affectionBoostCount,
      ...getRequestConfig()
    })

    if (!result || typeof result.turning_line !== 'string' || typeof result.comment !== 'string') {
      return null
    }

    return {
      turningLine: result.turning_line.trim(),
      comment: result.comment.trim()
    }
  }
}
