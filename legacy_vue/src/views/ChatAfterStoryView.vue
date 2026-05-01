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
        <img src="/assets/images/char_girl_sneer.png" alt="Avatar" class="w-full h-full object-cover object-top" />
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
          <img src="/assets/images/char_girl_sneer.png" alt="Avatar" class="w-full h-full object-cover object-top" />
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
          <img src="/assets/images/char_girl_sneer.png" alt="Avatar" class="w-full h-full object-cover object-top" />
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
import { GAME_ROLE } from '@/domain/gameContract'
import type { Message } from '@/domain/gameState'
import { LLMService } from '@/modules/LLMService'
import { audioManager } from '@/modules/AudioManager'

const router = useRouter()
const inputText = ref('')
const isWaiting = ref(false)
const chatContainer = ref<HTMLElement | null>(null)

const messages = ref<Message[]>([
  { role: 'assistant', content: '我到家了。' },
  { role: 'assistant', content: '今天天台的风还挺大的。' }
])

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

  // Make the API call using a specific "After Story" prompt
  const reply = await LLMService.chatAfterStory(text, messages.value.slice(0, -1))
  
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
