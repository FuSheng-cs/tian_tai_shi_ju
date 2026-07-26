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

const buildLocalEndingComment = (endingType: EndingType | null, boostCount: number) => {
  if (endingType === ENDINGS.acquaintance.type) return '你让她在这一夜里看见了被理解的可能。'
  if (endingType === ENDINGS.death.type)
    return boostCount > 0
      ? '你曾经靠近过她，但最后一句风还是没能托住她。'
      : '这一次，你们之间始终隔着没有被说破的沉默。'
  return boostCount > 0
    ? '你留下了一点温度，但还不足以让她停在原地。'
    : '你是善意的路人，只是还没找到真正抵达她的方式。'
}

const buildLocalEndingSummary = (state: GameState): EndingSummary => {
  const playerMessages = state.messages.filter((message) => message.role === 'user')
  const lastPlayerLine = playerMessages[playerMessages.length - 1]?.content
  const fallbackLine =
    (state.endingType === ENDINGS.death.type
      ? lastPlayerLine
      : state.affectionBoostMessages[state.affectionBoostMessages.length - 1] || lastPlayerLine) ||
    '你没有留下明确的话。'

  return {
    roundsUsed: countPlayerMessages(state.messages),
    affectionBoostCount: state.affectionBoostCount,
    turningLine: cleanSummaryLine(fallbackLine),
    comment: buildLocalEndingComment(state.endingType, state.affectionBoostCount)
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
    affection: 0,
    affectionBoostCount: 0,
    affectionBoostMessages: [],
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
      this.waitingText = '你在脑海中寻找线索……'
      this.hintCount -= 1

      const hint = await LLMService.getHint(this.messages, {
        roundsLeft: this.roundCount,
        affection: this.affection,
        affectionBoostCount: this.affectionBoostCount,
        turnsUsed: countPlayerMessages(this.messages),
        aiState: this.lastAiStateTag
      })

      this.isWaiting = false
      return hint
    },
    async sendMessage(userText: string) {
      if (this.roundCount <= 0 || this.isEnding) return

      this.messages.push({ role: 'user', content: userText })
      this.roundCount -= 1

      this.isWaiting = true
      this.waitingText = WAITING_TEXTS[Math.floor(Math.random() * WAITING_TEXTS.length)]

      const turn = await LLMService.chat(userText, this.messages.slice(0, -1), {
        roundsLeft: this.roundCount,
        affection: this.affection,
        affectionBoostCount: this.affectionBoostCount,
        turnsUsed: countPlayerMessages(this.messages),
        aiState: this.lastAiStateTag
      })

      this.isWaiting = false

      const evaluation = turn.evaluation
      const finalReply = turn.reply.trim()

      applyEvaluatedAiState(this.$state, evaluation.aiState)
      applyEvaluatedEmotion(this.$state, evaluation.emotion)

      if (evaluation.pressureDelta > 0) {
        this.roundCount = Math.max(0, this.roundCount - evaluation.pressureDelta)
      }

      if (evaluation.affectionDelta === GAME_RULES.affectionBoostValue) {
        this.affection += GAME_RULES.affectionBoostValue
        this.affectionBoostCount += 1
        this.affectionBoostMessages.push(userText)
        this.roundCount += 1
      }

      if (evaluation.endingType) {
        this.isEnding = true
        this.endingType = evaluation.endingType
      } else if (this.roundCount <= 0) {
        this.isEnding = true
        this.endingType = resolveFallbackEndingType({
          affection: this.affection,
          affectionBoostCount: this.affectionBoostCount,
          turnsUsed: countPlayerMessages(this.messages),
          lastAssistantText: finalReply
        })
      }

      if (finalReply) {
        this.messages.push({ role: 'assistant', content: finalReply })
      }
    },
    resetGame() {
      endingSummaryGeneration += 1
      this.roundCount = GAME_RULES.initialRoundCount
      this.hintCount = GAME_RULES.initialHintCount
      this.affection = 0
      this.affectionBoostCount = 0
      this.affectionBoostMessages = []
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
      this.roundCount = state.roundCount
      this.hintCount = state.hintCount ?? GAME_RULES.initialHintCount
      this.affection = state.affection ?? 0
      this.messages = state.messages || []
      this.affectionBoostMessages = Array.isArray(state.affectionBoostMessages)
        ? state.affectionBoostMessages
        : []
      this.affectionBoostCount =
        state.affectionBoostCount ??
        (this.affectionBoostMessages.length ||
          Math.floor(this.affection / GAME_RULES.affectionBoostValue))
      this.lastAiStateTag =
        normalizeAiStateType(state.lastAiStateTag) ??
        deriveAiStateType({
          roundCount: this.roundCount,
          affection: this.affection
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
      this.endingSummary = state.endingSummary
        ? {
            roundsUsed: state.endingSummary.roundsUsed ?? countPlayerMessages(this.messages),
            affectionBoostCount:
              state.endingSummary.affectionBoostCount ?? this.affectionBoostCount,
            turningLine: cleanSummaryLine(state.endingSummary.turningLine),
            comment: cleanSummaryLine(state.endingSummary.comment)
          }
        : null
    },
    async generateEndingSummary() {
      if (!this.isEnding) return null
      if (this.endingSummary) return this.endingSummary

      const fallbackSummary = buildLocalEndingSummary(this.$state)

      if (this.endingType === ENDINGS.death.type) {
        this.endingSummary = fallbackSummary
        return this.endingSummary
      }

      const generation = endingSummaryGeneration
      let summary = fallbackSummary

      try {
        const aiSummary = await LLMService.getEndingSummary(this.messages, {
          endingType: this.endingType,
          roundsUsed: fallbackSummary.roundsUsed,
          affectionBoostCount: this.affectionBoostCount
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
