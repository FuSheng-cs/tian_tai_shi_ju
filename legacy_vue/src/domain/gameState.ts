import {
  AI_STATES,
  AI_STATE_BY_TYPE,
  EMOTION_BY_TYPE,
  ENDING_BY_TYPE,
  type AiStateType,
  type EmotionType,
  type EndingType
} from './gameContract'

export type TurnEmotionType = EmotionType | 'normal'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface TurnEvaluation {
  emotion: TurnEmotionType
  aiState: AiStateType
  trustDelta: 0 | 5
  pressureDelta: 0 | 1 | 2
  endingType: EndingType | null
  confidence: number
}

export interface ChatTurnResult {
  reply: string
  evaluation: TurnEvaluation
}

export interface EndingSummary {
  roundsUsed: number
  trustGainCount: number
  turningLine: string
  comment: string
}

export interface GameState {
  roundCount: number
  hintCount: number
  trust: number
  trustGainCount: number
  trustGainMessages: string[]
  lastAiStateTag: AiStateType | null
  aiStateHistory: AiStateType[]
  lastEmotionTag: EmotionType | null
  emotionHistory: EmotionType[]
  messages: Message[]
  isWaiting: boolean
  waitingText: string
  isEnding: boolean
  endingType: EndingType | null
  endingSummary: EndingSummary | null
}

export interface PersistedGameState {
  roundCount: number
  hintCount?: number
  trust?: number
  trustGainCount?: number
  trustGainMessages?: string[]
  lastAiStateTag?: AiStateType | string | null
  aiStateHistory?: Array<AiStateType | string>
  lastEmotionTag?: EmotionType | string | null
  emotionHistory?: Array<EmotionType | string>
  messages?: Message[]
  isEnding?: boolean
  endingType?: EndingType | string | null
  endingSummary?: Partial<EndingSummary> | null
}

export interface StablePersistedGameState {
  roundCount: number
  hintCount: number
  trust: number
  trustGainCount: number
  trustGainMessages: string[]
  lastAiStateTag: AiStateType | null
  aiStateHistory: AiStateType[]
  lastEmotionTag: EmotionType | null
  emotionHistory: EmotionType[]
  messages: Message[]
  isEnding: boolean
  endingType: EndingType | null
  endingSummary: EndingSummary | null
}

export interface LLMConversationContext {
  roundsLeft: number
  trust: number
  trustGainCount: number
  turnsUsed: number
  aiState: AiStateType | null
}

export interface EndingSummaryContext {
  endingType: EndingType | null
  roundsUsed: number
  trustGainCount: number
  trust: number
}

export interface AfterStoryContext {
  endingType: EndingType | null
  lastPlayerLine: string
  endingReply: string
  turningLine: string
  endingComment: string
  roundsUsed: number
  trustGainCount: number
  trust: number
}

export const countPlayerMessages = (messages: Message[]) =>
  messages.filter((message) => message.role === 'user').length

export const normalizeEndingType = (value: unknown): EndingType | null => {
  if (typeof value !== 'string') return null
  if (value in ENDING_BY_TYPE) return value as EndingType

  return null
}

export const normalizeAiStateType = (value: unknown): AiStateType | null =>
  typeof value === 'string' && value in AI_STATE_BY_TYPE ? (value as AiStateType) : null

export const normalizeEmotionType = (value: unknown): EmotionType | null =>
  typeof value === 'string' && value in EMOTION_BY_TYPE ? (value as EmotionType) : null

export const normalizeTurnEmotionType = (value: unknown): TurnEmotionType =>
  value === 'normal' ? 'normal' : (normalizeEmotionType(value) ?? 'normal')

export const normalizeTrustDelta = (value: unknown): 0 | 5 => (Number(value) >= 5 ? 5 : 0)

export const normalizePressureDelta = (value: unknown): 0 | 1 | 2 => {
  const numeric = Number(value)
  if (Number.isNaN(numeric) || numeric <= 0) return 0
  if (numeric === 1) return 1
  return 2
}

export const normalizeConfidence = (value: unknown): number => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 0
  return Math.min(1, Math.max(0, numeric))
}

export const createDefaultTurnEvaluation = (aiState?: AiStateType | null): TurnEvaluation => ({
  emotion: 'normal',
  aiState: aiState ?? AI_STATES.guarded.type,
  trustDelta: 0,
  pressureDelta: 0,
  endingType: null,
  confidence: 0
})
