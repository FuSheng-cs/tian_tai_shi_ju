import {
  AI_STATES,
  EMOTIONS,
  ENDINGS,
  GAME_RULES,
  deriveAiStateType,
  type EmotionType
} from '@/domain/gameContract'
import { countPlayerMessages, type GameState } from '@/domain/gameState'
import type { SaveSlot } from '@/modules/SaveSystem'

const ACHIEVEMENT_KEY = 'tiantaishiju_safety_achievements'
const COMPLETE_ARCHIVE_ID = 'complete_archive'

export type AchievementCategory = 'encounter' | 'listening' | 'safety' | 'ending' | 'collection'

export interface AchievementCategoryDefinition {
  id: AchievementCategory
  label: string
  description: string
}

export interface AchievementDefinition {
  id: string
  name: string
  description: string
  category: AchievementCategory
  hidden: boolean
  lockedHint: string
  unlockText: string
  icon: string
  unlockedAt?: number
}

export type Achievement = AchievementDefinition

export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, AchievementCategoryDefinition> = {
  encounter: {
    id: 'encounter',
    label: '相遇',
    description: '从推开天台门开始，记录这一夜的第一道痕迹。'
  },
  listening: {
    id: 'listening',
    label: '倾听',
    description: '她的防备、停顿和微小松动，都被收入档案。'
  },
  safety: {
    id: 'safety',
    label: '安全',
    description: '记录那些让对话走向安全地方的选择。'
  },
  ending: {
    id: 'ending',
    label: '结局',
    description: '今晚最终留下的两种可能。'
  },
  collection: {
    id: 'collection',
    label: '收藏',
    description: '被保存下来的分岔、便签和完整记录。'
  }
}

export const ACHIEVEMENT_CATEGORY_ORDER: AchievementCategory[] = [
  'encounter',
  'listening',
  'safety',
  'ending',
  'collection'
]

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_try',
    name: '初次相遇',
    description: '第一次在天台遇见她。',
    category: 'encounter',
    hidden: false,
    lockedHint: '走上天台，见到那个坐在远离门口的人。',
    unlockText: '你推开了通往天台的门。',
    icon: 'door'
  },
  {
    id: 'first_words',
    name: '雨门之后',
    description: '你向艾说出了第一句话。',
    category: 'encounter',
    hidden: false,
    lockedHint: '把第一句话留在雨夜里。',
    unlockText: '第一句话落在了雨声里。',
    icon: 'message'
  },
  {
    id: 'silent_listener',
    name: '先听她说',
    description: '前三句话里没有使用线索。',
    category: 'encounter',
    hidden: false,
    lockedHint: '试着先靠自己听完前三句话。',
    unlockText: '你没有把标准答案递给她。',
    icon: 'ear'
  },
  {
    id: 'first_trust',
    name: '她听见了',
    description: '第一次让她产生“这个人在听”的感觉。',
    category: 'listening',
    hidden: false,
    lockedHint: '有一句话会让她短暂停住。',
    unlockText: '她第一次真正听见了你。',
    icon: 'heart'
  },
  {
    id: 'three_trust',
    name: '裂缝里的光',
    description: '本局累计触发 3 次信任度提升。',
    category: 'listening',
    hidden: true,
    lockedHint: '有些回应会在沉默里留下细小裂缝。',
    unlockText: '裂缝里有一点光透了出来。',
    icon: 'spark'
  },
  {
    id: 'five_trust',
    name: '愿意多停一会儿',
    description: '本局累计触发 5 次信任度提升。',
    category: 'listening',
    hidden: true,
    lockedHint: '最难的不是靠近，而是让她仍愿意停留。',
    unlockText: '她还没有准备好，但她愿意多停一会儿。',
    icon: 'moon'
  },
  {
    id: 'all_emotions',
    name: '四种回声',
    description: '触发过刺痛、惊讶、柔软、好奇四种情绪。',
    category: 'listening',
    hidden: true,
    lockedHint: '同一夜里，听见她四种不同的回声。',
    unlockText: '你记住了她情绪里不同的回声。',
    icon: 'waves'
  },
  {
    id: 'soft_after_sting',
    name: '刺痛之后',
    description: '先触发刺痛，之后又触发柔软。',
    category: 'listening',
    hidden: true,
    lockedHint: '有些话先刺痛她，后来才让她放松一点。',
    unlockText: '刺痛之后，她仍然没有完全关上门。',
    icon: 'cloud'
  },
  {
    id: 'wavering_state',
    name: '开始松动',
    description: '她进入了动摇状态。',
    category: 'safety',
    hidden: true,
    lockedHint: '当她感到被听见，防备会出现一点松动。',
    unlockText: '她的防备出现了一道缝。',
    icon: 'wind'
  },
  {
    id: 'crying_state',
    name: '眼泪先抵达',
    description: '她在对话中哭了出来。',
    category: 'safety',
    hidden: true,
    lockedHint: '有时眼泪是终于不用再独自撑住的信号。',
    unlockText: '她终于哭了出来。',
    icon: 'cloud'
  },
  {
    id: 'last_sentence_safety',
    name: '最后一句也在场',
    description: '剩余 0 或 1 句话时完成一次结局。',
    category: 'safety',
    hidden: true,
    lockedHint: '最后一句话也可以留下陪伴。',
    unlockText: '你把最后一句话也留给了她。',
    icon: 'thread'
  },
  {
    id: 'no_hint_safety',
    name: '不借来的答案',
    description: '未使用线索完成一次安全对话。',
    category: 'safety',
    hidden: true,
    lockedHint: '不借来答案，也许能留下更像自己的话。',
    unlockText: '今晚留下她的，是你自己的话。',
    icon: 'eye'
  },
  {
    id: ENDINGS.safeExit.type,
    name: ENDINGS.safeExit.achievementName,
    description: '艾哭了，并愿意和你一起离开天台。',
    category: 'ending',
    hidden: true,
    lockedHint: '陪她走到下一个安全的地方。',
    unlockText: '她哭了，但愿意和你一起离开天台。',
    icon: 'footsteps'
  },
  {
    id: ENDINGS.refusal.type,
    name: ENDINGS.refusal.achievementName,
    description: '艾不再回应，并拒绝离开天台。',
    category: 'ending',
    hidden: true,
    lockedHint: '有些时候，她还没有准备好离开。',
    unlockText: '她不再搭理你，仍然拒绝离开天台。',
    icon: 'star'
  },
  {
    id: 'first_save',
    name: '夹在便签里的夜晚',
    description: '第一次成功保存这一夜。',
    category: 'collection',
    hidden: false,
    lockedHint: '把某个分岔保存下来。',
    unlockText: '你把这一刻夹进了便签。',
    icon: 'save'
  },
  {
    id: 'three_save_slots',
    name: '三个夜晚',
    description: '三个存档栏位都有记录。',
    category: 'collection',
    hidden: true,
    lockedHint: '把三个不同的夜晚都留下。',
    unlockText: '三个夜晚在档案里并排亮起。',
    icon: 'bookmark'
  },
  {
    id: COMPLETE_ARCHIVE_ID,
    name: '安全对话全档案',
    description: '点亮其余所有安全对话档案。',
    category: 'collection',
    hidden: true,
    lockedHint: '还有未被记录的回应。',
    unlockText: '这场对话的档案完整了。',
    icon: 'archive'
  }
]

export const ACHIEVEMENT_BY_ID = Object.fromEntries(
  ACHIEVEMENTS.map((achievement) => [achievement.id, achievement])
) as Record<string, AchievementDefinition>

const knownAchievementIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id))

const unique = (ids: string[]) => Array.from(new Set(ids))

const readStoredIds = (): string[] => {
  try {
    const data = localStorage.getItem(ACHIEVEMENT_KEY)
    const parsed = data ? JSON.parse(data) : []
    return Array.isArray(parsed)
      ? unique(parsed.filter((id): id is string => typeof id === 'string'))
      : []
  } catch {
    return []
  }
}

const writeKnownIds = (ids: string[]) => {
  const knownIds = unique(ids).filter((id) => knownAchievementIds.has(id))
  localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(knownIds))
}

const hasEmotion = (state: GameState, emotion: EmotionType) => state.emotionHistory.includes(emotion)

const hasEnteredState = (state: GameState, stateType: keyof typeof AI_STATES) =>
  state.lastAiStateTag === AI_STATES[stateType].type ||
  state.aiStateHistory.includes(AI_STATES[stateType].type)

const hasEnteredWaveringState = (state: GameState) =>
  hasEnteredState(state, 'wavering') ||
  deriveAiStateType({ roundCount: state.roundCount, trust: state.trust }) === AI_STATES.wavering.type

export class AchievementTracker {
  static getAchievement(id: string): AchievementDefinition | null {
    return ACHIEVEMENT_BY_ID[id] ?? null
  }

  static getUnlocked(): string[] {
    return readStoredIds().filter((id) => knownAchievementIds.has(id))
  }

  static unlock(id: string): boolean {
    return this.unlockMany([id]).includes(id)
  }

  static evaluateFromState(state: GameState): string[] {
    const turnsUsed = countPlayerMessages(state.messages)
    const candidates: string[] = []

    if (turnsUsed >= 1) candidates.push('first_words')
    if (turnsUsed >= 3 && state.hintCount === GAME_RULES.initialHintCount) {
      candidates.push('silent_listener')
    }
    if (state.trustGainCount >= 1) candidates.push('first_trust')
    if (state.trustGainCount >= 3) candidates.push('three_trust')
    if (state.trustGainCount >= 5) candidates.push('five_trust')
    if (Object.values(EMOTIONS).every((emotion) => hasEmotion(state, emotion.type))) {
      candidates.push('all_emotions')
    }
    if (hasSoftAfterSting(state)) candidates.push('soft_after_sting')
    if (hasEnteredWaveringState(state)) candidates.push('wavering_state')
    if (hasEnteredState(state, 'crying')) candidates.push('crying_state')
    if (state.isEnding && state.roundCount <= 1) candidates.push('last_sentence_safety')
    if (state.isEnding && state.hintCount === GAME_RULES.initialHintCount) {
      candidates.push('no_hint_safety')
    }
    if (state.isEnding && state.endingType) candidates.push(state.endingType)

    return this.unlockMany(candidates)
  }

  static evaluateSaveSlots(slots: SaveSlot[]): string[] {
    const candidates: string[] = []
    if (slots.length >= 1) candidates.push('first_save')
    if (GAME_RULES.saveSlotIds.every((slotId) => slots.some((slot) => slot.id === slotId))) {
      candidates.push('three_save_slots')
    }
    return this.unlockMany(candidates)
  }

  static getProgress(): { unlocked: number; total: number } {
    return {
      unlocked: this.getUnlocked().length,
      total: ACHIEVEMENTS.length
    }
  }

  static getCategoryProgress(category: AchievementCategory): { unlocked: number; total: number } {
    const achievements = ACHIEVEMENTS.filter((achievement) => achievement.category === category)
    const unlocked = this.getUnlocked()
    return {
      unlocked: achievements.filter((achievement) => unlocked.includes(achievement.id)).length,
      total: achievements.length
    }
  }

  private static unlockMany(candidateIds: string[]): string[] {
    const unlocked = new Set(this.getUnlocked())
    const newlyUnlocked: string[] = []

    for (const id of candidateIds) {
      if (id === COMPLETE_ARCHIVE_ID) continue
      if (!knownAchievementIds.has(id) || unlocked.has(id)) continue
      unlocked.add(id)
      newlyUnlocked.push(id)
    }

    const hasAllOtherAchievements = ACHIEVEMENTS.filter(
      (achievement) => achievement.id !== COMPLETE_ARCHIVE_ID
    ).every((achievement) => unlocked.has(achievement.id))

    if (!unlocked.has(COMPLETE_ARCHIVE_ID) && hasAllOtherAchievements) {
      unlocked.add(COMPLETE_ARCHIVE_ID)
      newlyUnlocked.push(COMPLETE_ARCHIVE_ID)
    }

    if (newlyUnlocked.length === 0) return []

    writeKnownIds(Array.from(unlocked))
    for (const id of newlyUnlocked) {
      this.dispatchUnlock(ACHIEVEMENT_BY_ID[id])
    }
    return newlyUnlocked
  }

  private static dispatchUnlock(achievement: AchievementDefinition) {
    if (typeof window === 'undefined') return

    window.dispatchEvent(
      new CustomEvent('achievement-unlocked', {
        detail: {
          id: achievement.id,
          achievement
        }
      })
    )
  }
}

const hasSoftAfterSting = (state: GameState) => {
  const stingIndex = state.emotionHistory.indexOf(EMOTIONS.sting.type)
  if (stingIndex < 0) return false
  return state.emotionHistory.slice(stingIndex + 1).includes(EMOTIONS.soft.type)
}
