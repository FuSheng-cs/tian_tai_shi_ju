import CRC32 from 'crc-32'
import { GAME_RULES } from '@/domain/gameContract'
import type { PersistedGameState, StablePersistedGameState } from '@/domain/gameState'
import { useGameStore } from '@/store/gameStore'

const SAVE_KEY_PREFIX = 'damo_save_'

export interface SaveSlot {
  id: number;
  timestamp: number;
  data: string; // Base64 encoded JSON + CRC32
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
      const payload = {
        state: stateToSave,
        checksum
      }
      
      const base64Data = btoa(encodeURIComponent(JSON.stringify(payload)))
      
      const slot: SaveSlot = {
        id: slotId,
        timestamp: Date.now(),
        data: base64Data
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
      const slotStr = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`)
      if (!slotStr) return false
      
      const slot: SaveSlot = JSON.parse(slotStr)
      const jsonStr = decodeURIComponent(atob(slot.data))
      const payload = JSON.parse(jsonStr)
      
      const currentChecksum = CRC32.str(JSON.stringify(payload.state))
      if (currentChecksum !== payload.checksum) {
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

  static getSlots(): SaveSlot[] {
    const slots: SaveSlot[] = []
    for (const slotId of GAME_RULES.saveSlotIds) {
      const slotStr = localStorage.getItem(`${SAVE_KEY_PREFIX}${slotId}`)
      if (slotStr) {
        slots.push(JSON.parse(slotStr))
      }
    }
    return slots
  }
}
