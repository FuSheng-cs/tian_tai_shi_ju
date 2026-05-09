import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { CHAT_AFTER_SAVE_SLOT_SESSION_KEY, ENDINGS } from '../src/domain/gameContract'
import { SaveSystem } from '../src/modules/SaveSystem'
import { useGameStore } from '../src/store/gameStore'
import { canEnterChatAfterStory, createAppRouter } from '../src/router'

const stubRoutes: RouteRecordRaw[] = [
  { path: '/', name: 'Start', component: { template: '<div />' } },
  { path: '/chat-after', name: 'ChatAfter', component: { template: '<div />' } }
]

describe('router guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('blocks direct access to after-story chat before the acquaintance ending', async () => {
    const store = useGameStore()
    const router = createAppRouter(createMemoryHistory(), stubRoutes)

    expect(canEnterChatAfterStory(store)).toBe(false)
    await router.push('/chat-after')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('Start')
  })

  it('allows after-story chat after the acquaintance ending is unlocked', async () => {
    const store = useGameStore()
    store.isEnding = true
    store.endingType = ENDINGS.acquaintance.type
    const router = createAppRouter(createMemoryHistory(), stubRoutes)

    expect(canEnterChatAfterStory(store)).toBe(true)
    await router.push('/chat-after')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('ChatAfter')
  })

  it('allows after-story chat when loading a valid after-story save slot', async () => {
    SaveSystem.saveChatAfter(2, {
      messages: [{ role: 'assistant', content: '我到楼下了。' }],
      afterStoryContext: {
        endingType: ENDINGS.acquaintance.type,
        lastPlayerLine: '我在这里。',
        endingReply: '她把手机递过来。',
        turningLine: '我在这里。',
        endingComment: '她记住了这句话。',
        roundsUsed: 8,
        affectionBoostCount: 4,
        affection: 24
      }
    })
    sessionStorage.setItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY, '2')
    const router = createAppRouter(createMemoryHistory(), stubRoutes)

    expect(canEnterChatAfterStory(useGameStore())).toBe(true)
    await router.push('/chat-after')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('ChatAfter')
  })
})
