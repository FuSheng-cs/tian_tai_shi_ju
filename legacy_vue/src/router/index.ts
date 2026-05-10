import { createRouter, createWebHistory } from 'vue-router'
import type { RouterHistory, RouteRecordRaw } from 'vue-router'
import { CHAT_AFTER_SAVE_SLOT_SESSION_KEY, ENDINGS } from '@/domain/gameContract'
import type { GameState } from '@/domain/gameState'
import { SaveSystem } from '@/modules/SaveSystem'
import { useGameStore } from '@/store/gameStore'

export const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Start',
    component: () => import('@/views/StartView.vue')
  },
  {
    path: '/game',
    name: 'Game',
    component: () => import('@/views/GameView.vue')
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/views/SettingsView.vue')
  },
  {
    path: '/achievements',
    name: 'Achievements',
    component: () => import('@/views/AchievementsView.vue')
  },
  {
    path: '/chat-after',
    name: 'ChatAfter',
    component: () => import('@/views/ChatAfterStoryView.vue')
  }
]

const canLoadChatAfterStoryFromSession = () => {
  const slotId = Number(sessionStorage.getItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY))
  if (!Number.isInteger(slotId)) return false
  return SaveSystem.loadChatAfter(slotId) !== null
}

export const canEnterChatAfterStory = (state: Pick<GameState, 'isEnding' | 'endingType'>) =>
  (state.isEnding && state.endingType === ENDINGS.acquaintance.type) || canLoadChatAfterStoryFromSession()

export const createAppRouter = (
  history: RouterHistory = createWebHistory(),
  appRoutes: RouteRecordRaw[] = routes
) => {
  const router = createRouter({
    history,
    routes: appRoutes
  })

  router.beforeEach((to) => {
    if (to.name === 'ChatAfter' && !canEnterChatAfterStory(useGameStore())) {
      return { name: 'Start' }
    }
  })

  return router
}

const router = createAppRouter()

export default router
