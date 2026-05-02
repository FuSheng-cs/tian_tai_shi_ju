import { ENDINGS } from '@/domain/gameContract'

const ACHIEVEMENT_KEY = 'damo_achievements'

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt?: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: ENDINGS.death.type, name: ENDINGS.death.achievementName, description: '未能触及她的内心，她选择了离开这个世界。' },
  { id: ENDINGS.disappear.type, name: ENDINGS.disappear.achievementName, description: '你让她今晚离开栏杆，但她没有留下联系方式。' },
  { id: ENDINGS.acquaintance.type, name: ENDINGS.acquaintance.achievementName, description: '她暂时留下，并愿意继续和你联系。' },
  { id: 'first_try', name: '初次相遇', description: '第一次在天台遇见她。' }
]

export class AchievementTracker {
  static getUnlocked(): string[] {
    try {
      const data = localStorage.getItem(ACHIEVEMENT_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  static unlock(id: string) {
    const unlocked = this.getUnlocked()
    if (!unlocked.includes(id)) {
      unlocked.push(id)
      localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(unlocked))
      // You can also emit an event here to show a toast notification
      window.dispatchEvent(new CustomEvent('achievement-unlocked', { detail: id }))
    }
  }

  static getProgress(): { unlocked: number; total: number } {
    return {
      unlocked: this.getUnlocked().length,
      total: ACHIEVEMENTS.length
    }
  }
}
