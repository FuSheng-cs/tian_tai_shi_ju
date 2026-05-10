import { defineStore } from 'pinia'
import { LLMService } from '@/modules/LLMService'
import {
  AI_STATE_BY_TYPE,
  AI_STATES,
  EMOTION_BY_TYPE,
  ENDINGS,
  ENDING_THRESHOLDS,
  ENDING_BY_TYPE,
  GAME_ROLE,
  GAME_RULES,
  WAITING_TEXTS,
  deriveAiStateType,
  resolveFallbackEndingType,
  type AiStateType,
  type EmotionType,
  type EndingType
} from '@/domain/gameContract'
import type { ChatTurnResult, EndingSummary, GameState, Message, PersistedGameState, TurnEvaluation } from '@/domain/gameState'

const getRoundsUsed = (messages: Message[]) =>
  messages.filter((message) => message.role === 'user').length

const reconcileInferredEndingProgress = (state: GameState, endingType: EndingType) => {
  const threshold = endingType === ENDINGS.acquaintance.type
    ? ENDING_THRESHOLDS.acquaintance
    : endingType === ENDINGS.disappear.type
      ? ENDING_THRESHOLDS.disappear
      : null

  if (!threshold) return

  state.affection = Math.max(state.affection, threshold.minAffection)
  state.affectionBoostCount = Math.max(state.affectionBoostCount, threshold.minAffectionBoostCount)
}

const cleanSummaryLine = (value: unknown) =>
  typeof value === 'string' ? value.trim().slice(0, GAME_RULES.maxSummaryTextLength) : ''

const DEATH_TURNING_LINE_PATTERNS = [
  /不想管/,
  /没时间/,
  /自己解决/,
  /矫情/,
  /不想帮/,
  /随便/,
  /我走了/,
  /不是唯一/
]

const findDeathTurningLine = (playerMessages: Message[]) => {
  for (let i = playerMessages.length - 1; i >= 0; i -= 1) {
    const line = playerMessages[i]?.content ?? ''
    if (DEATH_TURNING_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      return line
    }
  }

  return playerMessages[playerMessages.length - 1]?.content
}

const buildLocalEndingComment = (endingType: EndingType | null, boostCount: number) => {
  if (endingType === ENDINGS.acquaintance.type) return '你让她在这一夜里看见了被理解的可能。'
  if (endingType === ENDINGS.death.type) return boostCount > 0
    ? '你曾经靠近过她，但最后一句风还是没能托住她。'
    : '这一次，你们之间始终隔着没有被说破的沉默。'
  return boostCount > 0
    ? '你留下了一点温度，但还不足以让她停在原地。'
    : '你是善意的路人，只是还没找到真正抵达她的方式。'
}

const buildLocalEndingSummary = (state: GameState): EndingSummary => {
  const playerMessages = state.messages.filter((message) => message.role === 'user')
  const deathTurningLine = state.endingType === ENDINGS.death.type
    ? findDeathTurningLine(playerMessages)
    : null
  const fallbackLine =
    deathTurningLine ||
    state.affectionBoostMessages[state.affectionBoostMessages.length - 1] ||
    playerMessages[playerMessages.length - 1]?.content ||
    '你没有留下明确的话。'

  return {
    roundsUsed: getRoundsUsed(state.messages),
    affectionBoostCount: state.affectionBoostCount,
    turningLine: cleanSummaryLine(fallbackLine),
    comment: buildLocalEndingComment(state.endingType, state.affectionBoostCount)
  }
}

const normalizeEndingType = (value: unknown): EndingType | null =>
  typeof value === 'string' && value in ENDING_BY_TYPE ? value as EndingType : null

const normalizeAiStateType = (value: unknown): AiStateType | null =>
  typeof value === 'string' && value in AI_STATE_BY_TYPE ? value as AiStateType : null

const normalizeAiStateHistory = (value: unknown): AiStateType[] =>
  Array.isArray(value)
    ? value.map(normalizeAiStateType).filter((aiState): aiState is AiStateType => aiState !== null)
    : []

const normalizeEmotionType = (value: unknown): EmotionType | null =>
  typeof value === 'string' && value in EMOTION_BY_TYPE ? value as EmotionType : null

const normalizeEmotionHistory = (value: unknown): EmotionType[] =>
  Array.isArray(value)
    ? value.map(normalizeEmotionType).filter((emotion): emotion is EmotionType => emotion !== null)
    : []

const createDefaultTurnEvaluation = (aiState: AiStateType | null): TurnEvaluation => ({
  emotion: 'normal',
  aiState: aiState ?? AI_STATES.guarded.type,
  affectionDelta: 0,
  pressureDelta: 0,
  endingType: null,
  confidence: 0
})

const normalizeChatTurn = (value: unknown, fallbackAiState: AiStateType | null): ChatTurnResult => {
  const fallbackEvaluation = createDefaultTurnEvaluation(fallbackAiState)
  if (typeof value === 'string') {
    return {
      reply: value,
      evaluation: fallbackEvaluation
    }
  }

  if (!value || typeof value !== 'object') {
    return {
      reply: '',
      evaluation: fallbackEvaluation
    }
  }

  const record = value as Partial<ChatTurnResult>
  return {
    reply: typeof record.reply === 'string' ? record.reply : '',
    evaluation: record.evaluation ?? fallbackEvaluation
  }
}

const normalizePressureDelta = (value: unknown): 0 | 1 | 2 => {
  const numeric = Number(value)
  if (Number.isNaN(numeric) || numeric <= 0) return 0
  if (numeric === 1) return 1
  return 2
}

const applyEvaluatedAiState = (state: GameState, value: unknown) => {
  const aiState = normalizeAiStateType(value)
  if (!aiState) return

  state.lastAiStateTag = aiState
  if (state.aiStateHistory[state.aiStateHistory.length - 1] !== aiState) {
    state.aiStateHistory.push(aiState)
  }
}

const applyEvaluatedEmotion = (state: GameState, value: TurnEvaluation['emotion']) => {
  if (value === 'normal') {
    state.lastEmotionTag = null
    return
  }

  const emotion = normalizeEmotionType(value)
  if (!emotion) {
    state.lastEmotionTag = null
    return
  }

  state.lastEmotionTag = emotion
  state.emotionHistory.push(emotion)
}

export const useGameStore = defineStore('game', {
  state: (): GameState => ({
    roundCount: GAME_RULES.initialRoundCount,
    hintCount: GAME_RULES.initialHintCount,
    affection: 0,
    affectionBoostCount: 0,
    affectionBoostMessages: [],
    lastAiStateTag: AI_STATES.guarded.type,
    aiStateHistory: [AI_STATES.guarded.type],
    lastEmotionTag: null,
    emotionHistory: [],
    messages: [
      { role: 'assistant', content: GAME_ROLE.openingMessage }
    ],
    isWaiting: false,
    waitingText: '',
    isEnding: false,
    endingType: null,
    endingSummary: null
  }),
  actions: {

    async requestHint() {
      if (this.hintCount <= 0 || this.isWaiting || this.isEnding) return null;
      
      this.isWaiting = true;
      this.waitingText = "你在脑海中寻找线索……";
      this.hintCount -= 1;
      
      const hint = await LLMService.getHint(this.messages, {
        roundsLeft: this.roundCount,
        affection: this.affection,
        affectionBoostCount: this.affectionBoostCount,
        turnsUsed: getRoundsUsed(this.messages),
        aiState: this.lastAiStateTag
      });
      
      this.isWaiting = false;
      return hint;
    },
    async sendMessage(userText: string) {
      if (this.roundCount <= 0 || this.isEnding) return;
      
      this.messages.push({ role: 'user', content: userText });
      this.roundCount -= 1;
      
      this.isWaiting = true;
      this.waitingText = WAITING_TEXTS[Math.floor(Math.random() * WAITING_TEXTS.length)];
      
      const rawTurn = await LLMService.chat(userText, this.messages.slice(0, -1), {
        roundsLeft: this.roundCount,
        affection: this.affection,
        affectionBoostCount: this.affectionBoostCount,
        turnsUsed: getRoundsUsed(this.messages),
        aiState: this.lastAiStateTag
      });
      
      this.isWaiting = false;
      
      const turn = normalizeChatTurn(rawTurn, this.lastAiStateTag);
      const evaluation = turn.evaluation;
      let finalReply = turn.reply.trim();

      applyEvaluatedAiState(this.$state, evaluation.aiState);
      applyEvaluatedEmotion(this.$state, evaluation.emotion);
      
      const pressureDelta = normalizePressureDelta(evaluation.pressureDelta);
      if (pressureDelta > 0) {
        this.roundCount = Math.max(0, this.roundCount - pressureDelta);
      }

      if (evaluation.affectionDelta === GAME_RULES.affectionBoostValue) {
        this.affection += GAME_RULES.affectionBoostValue;
        this.affectionBoostCount += 1;
        this.affectionBoostMessages.push(userText);
        this.roundCount += 1;
      }

      const evaluatedEndingType = normalizeEndingType(evaluation.endingType);
      
      if (evaluatedEndingType) {
        this.isEnding = true;
        this.endingType = evaluatedEndingType;
      } else if (this.roundCount <= 0) {
        this.isEnding = true;
        const fallbackEndingType = resolveFallbackEndingType({
          affection: this.affection,
          affectionBoostCount: this.affectionBoostCount,
          turnsUsed: getRoundsUsed(this.messages),
          lastAssistantText: finalReply
        });
        this.endingType = fallbackEndingType;
        reconcileInferredEndingProgress(this.$state, fallbackEndingType);
      }
      
      if (finalReply) {
        this.messages.push({ role: 'assistant', content: finalReply });
      }
    },
    resetGame() {
      this.roundCount = GAME_RULES.initialRoundCount;
      this.hintCount = GAME_RULES.initialHintCount;
      this.affection = 0;
      this.affectionBoostCount = 0;
      this.affectionBoostMessages = [];
      this.lastAiStateTag = AI_STATES.guarded.type;
      this.aiStateHistory = [AI_STATES.guarded.type];
      this.lastEmotionTag = null;
      this.emotionHistory = [];
      this.messages = [
        { role: 'assistant', content: GAME_ROLE.openingMessage }
      ];
      this.isWaiting = false;
      this.waitingText = '';
      this.isEnding = false;
      this.endingType = null;
      this.endingSummary = null;
    },
    loadState(state: PersistedGameState) {
      this.roundCount = state.roundCount;
      this.hintCount = state.hintCount ?? GAME_RULES.initialHintCount;
      this.affection = state.affection ?? 0;
      this.messages = state.messages || [];
      this.affectionBoostMessages = Array.isArray(state.affectionBoostMessages) ? state.affectionBoostMessages : [];
      this.affectionBoostCount = state.affectionBoostCount ?? (this.affectionBoostMessages.length || Math.floor(this.affection / GAME_RULES.affectionBoostValue));
      this.lastAiStateTag = normalizeAiStateType(state.lastAiStateTag) ?? deriveAiStateType({
        roundCount: this.roundCount,
        affection: this.affection
      });
      this.aiStateHistory = normalizeAiStateHistory(state.aiStateHistory);
      if (this.aiStateHistory.length === 0 && this.lastAiStateTag) {
        this.aiStateHistory = [this.lastAiStateTag];
      }
      this.lastEmotionTag = normalizeEmotionType(state.lastEmotionTag);
      this.emotionHistory = normalizeEmotionHistory(state.emotionHistory);
      this.isWaiting = false;
      this.waitingText = '';
      this.isEnding = state.isEnding || false;
      this.endingType = normalizeEndingType(state.endingType);
      this.endingSummary = state.endingSummary ? {
        roundsUsed: state.endingSummary.roundsUsed ?? getRoundsUsed(this.messages),
        affectionBoostCount: state.endingSummary.affectionBoostCount ?? this.affectionBoostCount,
        turningLine: cleanSummaryLine(state.endingSummary.turningLine),
        comment: cleanSummaryLine(state.endingSummary.comment)
      } : null;
    },
    async generateEndingSummary() {
      if (!this.isEnding) return null;
      if (this.endingSummary) return this.endingSummary;

      const fallbackSummary = buildLocalEndingSummary(this.$state);

      if (this.endingType === ENDINGS.death.type) {
        this.endingSummary = fallbackSummary;
        return this.endingSummary;
      }

      try {
        const aiSummary = await LLMService.getEndingSummary(this.messages, {
          endingType: this.endingType,
          roundsUsed: fallbackSummary.roundsUsed,
          affectionBoostCount: this.affectionBoostCount
        });

        this.endingSummary = {
          ...fallbackSummary,
          turningLine: cleanSummaryLine(aiSummary?.turningLine) || fallbackSummary.turningLine,
          comment: cleanSummaryLine(aiSummary?.comment) || fallbackSummary.comment
        };
      } catch (e) {
        console.error('Failed to generate ending summary:', e);
        this.endingSummary = fallbackSummary;
      }

      return this.endingSummary;
    }
  }
})
