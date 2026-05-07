import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  AI_STATES,
  DEATH_ENDING_SEQUENCE_FRAMES,
  ENDINGS,
  GAME_ENTRY_SESSION_KEY,
  GAME_ENTRY_TYPES,
  OPENING_SEQUENCE_FRAMES,
  ROOFTOP_BGM_SRCS,
  SCENE_BACKGROUNDS
} from '../src/domain/gameContract'
import { useGameStore } from '../src/store/gameStore'
import EndingSequenceOverlay from '../src/components/EndingSequenceOverlay.vue'
import OpeningSequenceOverlay from '../src/components/OpeningSequenceOverlay.vue'
import GameView from '../src/views/GameView.vue'
import StartView from '../src/views/StartView.vue'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  playBgm: vi.fn(),
  preloadBgm: vi.fn(),
  stopBgm: vi.fn(),
  playSfx: vi.fn(),
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
      playSfx: mocks.playSfx,
      playBgm: mocks.playBgm,
      stopBgm: mocks.stopBgm,
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
      EndingSequenceOverlay: {
        name: 'EndingSequenceOverlay',
        props: ['frames'],
        template: '<button data-test="death-ending-sequence" :data-frame-count="frames.length" @click="$emit(\'complete\')">death</button>'
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
    mocks.stopBgm.mockClear()
    mocks.playSfx.mockClear()
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
    expect(mocks.playBgm).toHaveBeenCalledWith(ROOFTOP_BGM_SRCS)

    await wrapper.find('[data-test="opening-sequence"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-test="opening-sequence"]').exists()).toBe(false)
  })

  it('does not play the opening sequence when entering from a loaded save', () => {
    sessionStorage.setItem(GAME_ENTRY_SESSION_KEY, GAME_ENTRY_TYPES.load)
    const wrapper = mountGameView()

    expect(wrapper.find('[data-test="opening-sequence"]').exists()).toBe(false)
    expect(mocks.playBgm).toHaveBeenCalledWith(ROOFTOP_BGM_SRCS)
  })

  it('unlocks the first encounter when entering the game', () => {
    mountGameView()

    expect(mocks.unlock).toHaveBeenCalledWith('first_try')
  })

  it('uses the smoking CG while waiting for the LLM response', () => {
    const store = useGameStore()
    store.lastAiStateTag = AI_STATES.wavering.type
    store.isWaiting = true

    const wrapper = mountGameView()

    expect(wrapper.find('img[alt="Background"]').attributes('src')).toBe(SCENE_BACKGROUNDS.smoke)
  })

  it('does not flash the critical CG while waiting on a provisional chance decrement', async () => {
    const store = useGameStore()
    store.roundCount = 3
    store.lastAiStateTag = AI_STATES.guarded.type
    let resolveChat!: (value: unknown) => void
    mocks.chat.mockReturnValueOnce(new Promise((resolve) => {
      resolveChat = resolve
    }))
    const wrapper = mountGameView()

    await wrapper.find('.typewriter-text').trigger('click')
    await nextTick()
    await wrapper.find('input').setValue('我先坐在这里。')
    await wrapper.find('input').trigger('keyup.enter')
    await nextTick()

    expect(store.roundCount).toBe(2)
    expect(store.isWaiting).toBe(true)
    expect(wrapper.find('img[alt="Background"]').attributes('src')).toBe(SCENE_BACKGROUNDS.smoke)
    expect(wrapper.find('img[alt="Background"]').attributes('src')).not.toBe(AI_STATES.edge.backgroundImage)

    resolveChat({
      reply: '她沉默了一会儿。',
      evaluation: {
        emotion: 'normal',
        aiState: AI_STATES.guarded.type,
        affectionDelta: 5,
        pressureDelta: 0,
        endingType: null,
        confidence: 1
      }
    })
    await flushPromises()

    expect(store.roundCount).toBe(3)
    expect(store.isWaiting).toBe(false)
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
    expect(wrapper.find('[data-test="death-ending-sequence"]').exists()).toBe(false)
  })

  it('plays the death ending sequence before showing settlement for a new death ending', async () => {
    mocks.chat.mockResolvedValueOnce({
      reply: 'death reply',
      evaluation: {
        emotion: 'normal',
        aiState: AI_STATES.edge.type,
        affectionDelta: 0,
        pressureDelta: 0,
        endingType: ENDINGS.death.type,
        confidence: 1
      }
    })
    const wrapper = mountGameView()

    await wrapper.find('.typewriter-text').trigger('click')
    await nextTick()
    await wrapper.find('input').setValue('ordinary line')
    await wrapper.find('input').trigger('keyup.enter')
    await flushPromises()

    expect(wrapper.find('img[alt="Background"]').attributes('src')).toBe(AI_STATES.edge.backgroundImage)
    expect(wrapper.find('img[alt="Background"]').attributes('src')).not.toBe(ENDINGS.death.backgroundImage)
    expect(wrapper.find('img[alt="Background"]').classes()).toContain('death-cinematic-background')

    await wrapper.find('.typewriter-text').trigger('click')
    await nextTick()

    const sequence = wrapper.find('[data-test="death-ending-sequence"]')
    expect(sequence.exists()).toBe(true)
    expect(sequence.attributes('data-frame-count')).toBe('5')
    expect(wrapper.find('[data-test="ending-settlement"]').exists()).toBe(false)
    expect(mocks.stopBgm).toHaveBeenCalledTimes(1)

    await sequence.trigger('click')
    await nextTick()

    expect(wrapper.find('[data-test="death-ending-sequence"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="ending-settlement"]').exists()).toBe(true)
    expect(wrapper.find('img[alt="Background"]').attributes('src')).toBe(DEATH_ENDING_SEQUENCE_FRAMES[4].image)
  })

  it('does not replay the death sequence for an already loaded death ending', async () => {
    const store = useGameStore()
    store.isEnding = true
    store.endingType = ENDINGS.death.type
    store.messages = [{ role: 'assistant', content: 'death reply' }]

    const wrapper = mountGameView()
    await wrapper.find('.typewriter-text').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-test="death-ending-sequence"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="ending-settlement"]').exists()).toBe(true)
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
    expect(mocks.playStairStep).toHaveBeenLastCalledWith(0)
    expect(wrapper.find('.opening-caption').text()).toBe(OPENING_SEQUENCE_FRAMES[1].caption)

    await wrapper.find('.opening-sequence').trigger('click')
    expect(mocks.playStairStep).toHaveBeenCalledTimes(2)
    expect(mocks.playStairStep).toHaveBeenLastCalledWith(1)
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
    expect(mocks.playStairStep).toHaveBeenCalledTimes(OPENING_SEQUENCE_FRAMES.length - 1)
    await wrapper.find('.continue-button').trigger('click')
    await vi.advanceTimersByTimeAsync(420)

    expect(mocks.playStairStep).toHaveBeenCalledTimes(OPENING_SEQUENCE_FRAMES.length)
    expect(mocks.playStairStep).toHaveBeenLastCalledWith(OPENING_SEQUENCE_FRAMES.length - 1)
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
    expect(mocks.playStairStep).toHaveBeenLastCalledWith(OPENING_SEQUENCE_FRAMES.length - 1)

    await vi.advanceTimersByTimeAsync(640)
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('advances the death ending overlay by click, keyboard, and final completion', async () => {
    vi.useFakeTimers()
    const wrapper = mount(EndingSequenceOverlay, {
      props: {
        frames: DEATH_ENDING_SEQUENCE_FRAMES
      }
    })

    expect(wrapper.find('.ending-sequence-caption').text()).toBe(DEATH_ENDING_SEQUENCE_FRAMES[0].caption)

    await wrapper.find('.ending-sequence').trigger('keydown.enter')
    expect(wrapper.find('.ending-sequence-caption').text()).toBe(DEATH_ENDING_SEQUENCE_FRAMES[1].caption)

    await wrapper.find('.ending-sequence').trigger('keydown.space')
    expect(wrapper.find('.ending-sequence-caption').text()).toBe(DEATH_ENDING_SEQUENCE_FRAMES[2].caption)

    for (let index = 3; index < DEATH_ENDING_SEQUENCE_FRAMES.length; index += 1) {
      await wrapper.find('.ending-sequence-continue').trigger('click')
    }
    expect(wrapper.find('.ending-sequence-caption').text()).toBe(DEATH_ENDING_SEQUENCE_FRAMES[DEATH_ENDING_SEQUENCE_FRAMES.length - 1].caption)
    expect(mocks.playSfx).toHaveBeenCalledWith('fall_impact')
    expect(mocks.playSfx.mock.calls.filter(([name]) => name === 'fall_impact')).toHaveLength(1)
    expect(wrapper.find('.ending-sequence-red-impact').classes()).toContain('ending-sequence-red-impact-active')

    await wrapper.find('.ending-sequence-continue').trigger('click')
    await vi.advanceTimersByTimeAsync(420)

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

})
