import { AI_STATES, EMOTIONS, ENDINGS, GAME_RULES, deriveAiStateType, type EmotionType } from '@/domain/gameContract'
import type { GameState } from '@/domain/gameState'
import type { SaveSlot } from '@/modules/SaveSystem'

const ACHIEVEMENT_KEY = 'damo_achievements'
const COMPLETE_ARCHIVE_ID = 'complete_archive'

export type AchievementCategory = 'encounter' | 'listening' | 'pressure' | 'ending' | 'collection'

export interface AchievementCategoryDefinition {
  id: AchievementCategory;
  label: string;
  description: string;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  hidden: boolean;
  lockedHint: string;
  unlockText: string;
  icon: string;
  unlockedAt?: number;
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
  pressure: {
    id: 'pressure',
    label: '压力',
    description: '风更冷的时候，栏杆边的距离也会改变。'
  },
  ending: {
    id: 'ending',
    label: '结局',
    description: '今晚最终留下的三种可能。'
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
  'pressure',
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
    lockedHint: '走上天台，见到那个坐在栏杆边的人。',
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
    name: '没有急着借答案',
    description: '前三句话里没有使用线索。',
    category: 'encounter',
    hidden: false,
    lockedHint: '试着先靠自己听完前三句话。',
    unlockText: '你没有把别人的答案递给她。',
    icon: 'ear'
  },
  {
    id: 'first_affection',
    name: '她听见了',
    description: '第一次让她产生“这个人在听”的感觉。',
    category: 'listening',
    hidden: false,
    lockedHint: '有一句话会让她短暂停住。',
    unlockText: '她第一次真正听见了你。',
    icon: 'heart'
  },
  {
    id: 'three_affection',
    name: '裂缝里的光',
    description: '本局累计触发 3 次好感。',
    category: 'listening',
    hidden: true,
    lockedHint: '有些回应会在沉默里留下细小裂缝。',
    unlockText: '裂缝里有一点光透了出来。',
    icon: 'spark'
  },
  {
    id: 'five_affection',
    name: '临界留存',
    description: '本局累计触发 5 次好感。',
    category: 'listening',
    hidden: true,
    lockedHint: '最难的不是靠近，而是让她仍愿意停留。',
    unlockText: '她还没有好，但她停住了。',
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
    id: 'edge_state',
    name: '风把她往外推',
    description: '她进入了临界状态。',
    category: 'pressure',
    hidden: true,
    lockedHint: '当句数越来越少，风会替沉默说话。',
    unlockText: '栏杆外的风变近了。',
    icon: 'wind'
  },
  {
    id: 'turn_back_state',
    name: '背向城市',
    description: '她转身面向楼外。',
    category: 'pressure',
    hidden: true,
    lockedHint: '有一刻，她会把背影留给你。',
    unlockText: '她把脸转向了城市外侧。',
    icon: 'rotate'
  },
  {
    id: 'last_sentence_rescue',
    name: '最后一线',
    description: '剩余 0 或 1 句话时达成非死亡结局。',
    category: 'pressure',
    hidden: true,
    lockedHint: '最后一口气里，也可能留下一个选择。',
    unlockText: '最后一线没有断。',
    icon: 'thread'
  },
  {
    id: 'no_hint_rescue',
    name: '不借来的答案',
    description: '未使用线索达成消失或相识结局。',
    category: 'pressure',
    hidden: true,
    lockedHint: '不借来答案，也许能留下更像自己的话。',
    unlockText: '今晚留下她的，是你自己的话。',
    icon: 'eye'
  },
  {
    id: ENDINGS.death.type,
    name: ENDINGS.death.achievementName,
    description: '未能触及她的内心，她选择了离开这个世界。',
    category: 'ending',
    hidden: true,
    lockedHint: '有些沉默会一直坠下去。',
    unlockText: '你记住了坠落之后的空白。',
    icon: 'fall'
  },
  {
    id: ENDINGS.disappear.type,
    name: ENDINGS.disappear.achievementName,
    description: '你让她今晚离开栏杆，但她没有留下联系方式。',
    category: 'ending',
    hidden: true,
    lockedHint: '她也许会离开栏杆，但不一定留下名字。',
    unlockText: '她从消防通道离开，没有回头。',
    icon: 'footsteps'
  },
  {
    id: ENDINGS.acquaintance.type,
    name: ENDINGS.acquaintance.achievementName,
    description: '她暂时留下，并愿意继续和你联系。',
    category: 'ending',
    hidden: true,
    lockedHint: '让她今晚留下，已经是一件很难的事。',
    unlockText: '她没有被治好，但愿意继续说话。',
    icon: 'star'
  },
  {
    id: 'first_save',
    name: '夹在烟盒里的便签',
    description: '第一次成功保存这一夜。',
    category: 'collection',
    hidden: false,
    lockedHint: '把某个分岔保存下来。',
    unlockText: '你把这一刻夹进了烟盒。',
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
    name: '雨夜全档案',
    description: '点亮其余所有雨夜档案。',
    category: 'collection',
    hidden: true,
    lockedHint: '还有未被记录的雨声。',
    unlockText: '这场雨夜的档案完整了。',
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

const getTurnsUsed = (state: GameState) =>
  state.messages.filter((message) => message.role === 'user').length

const hasEmotion = (state: GameState, emotion: EmotionType) =>
  state.emotionHistory.includes(emotion)

const isRescueEnding = (state: GameState) =>
  state.isEnding &&
  (state.endingType === ENDINGS.disappear.type || state.endingType === ENDINGS.acquaintance.type)

const hasEnteredEdgeState = (state: GameState) =>
  state.lastAiStateTag === AI_STATES.edge.type ||
  state.aiStateHistory.includes(AI_STATES.edge.type) ||
  deriveAiStateType({ roundCount: state.roundCount, affection: state.affection }) === AI_STATES.edge.type

const hasEnteredTurnBackState = (state: GameState) =>
  state.lastAiStateTag === AI_STATES.turnBack.type ||
  state.aiStateHistory.includes(AI_STATES.turnBack.type)

const hasSoftAfterSting = (state: GameState) => {
  const stingIndex = state.emotionHistory.indexOf(EMOTIONS.sting.type)
  if (stingIndex < 0) return false
  return state.emotionHistory.slice(stingIndex + 1).includes(EMOTIONS.soft.type)
}

export class AchievementTracker {
  static getAchievement(id: string): AchievementDefinition | null {
    return ACHIEVEMENT_BY_ID[id] ?? null
  }

  static getUnlocked(): string[] {
    return readStoredIds().filter((id) => knownAchievementIds.has(id))
  }

  static unlock(id: string): boolean {
    const achievement = this.getAchievement(id)
    if (!achievement) return false

    const unlocked = this.getUnlocked()
    if (id === COMPLETE_ARCHIVE_ID) {
      this.unlockCompleteArchiveIfReady(unlocked)
      return !unlocked.includes(id) && this.getUnlocked().includes(id)
    }

    if (unlocked.includes(id)) return false

    const nextUnlocked = [...unlocked, id]
    writeKnownIds(nextUnlocked)
    this.dispatchUnlock(achievement)
    this.unlockCompleteArchiveIfReady(nextUnlocked)
    return true
  }

  static evaluateFromState(state: GameState): string[] {
    const before = this.getUnlocked()
    const turnsUsed = getTurnsUsed(state)
    const candidates: string[] = []

    if (turnsUsed >= 1) candidates.push('first_words')
    if (turnsUsed >= 3 && state.hintCount === GAME_RULES.initialHintCount) candidates.push('silent_listener')
    if (state.affectionBoostCount >= 1) candidates.push('first_affection')
    if (state.affectionBoostCount >= 3) candidates.push('three_affection')
    if (state.affectionBoostCount >= 5) candidates.push('five_affection')
    if (Object.values(EMOTIONS).every((emotion) => hasEmotion(state, emotion.type))) candidates.push('all_emotions')
    if (hasSoftAfterSting(state)) candidates.push('soft_after_sting')
    if (hasEnteredEdgeState(state)) candidates.push('edge_state')
    if (hasEnteredTurnBackState(state)) candidates.push('turn_back_state')
    if (isRescueEnding(state) && state.roundCount <= 1) candidates.push('last_sentence_rescue')
    if (isRescueEnding(state) && state.hintCount === GAME_RULES.initialHintCount) candidates.push('no_hint_rescue')
    if (state.isEnding && state.endingType) candidates.push(state.endingType)

    for (const id of candidates) {
      this.unlock(id)
    }
    this.unlockCompleteArchiveIfReady(this.getUnlocked())

    const after = this.getUnlocked()
    return after.filter((id) => !before.includes(id))
  }

  static evaluateSaveSlots(slots: SaveSlot[]): string[] {
    const before = this.getUnlocked()
    if (slots.length >= 1) this.unlock('first_save')
    if (GAME_RULES.saveSlotIds.every((slotId) => slots.some((slot) => slot.id === slotId))) {
      this.unlock('three_save_slots')
    }
    this.unlockCompleteArchiveIfReady(this.getUnlocked())

    const after = this.getUnlocked()
    return after.filter((id) => !before.includes(id))
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

  private static unlockCompleteArchiveIfReady(unlocked: string[]) {
    if (unlocked.includes(COMPLETE_ARCHIVE_ID)) return

    const hasAllOtherAchievements = ACHIEVEMENTS
      .filter((achievement) => achievement.id !== COMPLETE_ARCHIVE_ID)
      .every((achievement) => unlocked.includes(achievement.id))

    if (!hasAllOtherAchievements) return

    const nextUnlocked = [...unlocked, COMPLETE_ARCHIVE_ID]
    writeKnownIds(nextUnlocked)
    this.dispatchUnlock(ACHIEVEMENT_BY_ID[COMPLETE_ARCHIVE_ID])
  }

  private static dispatchUnlock(achievement: AchievementDefinition) {
    if (typeof window === 'undefined') return

    window.dispatchEvent(new CustomEvent('achievement-unlocked', {
      detail: {
        id: achievement.id,
        achievement
      }
    }))
  }
}
