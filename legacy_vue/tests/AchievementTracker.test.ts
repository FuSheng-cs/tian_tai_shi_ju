import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_STATES, EMOTIONS, ENDINGS, GAME_RULES } from '../src/domain/gameContract'
import type { GameState, Message } from '../src/domain/gameState'
import { ACHIEVEMENTS, AchievementTracker } from '../src/modules/AchievementTracker'
import type { SaveSlot } from '../src/modules/SaveSystem'

const playerMessages = (count: number): Message[] => [
  { role: 'assistant', content: '雨声落在栏杆上。' },
  ...Array.from({ length: count }, (_, index) => ({
    role: 'user' as const,
    content: `第 ${index + 1} 句话`
  }))
]

const buildState = (overrides: Partial<GameState> = {}): GameState => ({
  roundCount: GAME_RULES.initialRoundCount,
  hintCount: GAME_RULES.initialHintCount,
  affection: 0,
  affectionBoostCount: 0,
  affectionBoostMessages: [],
  lastAiStateTag: AI_STATES.guarded.type,
  aiStateHistory: [AI_STATES.guarded.type],
  lastEmotionTag: null,
  emotionHistory: [],
  messages: [{ role: 'assistant', content: '雨声落在栏杆上。' }],
  isWaiting: false,
  waitingText: '',
  isEnding: false,
  endingType: null,
  endingSummary: null,
  ...overrides
})

describe('AchievementTracker', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('reads old string-array data and ignores unknown achievements in progress', () => {
    localStorage.setItem('damo_achievements', JSON.stringify([
      'first_try',
      'legacy_unknown',
      ENDINGS.death.type,
      'first_try'
    ]))

    expect(AchievementTracker.getUnlocked()).toEqual(['first_try', ENDINGS.death.type])
    expect(AchievementTracker.getProgress()).toEqual({
      unlocked: 2,
      total: ACHIEVEMENTS.length
    })
  })

  it('returns false for duplicate or unknown unlocks and dispatches only new known unlocks', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    expect(AchievementTracker.unlock('first_try')).toBe(true)
    expect(AchievementTracker.unlock('first_try')).toBe(false)
    expect(AchievementTracker.unlock('unknown')).toBe(false)

    expect(AchievementTracker.getUnlocked()).toEqual(['first_try'])
    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    expect((dispatchSpy.mock.calls[0][0] as CustomEvent).detail.id).toBe('first_try')
  })

  it('unlocks complete archive after every other achievement is unlocked', () => {
    const otherAchievements = ACHIEVEMENTS.filter((achievement) => achievement.id !== 'complete_archive')

    for (const achievement of otherAchievements) {
      AchievementTracker.unlock(achievement.id)
    }

    expect(AchievementTracker.getUnlocked()).toEqual(ACHIEVEMENTS.map((achievement) => achievement.id))
  })

  it('evaluates dialogue, affection, emotion, pressure, and ending achievements from state', () => {
    const unlocked = AchievementTracker.evaluateFromState(buildState({
      roundCount: 1,
      hintCount: GAME_RULES.initialHintCount,
      affection: 25,
      affectionBoostCount: 5,
      affectionBoostMessages: ['第一句', '第二句', '第三句', '第四句', '第五句'],
      lastAiStateTag: AI_STATES.turnBack.type,
      aiStateHistory: [AI_STATES.guarded.type, AI_STATES.edge.type, AI_STATES.turnBack.type],
      lastEmotionTag: EMOTIONS.curiosity.type,
      emotionHistory: [
        EMOTIONS.sting.type,
        EMOTIONS.surprise.type,
        EMOTIONS.soft.type,
        EMOTIONS.curiosity.type
      ],
      messages: playerMessages(7),
      isEnding: true,
      endingType: ENDINGS.acquaintance.type
    }))

    expect(unlocked).toEqual(expect.arrayContaining([
      'first_words',
      'silent_listener',
      'first_affection',
      'three_affection',
      'five_affection',
      'all_emotions',
      'soft_after_sting',
      'edge_state',
      'turn_back_state',
      'last_sentence_rescue',
      'no_hint_rescue',
      ENDINGS.acquaintance.type
    ]))
  })

  it('evaluates save slot achievements', () => {
    const slot = (id: number): SaveSlot => ({ id, timestamp: Date.now(), data: `slot-${id}` })

    expect(AchievementTracker.evaluateSaveSlots([slot(1)])).toEqual(['first_save'])
    expect(AchievementTracker.evaluateSaveSlots([slot(1), slot(2), slot(3)])).toEqual(['three_save_slots'])
  })
})
