import { defineStore } from 'pinia'
import { LLMService } from '@/modules/LLMService'
import {
  AFFECTION_BOOST_TAG_REGEX,
  AI_STATE_BY_LABEL,
  AI_STATE_BY_TYPE,
  AI_STATE_TAG_REGEX,
  AI_STATES,
  ANY_AI_STATE_TAG_REGEX,
  ANY_EMOTION_TAG_REGEX,
  ANY_ENDING_TAG_REGEX,
  EMOTION_BY_LABEL,
  EMOTION_BY_TYPE,
  EMOTION_TAG_REGEX,
  ENDINGS,
  ENDING_THRESHOLDS,
  ENDING_BY_LABEL,
  ENDING_BY_TYPE,
  ENDING_TAG_REGEX,
  GAME_ROLE,
  GAME_RULES,
  MECHANIC_TAGS,
  WAITING_TEXTS,
  deriveAiStateType,
  resolveFallbackEndingType,
  type AiStateLabel,
  type AiStateType,
  type EmotionLabel,
  type EmotionType,
  type EndingLabel,
  type EndingType
} from '@/domain/gameContract'
import type { EndingSummary, GameState, Message, PersistedGameState } from '@/domain/gameState'

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
      
      const reply = await LLMService.chat(userText, this.messages.slice(0, -1), {
        roundsLeft: this.roundCount,
        affection: this.affection,
        affectionBoostCount: this.affectionBoostCount,
        turnsUsed: getRoundsUsed(this.messages),
        aiState: this.lastAiStateTag
      });
      
      this.isWaiting = false;
      
      let finalReply = reply;

      const aiStateMatch = finalReply.match(AI_STATE_TAG_REGEX);
      if (aiStateMatch) {
        const aiState = AI_STATE_BY_LABEL[aiStateMatch[1] as AiStateLabel]
        if (aiState) {
          this.lastAiStateTag = aiState.type;
          this.aiStateHistory.push(aiState.type);
        }
        finalReply = finalReply.replace(ANY_AI_STATE_TAG_REGEX, '').trim();
      }

      const emotionMatch = finalReply.match(EMOTION_TAG_REGEX);
      if (emotionMatch) {
        const emotion = EMOTION_BY_LABEL[emotionMatch[1] as EmotionLabel]
        if (emotion) {
          this.lastEmotionTag = emotion.type;
          this.emotionHistory.push(emotion.type);
        }
        finalReply = finalReply.replace(ANY_EMOTION_TAG_REGEX, '').trim();
      } else {
        this.lastEmotionTag = null;
      }
      
      // Check for affection boost
      if (reply.includes(MECHANIC_TAGS.affectionBoost)) {
        this.affection += GAME_RULES.affectionBoostValue;
        this.affectionBoostCount += 1;
        this.affectionBoostMessages.push(userText);
        this.roundCount += 1;
        finalReply = finalReply.replace(AFFECTION_BOOST_TAG_REGEX, '').trim();
      }

      const endingMatch = finalReply.match(ENDING_TAG_REGEX);
      
      if (endingMatch) {
        this.isEnding = true;
        const ending = ENDING_BY_LABEL[endingMatch[1] as EndingLabel]
        this.endingType = ending?.type ?? ENDINGS.disappear.type;
        
        finalReply = finalReply.replace(ANY_ENDING_TAG_REGEX, '').trim();
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
