import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import StartView from '../src/views/StartView.vue'
import { ENDINGS, GAME_RULES } from '../src/domain/gameContract'
import { SaveSystem } from '../src/modules/SaveSystem'
import { useGameStore } from '../src/store/gameStore'
import { mockDialog } from './helpers/mockDialog'

vi.mock('../src/modules/AudioManager', () => ({ audioManager: { playSfx: vi.fn() } }))

mockDialog()

describe('homepage entry and saves', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  afterEach(() => {
    wrapper?.unmount()
    vi.restoreAllMocks()
  })

  const openHomepage = async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: ['/', '/game', '/chat-after', '/settings', '/achievements'].map((path) => ({
        path,
        component: { template: '<div />' }
      }))
    })
    await router.push('/')
    await router.isReady()
    wrapper = mount(StartView, {
      attachTo: document.body,
      global: { plugins: [router], stubs: { BgmControl: true } }
    })
    await flushPromises()
    return router
  }

  const button = (name: string) => {
    const result = wrapper.findAll('button').find((element) =>
      element.attributes('aria-label') === name || element.text().trim() === name
    )
    if (!result) throw new Error(`Missing button: ${name}`)
    return result
  }

  const expectSelected = (item: string) => {
    const selected = wrapper.findAll('.menu-button.is-selected')
    expect(selected).toHaveLength(1)
    expect(selected[0].attributes('data-menu-item')).toBe(item)
  }

  it('moves the single selection highlight to the hovered item and back', async () => {
    await openHomepage()
    expectSelected('start')

    await button('读取存档').trigger('pointerover')
    expectSelected('load')
    expect(button('开始游戏').classes()).not.toContain('is-selected')

    await button('设置').trigger('pointermove')
    expectSelected('settings')
    await button('开始游戏').trigger('pointerover')
    expectSelected('start')
  })

  it('keeps disabled continue from taking the highlight', async () => {
    await openHomepage()
    await button('设置').trigger('pointerover')
    await button('继续游戏').trigger('pointerover')
    expectSelected('settings')
  })

  it('follows focus and switches between keyboard and pointer input', async () => {
    await openHomepage()
    button('读取存档').element.focus()
    await flushPromises()
    expectSelected('load')

    await button('设置').trigger('pointermove')
    expectSelected('settings')
    // A subsequent keyboard action restores the highlight to the actual focused button.
    await button('读取存档').trigger('keydown', { key: 'Shift' })
    expectSelected('load')
  })

  it('supports arrow navigation, wrapping, Home and End while skipping empty continue', async () => {
    await openHomepage()
    button('开始游戏').element.focus()
    await button('开始游戏').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(button('读取存档').element)
    expectSelected('load')

    await button('读取存档').trigger('keydown', { key: 'ArrowDown' })
    expectSelected('settings')
    await button('设置').trigger('keydown', { key: 'ArrowDown' })
    expectSelected('start')
    await button('开始游戏').trigger('keydown', { key: 'ArrowUp' })
    expectSelected('settings')
    await button('设置').trigger('keydown', { key: 'Home' })
    expectSelected('start')
    await button('开始游戏').trigger('keydown', { key: 'End' })
    expectSelected('settings')
  })

  it('includes a valid continue in keyboard navigation and clears it when the save disappears', async () => {
    SaveSystem.save(1)
    await openHomepage()
    button('开始游戏').element.focus()
    await button('开始游戏').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(button('继续游戏').element)
    expectSelected('continue')

    localStorage.removeItem('tiantaishiju_safety_save_1')
    window.dispatchEvent(new Event('storage'))
    await flushPromises()
    expect(button('继续游戏').element.disabled).toBe(true)
    expectSelected('start')
  })

  it('keeps continue unavailable and shows empty slots before a game is saved', async () => {
    await openHomepage()
    expect(button('继续游戏').element.disabled).toBe(true)
    await button('读取存档').trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog').element.open).toBe(true)
    const slots = wrapper.findAll('button').filter((element) => element.text().startsWith('栏位'))
    expect(slots).toHaveLength(GAME_RULES.saveSlotIds.length)
    expect(slots.every((slot) => slot.element.disabled)).toBe(true)
  })

  it('continues the newest game save without restoring anything while inspecting it', async () => {
    const store = useGameStore()
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000)
    store.roundCount = 8
    SaveSystem.save(1)
    store.roundCount = 4
    SaveSystem.save(2)
    store.resetGame()
    const router = await openHomepage()

    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount)
    await button('继续游戏').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/game?entry=load')
    expect(store.roundCount).toBe(4)
  })

  it('skips a corrupt newer save and preserves its stored contents', async () => {
    const store = useGameStore()
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000)
    store.roundCount = 6
    SaveSystem.save(1)
    SaveSystem.save(2)
    const corrupt = { ...SaveSystem.getSlot(2), data: 'not-a-save' }
    const storedCorrupt = JSON.stringify(corrupt)
    localStorage.setItem('tiantaishiju_safety_save_2', storedCorrupt)
    store.resetGame()
    const router = await openHomepage()

    await button('继续游戏').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/game?entry=load')
    expect(store.roundCount).toBe(6)
    expect(localStorage.getItem('tiantaishiju_safety_save_2')).toBe(storedCorrupt)
  })

  it('continues the latest safe follow-up using its saved slot and route', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000)
    SaveSystem.save(1)
    SaveSystem.saveChatAfter(2, {
      messages: [{ role: 'assistant', content: '我到楼下了。' }],
      afterStoryContext: {
        endingType: ENDINGS.safeExit.type,
        lastPlayerLine: '我们一起下楼。',
        endingReply: '她抹去眼泪，和你一起走进楼梯间。',
        turningLine: '我在听。',
        endingComment: '她愿意继续说。',
        roundsUsed: 5,
        trustGainCount: 3,
        trust: 15
      }
    })
    const router = await openHomepage()
    await button('继续游戏').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/chat-after?slot=2')
  })

  it('lets the player choose an older slot explicitly', async () => {
    const store = useGameStore()
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(2000)
    store.roundCount = 8
    SaveSystem.save(1)
    store.roundCount = 2
    SaveSystem.save(2)
    store.resetGame()
    const router = await openHomepage()
    await button('读取存档').trigger('click')
    await flushPromises()
    const olderSlot = wrapper.findAll('button').find((element) => element.text().startsWith('栏位 1'))
    await olderSlot!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/game?entry=load')
    expect(store.roundCount).toBe(8)
  })

  it('shows an inline error if a slot disappears while the dialog is open', async () => {
    SaveSystem.save(1)
    const router = await openHomepage()
    await button('读取存档').trigger('click')
    await flushPromises()
    const slotButton = wrapper.findAll('button').find((element) => element.text().startsWith('栏位 1'))
    localStorage.removeItem('tiantaishiju_safety_save_1')
    await slotButton!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
    expect(wrapper.get('dialog').element.open).toBe(true)
    expect(wrapper.get('[role="status"]').text()).toContain('请选择其他栏位')
  })

  it('refreshes continue availability when another page saves and focus returns', async () => {
    await openHomepage()
    expect(button('继续游戏').element.disabled).toBe(true)
    SaveSystem.save(3)
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(button('继续游戏').element.disabled).toBe(false)
  })

  it('closes about on cancel and restores focus to the opening control', async () => {
    await openHomepage()
    const about = button('关于作品')
    about.element.focus()
    await about.trigger('click')
    await flushPromises()
    expect(wrapper.get('dialog').element.open).toBe(true)
    expect(wrapper.text()).toContain('现实中的支持没有十句期限')
    await wrapper.get('dialog').trigger('cancel')
    expect(wrapper.get('dialog').element.open).toBe(false)
    expect(document.activeElement).toBe(about.element)
  })

  it('starts a new conversation while leaving existing save slots intact', async () => {
    const store = useGameStore()
    store.roundCount = 3
    SaveSystem.save(1)
    const saved = localStorage.getItem('tiantaishiju_safety_save_1')
    const router = await openHomepage()
    await button('开始游戏').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/game?entry=new')
    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount)
    expect(localStorage.getItem('tiantaishiju_safety_save_1')).toBe(saved)
  })
})
