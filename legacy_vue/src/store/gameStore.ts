import { defineStore } from 'pinia'
import { LLMService } from '@/modules/LLMService'
import {
  AI_STATES,
  ENDINGS,
  GAME_ROLE,
  GAME_RULES,
  WAITING_TEXTS,
  deriveAiStateType,
  resolveFallbackEndingType,
  type AiStateType,
  type EmotionType,
  type EndingType
} from '@/domain/gameContract'
import {
  countPlayerMessages,
  normalizeAiStateType,
  normalizeEmotionType,
  normalizeEndingType,
  type EndingSummary,
  type GameState,
  type PersistedGameState,
  type TurnEvaluation
} from '@/domain/gameState'

let endingSummaryGeneration = 0

const cleanSummaryLine = (value: unknown) =>
  typeof value === 'string' ? value.trim().slice(0, GAME_RULES.maxSummaryTextLength) : ''

const buildLocalEndingComment = (endingType: EndingType | null) => {
  if (endingType === ENDINGS.safeExit.type) {
    return '她哭了，随后和你一起离开了天台。'
  }
  return '她不再回应，仍然拒绝离开天台。此刻需要联系可信任的成年人或专业支持。'
}

const buildLocalEndingSummary = (state: GameState): EndingSummary => {
  const playerMessages = state.messages.filter((message) => message.role === 'user')
  const lastPlayerLine = playerMessages[playerMessages.length - 1]?.content
  const fallbackLine =
    (state.endingType === ENDINGS.refusal.type
      ? lastPlayerLine
      : state.trustGainMessages[state.trustGainMessages.length - 1] || lastPlayerLine) ||
    '你没有留下明确的话。'

  return {
    roundsUsed: countPlayerMessages(state.messages),
    trustGainCount: state.trustGainCount,
    turningLine: cleanSummaryLine(fallbackLine),
    comment: buildLocalEndingComment(state.endingType)
  }
}

const normalizeAiStateHistory = (value: unknown): AiStateType[] =>
  Array.isArray(value)
    ? value.map(normalizeAiStateType).filter((aiState): aiState is AiStateType => aiState !== null)
    : []

const normalizeEmotionHistory = (value: unknown): EmotionType[] =>
  Array.isArray(value)
    ? value.map(normalizeEmotionType).filter((emotion): emotion is EmotionType => emotion !== null)
    : []

const applyEvaluatedAiState = (state: GameState, aiState: AiStateType) => {
  state.lastAiStateTag = aiState
  if (state.aiStateHistory[state.aiStateHistory.length - 1] !== aiState) {
    state.aiStateHistory.push(aiState)
  }
}

const applyEvaluatedEmotion = (state: GameState, emotion: TurnEvaluation['emotion']) => {
  if (emotion === 'normal') {
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
    trust: 0,
    trustGainCount: 0,
    trustGainMessages: [],
    lastAiStateTag: AI_STATES.guarded.type,
    aiStateHistory: [AI_STATES.guarded.type],
    lastEmotionTag: null,
    emotionHistory: [],
    messages: [{ role: 'assistant', content: GAME_ROLE.openingMessage }],
    isWaiting: false,
    waitingText: '',
    isEnding: false,
    endingType: null,
    endingSummary: null
  }),
  actions: {
    async requestHint() {
      if (this.hintCount <= 0 || this.isWaiting || this.isEnding) return null

      this.isWaiting = true
      this.waitingText = '你在脑海中寻找下一步……'
      this.hintCount -= 1

      const hint = await LLMService.getHint(this.messages, {
        roundsLeft: this.roundCount,
        trust: this.trust,
        trustGainCount: this.trustGainCount,
        turnsUsed: countPlayerMessages(this.messages),
        aiState: this.lastAiStateTag
      })

      this.isWaiting = false
      return hint
    },
    async sendMessage(userText: string) {
      if (this.roundCount <= 0 || this.isEnding || this.isWaiting || !userText.trim()) return

      this.messages.push({ role: 'user', content: userText })
      // 每次输入只消耗一句，始终保持“十句话”的明确规则。
      this.roundCount -= 1

      this.isWaiting = true
      this.waitingText = WAITING_TEXTS[Math.floor(Math.random() * WAITING_TEXTS.length)]

      const turn = await LLMService.chat(userText, this.messages.slice(0, -1), {
        roundsLeft: this.roundCount,
        trust: this.trust,
        trustGainCount: this.trustGainCount,
        turnsUsed: countPlayerMessages(this.messages),
        aiState: this.lastAiStateTag
      })

      this.isWaiting = false

      const evaluation = { ...turn.evaluation }
      let finalReply = turn.reply.trim()

      if (evaluation.pressureDelta > 0) {
        this.trust = Math.max(0, this.trust - evaluation.pressureDelta)
      }

      if (evaluation.trustDelta === GAME_RULES.trustBoostValue) {
        this.trust = Math.min(GAME_RULES.maxTrust, this.trust + GAME_RULES.trustBoostValue)
        this.trustGainCount += 1
        this.trustGainMessages.push(userText)
      }

      if (this.trust < GAME_RULES.maxTrust &&
          (evaluation.endingType === ENDINGS.safeExit.type || evaluation.aiState === AI_STATES.leaving.type)) {
        evaluation.endingType = null
        evaluation.aiState = AI_STATES.wavering.type
        finalReply = '艾望向天台门，又停住脚步：“再陪我待一会儿，好吗？”'
      }
      applyEvaluatedAiState(this.$state, evaluation.aiState)
      applyEvaluatedEmotion(this.$state, evaluation.emotion)

      if (evaluation.endingType) {
        this.isEnding = true
        this.endingType = evaluation.endingType
      } else if (this.roundCount <= 0) {
        this.isEnding = true
        this.endingType = resolveFallbackEndingType({
          trust: this.trust,
          lastAssistantText: finalReply,
          lastAiStateType: this.lastAiStateTag
        })
        finalReply = '（艾低下头，不再回应。她仍然拒绝离开天台。）'
      }

      if (finalReply) {
        this.messages.push({ role: 'assistant', content: finalReply })
      }
    },
    resetGame() {
      endingSummaryGeneration += 1
      this.roundCount = GAME_RULES.initialRoundCount
      this.hintCount = GAME_RULES.initialHintCount
      this.trust = 0
      this.trustGainCount = 0
      this.trustGainMessages = []
      this.lastAiStateTag = AI_STATES.guarded.type
      this.aiStateHistory = [AI_STATES.guarded.type]
      this.lastEmotionTag = null
      this.emotionHistory = []
      this.messages = [{ role: 'assistant', content: GAME_ROLE.openingMessage }]
      this.isWaiting = false
      this.waitingText = ''
      this.isEnding = false
      this.endingType = null
      this.endingSummary = null
    },
    loadState(state: PersistedGameState) {
      endingSummaryGeneration += 1
      const legacyState = state as PersistedGameState & Record<string, unknown>
      const legacyTrust = typeof legacyState.affection === 'number' ? legacyState.affection : 0
      const legacyTrustCount =
        typeof legacyState.affectionBoostCount === 'number'
          ? legacyState.affectionBoostCount
          : undefined
      const legacyTrustMessages = Array.isArray(legacyState.affectionBoostMessages)
        ? legacyState.affectionBoostMessages
        : undefined

      this.roundCount = Math.max(0, state.roundCount)
      this.hintCount = state.hintCount ?? GAME_RULES.initialHintCount
      this.trust = Math.min(GAME_RULES.maxTrust, Math.max(0, state.trust ?? legacyTrust))
      this.messages = state.messages || []
      this.trustGainMessages = Array.isArray(state.trustGainMessages)
        ? state.trustGainMessages
        : legacyTrustMessages || []
      this.trustGainCount =
        state.trustGainCount ??
        legacyTrustCount ??
        (this.trustGainMessages.length || Math.floor(this.trust / GAME_RULES.trustBoostValue))
      this.lastAiStateTag =
        normalizeAiStateType(state.lastAiStateTag) ??
        deriveAiStateType({
          roundCount: this.roundCount,
          trust: this.trust
        })
      this.aiStateHistory = normalizeAiStateHistory(state.aiStateHistory)
      if (this.aiStateHistory.length === 0 && this.lastAiStateTag) {
        this.aiStateHistory = [this.lastAiStateTag]
      }
      this.lastEmotionTag = normalizeEmotionType(state.lastEmotionTag)
      this.emotionHistory = normalizeEmotionHistory(state.emotionHistory)
      this.isWaiting = false
      this.waitingText = ''
      this.isEnding = state.isEnding || false
      this.endingType = normalizeEndingType(state.endingType)

      const savedSummary = state.endingSummary as
        | (Partial<EndingSummary> & Record<string, unknown>)
        | null
        | undefined
      this.endingSummary = savedSummary
        ? {
            roundsUsed: savedSummary.roundsUsed ?? countPlayerMessages(this.messages),
            trustGainCount:
              savedSummary.trustGainCount ??
              (typeof savedSummary.affectionBoostCount === 'number'
                ? savedSummary.affectionBoostCount
                : this.trustGainCount),
            turningLine: cleanSummaryLine(savedSummary.turningLine),
            comment: cleanSummaryLine(savedSummary.comment)
          }
        : null
    },
    async generateEndingSummary() {
      if (!this.isEnding) return null
      if (this.endingSummary) return this.endingSummary

      const fallbackSummary = buildLocalEndingSummary(this.$state)
      const generation = endingSummaryGeneration
      let summary = fallbackSummary

      try {
        const aiSummary = await LLMService.getEndingSummary(this.messages, {
          endingType: this.endingType,
          roundsUsed: fallbackSummary.roundsUsed,
          trustGainCount: this.trustGainCount,
          trust: this.trust
        })

        summary = {
          ...fallbackSummary,
          turningLine: cleanSummaryLine(aiSummary?.turningLine) || fallbackSummary.turningLine,
          comment: cleanSummaryLine(aiSummary?.comment) || fallbackSummary.comment
        }
      } catch (e) {
        console.error('Failed to generate ending summary:', e)
      }

      if (generation !== endingSummaryGeneration) return null

      this.endingSummary = summary
      return this.endingSummary
    }
  }
})
