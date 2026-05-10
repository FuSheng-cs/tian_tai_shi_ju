import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import CRC32 from 'crc-32'
import { AI_STATES, EMOTIONS, ENDINGS, GAME_RULES } from '../src/domain/gameContract'
import { useGameStore } from '../src/store/gameStore'
import { SAVE_SLOT_KINDS, SaveSystem } from '../src/modules/SaveSystem'

describe('Save System', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('saves and loads state successfully', () => {
    const store = useGameStore()
    store.roundCount = 5
    store.affection = 15
    store.affectionBoostCount = 3
    store.affectionBoostMessages = ['别急着走。']
    store.lastAiStateTag = AI_STATES.wavering.type
    store.aiStateHistory = [AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type]
    store.lastEmotionTag = EMOTIONS.soft.type
    store.emotionHistory = [EMOTIONS.sting.type, EMOTIONS.soft.type]
    store.endingSummary = {
      roundsUsed: 5,
      affectionBoostCount: 3,
      turningLine: '别急着走。',
      comment: '她在这句话里停了一下。'
    }
    
    const success = SaveSystem.save(1)
    expect(success).toBe(true)
    expect(SaveSystem.getSlotKind(1)).toBe(SAVE_SLOT_KINDS.game)
    
    // Reset store
    store.resetGame()
    expect(store.roundCount).toBe(GAME_RULES.initialRoundCount)
    
    // Load
    const loadSuccess = SaveSystem.load(1)
    expect(loadSuccess).toBe(true)
    expect(store.roundCount).toBe(5)
    expect(store.affection).toBe(15)
    expect(store.affectionBoostCount).toBe(3)
    expect(store.affectionBoostMessages).toEqual(['别急着走。'])
    expect(store.lastAiStateTag).toBe(AI_STATES.wavering.type)
    expect(store.aiStateHistory).toEqual([AI_STATES.guarded.type, AI_STATES.watching.type, AI_STATES.wavering.type])
    expect(store.lastEmotionTag).toBe(EMOTIONS.soft.type)
    expect(store.emotionHistory).toEqual([EMOTIONS.sting.type, EMOTIONS.soft.type])
    expect(store.endingSummary).toEqual({
      roundsUsed: 5,
      affectionBoostCount: 3,
      turningLine: '别急着走。',
      comment: '她在这句话里停了一下。'
    })
  })

  it('does not save while waiting for an async response', () => {
    const store = useGameStore()
    store.roundCount = 5
    store.isWaiting = true

    const success = SaveSystem.save(1)

    expect(success).toBe(false)
    expect(localStorage.getItem('damo_save_1')).toBeNull()
  })

  it('supports three independent save slots', () => {
    const store = useGameStore()
    store.roundCount = 9
    expect(SaveSystem.save(1)).toBe(true)

    store.roundCount = 6
    store.affection = 5
    expect(SaveSystem.save(2)).toBe(true)

    store.roundCount = 3
    store.affection = 10
    expect(SaveSystem.save(3)).toBe(true)

    const slots = SaveSystem.getSlots()
    expect(slots.map((slot) => slot.id)).toEqual(GAME_RULES.saveSlotIds)

    store.resetGame()
    expect(SaveSystem.load(2)).toBe(true)
    expect(store.roundCount).toBe(6)
    expect(store.affection).toBe(5)
  })

  it('loads old game saves without an explicit kind field', () => {
    const store = useGameStore()
    const state = {
      roundCount: 4,
      hintCount: GAME_RULES.initialHintCount,
      affection: 5,
      affectionBoostCount: 1,
      affectionBoostMessages: ['我在。'],
      lastAiStateTag: AI_STATES.watching.type,
      aiStateHistory: [AI_STATES.guarded.type, AI_STATES.watching.type],
      lastEmotionTag: null,
      emotionHistory: [],
      messages: [{ role: 'assistant' as const, content: '旧存档。' }],
      isEnding: false,
      endingType: null,
      endingSummary: null
    }
    const payload = {
      state,
      checksum: CRC32.str(JSON.stringify(state))
    }
    localStorage.setItem('damo_save_1', JSON.stringify({
      id: 1,
      timestamp: 1710000000000,
      data: btoa(encodeURIComponent(JSON.stringify(payload)))
    }))

    expect(SaveSystem.getSlotKind(1)).toBe(SAVE_SLOT_KINDS.game)
    expect(SaveSystem.load(1)).toBe(true)
    expect(store.roundCount).toBe(4)
    expect(store.messages).toEqual([{ role: 'assistant', content: '旧存档。' }])
  })

  it('saves and loads after-story chat slots', () => {
    const data = {
      messages: [
        { role: 'assistant' as const, content: '我到楼下了。' },
        { role: 'user' as const, content: '到家了吗？' }
      ],
      afterStoryContext: {
        endingType: ENDINGS.acquaintance.type,
        lastPlayerLine: '我在这儿。',
        endingReply: '她把手机递过来。',
        turningLine: '我在这儿。',
        endingComment: '她记住了这句话。',
        roundsUsed: 8,
        affectionBoostCount: 4,
        affection: 24
      }
    }

    expect(SaveSystem.saveChatAfter(2, data)).toBe(true)

    const slots = SaveSystem.getSlots()
    expect(slots.find((slot) => slot.id === 2)?.kind).toBe(SAVE_SLOT_KINDS.chatAfter)
    expect(SaveSystem.load(2)).toBe(false)
    expect(SaveSystem.loadChatAfter(2)).toEqual(data)
  })

  it('fails to load if data is tampered', () => {
    const store = useGameStore()
    SaveSystem.save(1)
    
    // Tamper data
    const savedStr = localStorage.getItem('damo_save_1')
    if (savedStr) {
      const saved = JSON.parse(savedStr)
      // Base64 decode, modify, encode
      const jsonStr = decodeURIComponent(atob(saved.data))
      const payload = JSON.parse(jsonStr)
      payload.state.roundCount = 999 // Cheat
      saved.data = btoa(encodeURIComponent(JSON.stringify(payload)))
      localStorage.setItem('damo_save_1', JSON.stringify(saved))
    }
    
    // Try to load
    const loadSuccess = SaveSystem.load(1)
    expect(loadSuccess).toBe(false)
  })

  it('fails to load after-story chat if data is tampered', () => {
    SaveSystem.saveChatAfter(1, {
      messages: [{ role: 'assistant', content: '我到楼下了。' }],
      afterStoryContext: {
        endingType: ENDINGS.acquaintance.type,
        lastPlayerLine: '我在这儿。',
        endingReply: '她把手机递过来。',
        turningLine: '我在这儿。',
        endingComment: '她记住了这句话。',
        roundsUsed: 8,
        affectionBoostCount: 4,
        affection: 24
      }
    })

    const savedStr = localStorage.getItem('damo_save_1')
    if (savedStr) {
      const saved = JSON.parse(savedStr)
      const jsonStr = decodeURIComponent(atob(saved.data))
      const payload = JSON.parse(jsonStr)
      payload.state.messages.push({ role: 'user', content: '篡改。' })
      saved.data = btoa(encodeURIComponent(JSON.stringify(payload)))
      localStorage.setItem('damo_save_1', JSON.stringify(saved))
    }

    expect(SaveSystem.loadChatAfter(1)).toBeNull()
  })
})
