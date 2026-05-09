<template>
  <div class="chat-after-story relative h-screen min-h-0 bg-gray-100 flex flex-col overflow-hidden">
    <!-- Header -->
    <div class="bg-gray-100 border-b border-gray-300 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
      <button @click="goHome" class="text-gray-600 hover:text-gray-900">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex-shrink-0">
        <img :src="CHAT_AVATAR_IMAGE" alt="Avatar" class="w-full h-full object-cover object-top" />
      </div>
      <div>
        <h1 class="font-bold text-gray-900">{{ GAME_ROLE.characterName }}</h1>
        <p class="text-xs text-gray-500">在线</p>
      </div>
      <button
        type="button"
        class="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isWaiting"
        data-test="chat-after-save"
        @click="openSaveSlots"
      >
        <Save :size="16" :stroke-width="1.9" aria-hidden="true" />
        <span>保存</span>
      </button>
    </div>

    <!-- Save Slots -->
    <div
      v-if="showSaveSlots"
      class="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
      data-test="chat-after-save-slots"
      @click.self="closeSaveSlots"
    >
      <section class="w-full max-w-sm rounded-lg border border-gray-300 bg-gray-50 p-5 text-gray-900 shadow-2xl" aria-label="保存日后谈">
        <header class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-bold">选择保存栏位</h2>
          <button
            type="button"
            class="text-2xl leading-none text-gray-500 transition-colors hover:text-gray-900"
            aria-label="关闭"
            @click="closeSaveSlots"
          >
            ×
          </button>
        </header>

        <div class="grid gap-3">
          <button
            v-for="slotId in SAVE_SLOT_IDS"
            :key="slotId"
            type="button"
            class="rounded-lg border border-gray-300 bg-white px-4 py-3 text-left transition-colors hover:border-green-500 hover:bg-green-50"
            data-test="chat-after-save-slot"
            @click="saveToSlot(slotId)"
          >
            <span class="block text-sm font-bold">{{ getSlotTitle(slotId) }}</span>
            <span class="mt-1 block text-xs text-gray-500">{{ getSlotStatus(slotId) }}</span>
          </button>
        </div>
      </section>
    </div>

    <!-- Chat Messages -->
    <div class="chat-scrollbar flex-1 min-h-0 overflow-y-scroll p-4 pr-2 space-y-4" ref="chatContainer">
      <div v-for="(msg, index) in messages" :key="index" class="flex" :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">
        
        <!-- Assistant Avatar -->
        <div v-if="msg.role === 'assistant'" class="w-8 h-8 rounded-full bg-gray-300 overflow-hidden flex-shrink-0 mr-2 mt-1">
          <img :src="CHAT_AVATAR_IMAGE" alt="Avatar" class="w-full h-full object-cover object-top" />
        </div>

        <!-- Message Bubble -->
        <div 
          class="max-w-[75%] rounded-2xl px-4 py-2 text-sm md:text-base break-words"
          :class="msg.role === 'user' ? 'bg-[#95ec69] text-gray-900 rounded-tr-sm' : 'bg-white text-gray-900 border border-gray-200 rounded-tl-sm'"
        >
          {{ msg.content }}
        </div>

        <!-- User Avatar (Mock) -->
        <div v-if="msg.role === 'user'" class="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0 ml-2 mt-1 flex items-center justify-center text-white text-xs">
          Me
        </div>
      </div>
      
      <!-- Typing Indicator -->
      <div v-if="isWaiting" class="flex justify-start">
        <div class="w-8 h-8 rounded-full bg-gray-300 overflow-hidden flex-shrink-0 mr-2 mt-1">
          <img :src="CHAT_AVATAR_IMAGE" alt="Avatar" class="w-full h-full object-cover object-top" />
        </div>
        <div class="bg-white text-gray-500 border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2 text-sm flex items-center gap-1">
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.1s"></span>
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
        </div>
      </div>
    </div>

    <!-- Input Area -->
    <div class="bg-gray-100 border-t border-gray-300 p-3 pb-safe">
      <div class="flex gap-2 items-end">
        <textarea 
          v-model="inputText"
          @keydown.enter.prevent="sendMessage"
          rows="1"
          class="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-green-500 resize-none max-h-32"
          placeholder="发消息..."
        ></textarea>
        <button 
          @click="sendMessage"
          :disabled="!inputText.trim() || isWaiting"
          class="bg-[#07c160] text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-10"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { CHAT_AFTER_SAVE_SLOT_SESSION_KEY, CHAT_AVATAR_IMAGE, GAME_ROLE, GAME_RULES } from '@/domain/gameContract'
import type { AfterStoryContext, Message } from '@/domain/gameState'
import { useGameStore } from '@/store/gameStore'
import { LLMService } from '@/modules/LLMService'
import { SAVE_SLOT_KINDS, SaveSystem, type SaveSlot } from '@/modules/SaveSystem'
import { audioManager } from '@/modules/AudioManager'
import { Save } from 'lucide-vue-next'

const router = useRouter()
const gameStore = useGameStore()
const inputText = ref('')
const isWaiting = ref(false)
const chatContainer = ref<HTMLElement | null>(null)
const showSaveSlots = ref(false)
const saveSlots = ref<SaveSlot[]>([])
const SAVE_SLOT_IDS = GAME_RULES.saveSlotIds

const normalizeLine = (value: string | null | undefined, maxLength = 48) => {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength)}...`
}

const latestMessageByRole = (role: Message['role']) =>
  [...gameStore.messages].reverse().find((message) => message.role === role)?.content ?? ''

const getTurnsUsed = () =>
  gameStore.endingSummary?.roundsUsed ?? Math.max(0, GAME_RULES.initialRoundCount - gameStore.roundCount)

const buildAfterStoryContext = (): AfterStoryContext => {
  const lastPlayerLine = latestMessageByRole('user')
  const endingReply = latestMessageByRole('assistant')

  return {
    endingType: gameStore.endingType,
    lastPlayerLine,
    endingReply,
    turningLine: gameStore.endingSummary?.turningLine ?? lastPlayerLine,
    endingComment: gameStore.endingSummary?.comment ?? '',
    roundsUsed: getTurnsUsed(),
    affectionBoostCount: gameStore.endingSummary?.affectionBoostCount ?? gameStore.affectionBoostCount,
    affection: gameStore.affection
  }
}

const buildInitialMessages = (context: AfterStoryContext): Message[] => {
  const keyLine = normalizeLine(context.turningLine || context.lastPlayerLine, 34)

  return [
    { role: 'assistant', content: '我到楼下了。刚才天台上的风还在耳边。' },
    {
      role: 'assistant',
      content: keyLine
        ? `你刚才说的「${keyLine}」，我还在想。`
        : '刚才的事，我还在慢慢消化。'
    }
  ]
}

const getLoadedSlotId = () => {
  const slotId = Number(sessionStorage.getItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY))
  return Number.isInteger(slotId) ? slotId : null
}

const loadSavedChatAfter = () => {
  const slotId = getLoadedSlotId()
  return slotId === null ? null : SaveSystem.loadChatAfter(slotId)
}

const savedChatAfter = loadSavedChatAfter()
const currentAfterStoryContext = ref<AfterStoryContext>(savedChatAfter?.afterStoryContext ?? buildAfterStoryContext())
const messages = ref<Message[]>(savedChatAfter?.messages ?? buildInitialMessages(currentAfterStoryContext.value))

const saveSlotMap = () => new Map(saveSlots.value.map((slot) => [slot.id, slot]))

const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || isWaiting.value) return

  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  isWaiting.value = true
  scrollToBottom()

  const reply = await LLMService.chatAfterStory(text, messages.value.slice(0, -1), currentAfterStoryContext.value)
  
  isWaiting.value = false
  messages.value.push({ role: 'assistant', content: reply })
  scrollToBottom()
}

const refreshSaveSlots = () => {
  saveSlots.value = SaveSystem.getSlots()
}

const formatSaveTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))

const getSlotTitle = (slotId: number) => {
  const slot = saveSlotMap().get(slotId)
  return slot?.kind === SAVE_SLOT_KINDS.chatAfter ? `栏位 ${slotId}（日后谈）` : `栏位 ${slotId}`
}

const getSlotStatus = (slotId: number) => {
  const slot = saveSlotMap().get(slotId)
  return slot ? `已有存档：${formatSaveTime(slot.timestamp)}` : '空栏位'
}

const openSaveSlots = () => {
  audioManager.playSfx('click')
  if (isWaiting.value) {
    alert('正在等待回应，暂时不能保存。')
    return
  }

  refreshSaveSlots()
  showSaveSlots.value = true
}

const closeSaveSlots = () => {
  showSaveSlots.value = false
}

const saveToSlot = (slotId: number) => {
  audioManager.playSfx('click')
  const existingSlot = saveSlotMap().get(slotId)
  if (existingSlot && !confirm(`栏位 ${slotId} 已有存档，是否覆盖？`)) return

  if (SaveSystem.saveChatAfter(slotId, {
    messages: messages.value,
    afterStoryContext: currentAfterStoryContext.value
  })) {
    sessionStorage.setItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY, String(slotId))
    refreshSaveSlots()
    showSaveSlots.value = false
    alert(`日后谈已保存至栏位 ${slotId}`)
  } else {
    alert('保存失败')
  }
}

const goHome = () => {
  audioManager.playSfx('click')
  router.push('/')
}

onMounted(() => {
  scrollToBottom()
})
</script>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 12px);
}

.chat-scrollbar {
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(7, 193, 96, 0.45) rgba(0, 0, 0, 0.06);
  overscroll-behavior: contain;
}

.chat-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.chat-scrollbar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 999px;
}

.chat-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(7, 193, 96, 0.45);
  border-radius: 999px;
}

.chat-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(7, 193, 96, 0.65);
}
</style>
