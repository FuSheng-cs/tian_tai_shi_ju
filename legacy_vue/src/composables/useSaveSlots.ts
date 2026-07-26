import { computed, ref } from 'vue'
import { SAVE_SLOT_KINDS, SaveSystem, type SaveSlot } from '@/modules/SaveSystem'

const formatSaveTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))

export const useSaveSlots = () => {
  const saveSlots = ref<SaveSlot[]>([])
  const saveSlotMap = computed(() => new Map(saveSlots.value.map((slot) => [slot.id, slot])))

  const refreshSaveSlots = () => {
    saveSlots.value = SaveSystem.getSlots()
  }

  const getSlot = (slotId: number) => saveSlotMap.value.get(slotId)
  const hasSlot = (slotId: number) => saveSlotMap.value.has(slotId)

  const getSlotTitle = (slotId: number) =>
    getSlot(slotId)?.kind === SAVE_SLOT_KINDS.chatAfter
      ? `栏位 ${slotId}（日后谈）`
      : `栏位 ${slotId}`

  const getSlotStatus = (slotId: number) => {
    const slot = getSlot(slotId)
    return slot ? `已有存档：${formatSaveTime(slot.timestamp)}` : '空栏位'
  }

  return {
    saveSlots,
    refreshSaveSlots,
    getSlot,
    hasSlot,
    getSlotTitle,
    getSlotStatus
  }
}
