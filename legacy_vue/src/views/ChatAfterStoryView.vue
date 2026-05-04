<template>
  <div class="chat-after-story h-screen min-h-0 bg-gray-100 flex flex-col overflow-hidden">
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
import { CHAT_AVATAR_IMAGE, GAME_ROLE, GAME_RULES } from '@/domain/gameContract'
import type { AfterStoryContext, Message } from '@/domain/gameState'
import { useGameStore } from '@/store/gameStore'
import { LLMService } from '@/modules/LLMService'
import { audioManager } from '@/modules/AudioManager'

const router = useRouter()
const gameStore = useGameStore()
const inputText = ref('')
const isWaiting = ref(false)
const chatContainer = ref<HTMLElement | null>(null)

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

const buildInitialMessages = (): Message[] => {
  const context = buildAfterStoryContext()
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

const messages = ref<Message[]>(buildInitialMessages())

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

  const reply = await LLMService.chatAfterStory(text, messages.value.slice(0, -1), buildAfterStoryContext())
  
  isWaiting.value = false
  messages.value.push({ role: 'assistant', content: reply })
  scrollToBottom()
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
