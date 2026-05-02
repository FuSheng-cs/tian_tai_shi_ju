import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  ENDINGS,
  GAME_ENTRY_SESSION_KEY,
  GAME_ENTRY_TYPES,
  OPENING_SEQUENCE_FRAMES,
  ROOFTOP_BGM_SRC
} from '../src/domain/gameContract'
import { useGameStore } from '../src/store/gameStore'
import OpeningSequenceOverlay from '../src/components/OpeningSequenceOverlay.vue'
import GameView from '../src/views/GameView.vue'
import StartView from '../src/views/StartView.vue'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  playBgm: vi.fn(),
  preloadBgm: vi.fn(),
  playStairStep: vi.fn(),
  chat: vi.fn(),
  getSlots: vi.fn(() => [{ id: 1, timestamp: 1710000000000, data: 'slot' }]),
  load: vi.fn(() => true),
  save: vi.fn(() => true),
  unlock: vi.fn(),
  evaluateFromState: vi.fn(),
  evaluateSaveSlots: vi.fn()
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: mocks.push })
}))

vi.mock('../src/modules/AudioManager', () => ({
  audioManager: {
    preloadBgm: mocks.preloadBgm,
    playSfx: vi.fn(),
    playBgm: mocks.playBgm,
    playStairStep: mocks.playStairStep
  }
}))

vi.mock('../src/modules/SaveSystem', () => ({
  SaveSystem: {
    getSlots: mocks.getSlots,
    load: mocks.load,
    save: mocks.save
  }
}))

vi.mock('../src/modules/AchievementTracker', () => ({
  AchievementTracker: {
    unlock: mocks.unlock,
    evaluateFromState: mocks.evaluateFromState,
    evaluateSaveSlots: mocks.evaluateSaveSlots
  }
}))

vi.mock('../src/modules/LLMService', () => ({
  LLMService: {
    chat: mocks.chat,
    getHint: vi.fn(),
    getEndingSummary: vi.fn()
  }
}))

const mountGameView = () => mount(GameView, {
  global: {
    stubs: {
      OpeningSequenceOverlay: {
        name: 'OpeningSequenceOverlay',
        props: ['frames'],
        template: '<button data-test="opening-sequence" :data-frame-count="frames.length" @click="$emit(\'complete\')">opening</button>'
      },
      TypewriterText: {
        props: ['text'],
        template: '<div class="typewriter-text" @click="$emit(\'complete\')">{{ text }}</div>'
      },
      ProgressBar: true
    }
  }
})

describe('opening guide flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
    mocks.push.mockClear()
    mocks.playBgm.mockClear()
    mocks.preloadBgm.mockClear()
    mocks.playStairStep.mockClear()
    mocks.chat.mockReset()
    mocks.chat.mockResolvedValue('她沉默了一会儿。')
    mocks.getSlots.mockClear()
    mocks.getSlots.mockReturnValue([{ id: 1, timestamp: 1710000000000, data: 'slot' }])
    mocks.load.mockClear()
    mocks.load.mockReturnValue(true)
    mocks.save.mockClear()
    mocks.save.mockReturnValue(true)
    mocks.unlock.mockClear()
    mocks.evaluateFromState.mockClear()
    mocks.evaluateSaveSlots.mockClear()
    vi.stubGlobal('alert', vi.fn())
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.useRealTimers()
  })

  it('marks the next game entry as a new game from the start screen', async () => {
    const wrapper = mount(StartView)

    await wrapper.find('.menu-button-primary').trigger('click')

    expect(sessionStorage.getItem(GAME_ENTRY_SESSION_KEY)).toBe(GAME_ENTRY_TYPES.newGame)
    expect(mocks.push).toHaveBeenCalledWith('/game')
  })

  it('marks the next game entry as a loaded save when loading a slot', async () => {
    const wrapper = mount(StartView)

    await wrapper.findAll('.menu-button')[1].trigger('click')
    await wrapper.find('.save-slot-button').trigger('click')

    expect(sessionStorage.getItem(GAME_ENTRY_SESSION_KEY)).toBe(GAME_ENTRY_TYPES.load)
    expect(mocks.push).toHaveBeenCalledWith('/game')
  })

  it('shows the full opening sequence on every new game entry', async () => {
    localStorage.setItem('damo_opening_guide_seen_v1', '1')
    sessionStorage.setItem(GAME_ENTRY_SESSION_KEY, GAME_ENTRY_TYPES.newGame)
    const wrapper = mountGameView()
    await nextTick()

    const opening = wrapper.find('[data-test="opening-sequence"]')
    expect(opening.exists()).toBe(true)
    expect(opening.attributes('data-frame-count')).toBe('5')
    expect(mocks.playBgm).toHaveBeenCalledWith(ROOFTOP_BGM_SRC)

    await wrapper.find('[data-test="opening-sequence"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-test="opening-sequence"]').exists()).toBe(false)
  })

  it('does not play the opening sequence when entering from a loaded save', () => {
    sessionStorage.setItem(GAME_ENTRY_SESSION_KEY, GAME_ENTRY_TYPES.load)
    const wrapper = mountGameView()

    expect(wrapper.find('[data-test="opening-sequence"]').exists()).toBe(false)
    expect(mocks.playBgm).toHaveBeenCalledWith(ROOFTOP_BGM_SRC)
  })

  it('unlocks the first encounter when entering the game', () => {
    mountGameView()

    expect(mocks.unlock).toHaveBeenCalledWith('first_try')
  })

  it('evaluates achievements after the first player message', async () => {
    const wrapper = mountGameView()

    await wrapper.find('.typewriter-text').trigger('click')
    await nextTick()
    await wrapper.find('input').setValue('我只是想先听你说完。')
    await wrapper.find('input').trigger('keyup.enter')
    await flushPromises()

    expect(mocks.evaluateFromState).toHaveBeenCalled()
  })

  it('unlocks ending achievements after the ending text completes', async () => {
    const store = useGameStore()
    store.isEnding = true
    store.endingType = ENDINGS.acquaintance.type
    store.messages = [{ role: 'assistant', content: '她把烟按灭了。' }]

    const wrapper = mountGameView()
    await wrapper.find('.typewriter-text').trigger('click')

    expect(mocks.unlock).toHaveBeenCalledWith(ENDINGS.acquaintance.type)
    expect(mocks.evaluateFromState).toHaveBeenCalled()
  })

  it('evaluates save achievements after a successful save', async () => {
    const wrapper = mountGameView()

    const saveButton = wrapper.findAll('button').find((button) => button.text().includes('保存'))
    expect(saveButton).toBeTruthy()
    await saveButton!.trigger('click')
    await wrapper.find('.grid button').trigger('click')

    expect(mocks.save).toHaveBeenCalledWith(1)
    expect(mocks.evaluateSaveSlots).toHaveBeenCalledWith([{ id: 1, timestamp: 1710000000000, data: 'slot' }])
  })

  it('advances the opening overlay by player clicks and plays steps on frame changes', async () => {
    vi.useFakeTimers()
    const wrapper = mount(OpeningSequenceOverlay, {
      props: {
        frames: OPENING_SEQUENCE_FRAMES
      }
    })

    expect(wrapper.find('.opening-caption').text()).toBe(OPENING_SEQUENCE_FRAMES[0].caption)
    expect(mocks.playStairStep).not.toHaveBeenCalled()

    await wrapper.find('.continue-button').trigger('click')
    expect(mocks.playStairStep).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.opening-caption').text()).toBe(OPENING_SEQUENCE_FRAMES[1].caption)

    await wrapper.find('.opening-sequence').trigger('click')
    expect(mocks.playStairStep).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.opening-caption').text()).toBe(OPENING_SEQUENCE_FRAMES[2].caption)

    wrapper.unmount()
  })

  it('clicking the last opening frame completes the sequence', async () => {
    vi.useFakeTimers()
    const wrapper = mount(OpeningSequenceOverlay, {
      props: {
        frames: OPENING_SEQUENCE_FRAMES
      }
    })

    for (let index = 1; index < OPENING_SEQUENCE_FRAMES.length; index += 1) {
      await wrapper.find('.continue-button').trigger('click')
    }

    expect(wrapper.find('.opening-caption').text()).toBe(OPENING_SEQUENCE_FRAMES[OPENING_SEQUENCE_FRAMES.length - 1].caption)
    await wrapper.find('.continue-button').trigger('click')
    await vi.advanceTimersByTimeAsync(420)

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('skip jumps to the final frame before completing', async () => {
    vi.useFakeTimers()
    const wrapper = mount(OpeningSequenceOverlay, {
      props: {
        frames: OPENING_SEQUENCE_FRAMES
      }
    })

    await wrapper.find('.skip-button').trigger('click')
    expect(wrapper.find('.opening-caption').text()).toBe(OPENING_SEQUENCE_FRAMES[OPENING_SEQUENCE_FRAMES.length - 1].caption)

    await vi.advanceTimersByTimeAsync(640)
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

})
