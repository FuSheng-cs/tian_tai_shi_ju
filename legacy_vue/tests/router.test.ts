import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { ENDINGS } from '../src/domain/gameContract'
import { useGameStore } from '../src/store/gameStore'
import { canEnterChatAfterStory, createAppRouter } from '../src/router'

const stubRoutes: RouteRecordRaw[] = [
  { path: '/', name: 'Start', component: { template: '<div />' } },
  { path: '/chat-after', name: 'ChatAfter', component: { template: '<div />' } }
]

describe('router guards', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
})
