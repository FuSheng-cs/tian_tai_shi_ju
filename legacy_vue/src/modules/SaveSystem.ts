import CRC32 from 'crc-32'
import { GAME_RULES } from '@/domain/gameContract'
import type { AfterStoryContext, Message, PersistedGameState, StablePersistedGameState } from '@/domain/gameState'
import { useGameStore } from '@/store/gameStore'

const SAVE_KEY_PREFIX = 'damo_save_'

export const SAVE_SLOT_KINDS = {
  game: 'game',
  chatAfter: 'chatAfter'
} as const

export type SaveSlotKind = typeof SAVE_SLOT_KINDS[keyof typeof SAVE_SLOT_KINDS]

export interface SaveSlot {
  id: number;
  timestamp: number;
  data: string; // Base64 encoded JSON + CRC32
  kind: SaveSlotKind;
}

export interface ChatAfterSaveData {
  messages: Message[];
  afterStoryContext: AfterStoryContext;
}

interface StoredSaveSlot {
  id: number;
  timestamp: number;
  data: string;
  kind?: SaveSlotKind;
}

interface GameSavePayload {
  kind?: SaveSlotKind;
  state: StablePersistedGameState;
  checksum: number;
}

interface ChatAfterSavePayload {
  kind: typeof SAVE_SLOT_KINDS.chatAfter;
  state: ChatAfterSaveData;
  checksum: number;
}

const encodePayload = (payload: GameSavePayload | ChatAfterSavePayload) =>
  btoa(encodeURIComponent(JSON.stringify(payload)))

const decodePayload = (slot: StoredSaveSlot) =>
  JSON.parse(decodeURIComponent(atob(slot.data)))

const checksumMatches = (state: unknown, checksum: unknown) =>
  typeof checksum === 'number' && CRC32.str(JSON.stringify(state)) === checksum

const normalizeSlotKind = (value: unknown): SaveSlotKind =>
  value === SAVE_SLOT_KINDS.chatAfter ? SAVE_SLOT_KINDS.chatAfter : SAVE_SLOT_KINDS.game

const normalizeSlot = (slot: StoredSaveSlot): SaveSlot => ({
  id: slot.id,
  timestamp: slot.timestamp,
  data: slot.data,
  kind: normalizeSlotKind(slot.kind)
})

const readSlot = (slotId: number): SaveSlot | null => {
  const slotStr = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`)
  if (!slotStr) return null

  try {
    return normalizeSlot(JSON.parse(slotStr) as StoredSaveSlot)
  } catch (e) {
    console.error('Failed to parse save slot:', e)
    return null
  }
}

const isMessageArray = (value: unknown): value is Message[] =>
  Array.isArray(value) && value.every((message) =>
    message &&
    typeof message === 'object' &&
    (message as Message).role &&
    ['user', 'assistant'].includes((message as Message).role) &&
    typeof (message as Message).content === 'string'
  )

const isAfterStoryContext = (value: unknown): value is AfterStoryContext => {
  if (!value || typeof value !== 'object') return false
  const context = value as Partial<AfterStoryContext>
  return (
    'endingType' in context &&
    typeof context.lastPlayerLine === 'string' &&
    typeof context.endingReply === 'string' &&
    typeof context.turningLine === 'string' &&
    typeof context.endingComment === 'string' &&
    typeof context.roundsUsed === 'number' &&
    typeof context.affectionBoostCount === 'number' &&
    typeof context.affection === 'number'
  )
}

export class SaveSystem {
  static save(slotId: number): boolean {
    try {
      const gameStore = useGameStore()
      if (gameStore.isWaiting) return false

      const stateToSave: StablePersistedGameState = {
        roundCount: gameStore.roundCount,
        hintCount: gameStore.hintCount,
        affection: gameStore.affection,
        affectionBoostCount: gameStore.affectionBoostCount,
        affectionBoostMessages: [...gameStore.affectionBoostMessages],
        lastAiStateTag: gameStore.lastAiStateTag,
        aiStateHistory: [...gameStore.aiStateHistory],
        lastEmotionTag: gameStore.lastEmotionTag,
        emotionHistory: [...gameStore.emotionHistory],
        messages: [...gameStore.messages],
        isEnding: gameStore.isEnding,
        endingType: gameStore.endingType,
        endingSummary: gameStore.endingSummary
      }
      
      const jsonStr = JSON.stringify(stateToSave)
      const checksum = CRC32.str(jsonStr)
      const payload: GameSavePayload = {
        kind: SAVE_SLOT_KINDS.game,
        state: stateToSave,
        checksum
      }
      
      const base64Data = encodePayload(payload)
      
      const slot: SaveSlot = {
        id: slotId,
        timestamp: Date.now(),
        data: base64Data,
        kind: SAVE_SLOT_KINDS.game
      }
      
      localStorage.setItem(`${SAVE_KEY_PREFIX}${slotId}`, JSON.stringify(slot))
      return true
    } catch (e) {
      console.error('Failed to save game:', e)
      return false
    }
  }

  static load(slotId: number): boolean {
    try {
      const slot = readSlot(slotId)
      if (!slot || slot.kind !== SAVE_SLOT_KINDS.game) return false
      
      const payload = decodePayload(slot) as GameSavePayload
      
      if (!checksumMatches(payload.state, payload.checksum)) {
        console.error('Save file corrupted: Checksum mismatch')
        return false
      }
      
      const gameStore = useGameStore()
      gameStore.loadState(payload.state as PersistedGameState)
      return true
    } catch (e) {
      console.error('Failed to load game:', e)
      return false
    }
  }

  static saveChatAfter(slotId: number, data: ChatAfterSaveData): boolean {
    try {
      const stateToSave: ChatAfterSaveData = {
        messages: [...data.messages],
        afterStoryContext: { ...data.afterStoryContext }
      }
      const payload: ChatAfterSavePayload = {
        kind: SAVE_SLOT_KINDS.chatAfter,
        state: stateToSave,
        checksum: CRC32.str(JSON.stringify(stateToSave))
      }

      const slot: SaveSlot = {
        id: slotId,
        timestamp: Date.now(),
        data: encodePayload(payload),
        kind: SAVE_SLOT_KINDS.chatAfter
      }

      localStorage.setItem(`${SAVE_KEY_PREFIX}${slotId}`, JSON.stringify(slot))
      return true
    } catch (e) {
      console.error('Failed to save after-story chat:', e)
      return false
    }
  }

  static loadChatAfter(slotId: number): ChatAfterSaveData | null {
    try {
      const slot = readSlot(slotId)
      if (!slot || slot.kind !== SAVE_SLOT_KINDS.chatAfter) return null

      const payload = decodePayload(slot) as ChatAfterSavePayload
      if (!checksumMatches(payload.state, payload.checksum)) {
        console.error('Save file corrupted: Checksum mismatch')
        return null
      }

      const state = payload.state
      if (!isMessageArray(state?.messages) || !isAfterStoryContext(state?.afterStoryContext)) {
        console.error('Save file corrupted: Invalid after-story chat data')
        return null
      }

      return {
        messages: state.messages,
        afterStoryContext: state.afterStoryContext
      }
    } catch (e) {
      console.error('Failed to load after-story chat:', e)
      return null
    }
  }

  static getSlot(slotId: number): SaveSlot | null {
    return readSlot(slotId)
  }

  static getSlotKind(slotId: number): SaveSlotKind | null {
    return readSlot(slotId)?.kind ?? null
  }

  static getSlots(): SaveSlot[] {
    const slots: SaveSlot[] = []
    for (const slotId of GAME_RULES.saveSlotIds) {
      const slot = readSlot(slotId)
      if (slot) {
        slots.push(slot)
      }
    }
    return slots
  }
}
