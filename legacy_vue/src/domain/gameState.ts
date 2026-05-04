import type { AiStateType, EmotionType, EndingType } from './gameContract'

export type TurnEmotionType = EmotionType | 'normal'

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface TurnEvaluation {
  emotion: TurnEmotionType;
  aiState: AiStateType;
  affectionDelta: 0 | 5;
  pressureDelta: 0 | 1 | 2;
  endingType: EndingType | null;
  confidence: number;
}

export interface ChatTurnResult {
  reply: string;
  evaluation: TurnEvaluation;
}

export interface EndingSummary {
  roundsUsed: number;
  affectionBoostCount: number;
  turningLine: string;
  comment: string;
}

export interface GameState {
  roundCount: number;
  hintCount: number;
  affection: number;
  affectionBoostCount: number;
  affectionBoostMessages: string[];
  lastAiStateTag: AiStateType | null;
  aiStateHistory: AiStateType[];
  lastEmotionTag: EmotionType | null;
  emotionHistory: EmotionType[];
  messages: Message[];
  isWaiting: boolean;
  waitingText: string;
  isEnding: boolean;
  endingType: EndingType | null;
  endingSummary: EndingSummary | null;
}

export interface PersistedGameState {
  roundCount: number;
  hintCount?: number;
  affection?: number;
  affectionBoostCount?: number;
  affectionBoostMessages?: string[];
  lastAiStateTag?: AiStateType | string | null;
  aiStateHistory?: Array<AiStateType | string>;
  lastEmotionTag?: EmotionType | string | null;
  emotionHistory?: Array<EmotionType | string>;
  messages?: Message[];
  isEnding?: boolean;
  endingType?: EndingType | string | null;
  endingSummary?: Partial<EndingSummary> | null;
}

export interface StablePersistedGameState {
  roundCount: number;
  hintCount: number;
  affection: number;
  affectionBoostCount: number;
  affectionBoostMessages: string[];
  lastAiStateTag: AiStateType | null;
  aiStateHistory: AiStateType[];
  lastEmotionTag: EmotionType | null;
  emotionHistory: EmotionType[];
  messages: Message[];
  isEnding: boolean;
  endingType: EndingType | null;
  endingSummary: EndingSummary | null;
}

export interface LLMConversationContext {
  roundsLeft: number;
  affection: number;
  affectionBoostCount: number;
  turnsUsed: number;
  aiState: AiStateType | null;
}

export interface EndingSummaryContext {
  endingType: EndingType | null;
  roundsUsed: number;
  affectionBoostCount: number;
}

export interface AfterStoryContext {
  endingType: EndingType | null;
  lastPlayerLine: string;
  endingReply: string;
  turningLine: string;
  endingComment: string;
  roundsUsed: number;
  affectionBoostCount: number;
  affection: number;
}
