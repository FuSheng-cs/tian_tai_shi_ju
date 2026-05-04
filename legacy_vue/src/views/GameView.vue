<template>
  <div class="game-view min-h-screen w-full relative flex flex-col bg-black text-gray-100 overflow-hidden">
    <!-- Background (now using the character images directly as they contain the full scene) -->
    <div class="absolute inset-0 z-0">
      <picture class="block h-full w-full">
        <source :srcset="currentBg.mobile" media="(max-width: 768px)" />
        <img
          :src="currentBg.desktop"
          class="w-full h-full object-cover transition-opacity duration-1000"
          :class="gameStore.isEnding ? 'opacity-100' : 'opacity-80'"
          alt="Background"
          decoding="async"
        />
      </picture>
    </div>

    <OpeningSequenceOverlay
      v-if="isOpeningSequenceActive"
      :frames="OPENING_SEQUENCE_FRAMES"
      @complete="completeOpeningSequence"
    />

    <EndingSequenceOverlay
      v-if="isDeathEndingSequenceActive"
      :frames="DEATH_ENDING_SEQUENCE_FRAMES"
      @complete="completeDeathEndingSequence"
    />

    <!-- Character layer removed since the new images are full-scene compositions -->

    <!-- Top UI -->
    <div class="absolute top-0 left-0 right-0 z-30 flex flex-wrap items-start justify-between gap-3 p-4 pointer-events-auto md:p-6">
      <div class="flex max-w-[calc(100%-112px)] flex-wrap gap-2 md:max-w-none md:gap-4">
        <div class="w-40 bg-black/50 p-2 rounded backdrop-blur-sm border border-gray-700 md:w-48">
          <div class="text-sm text-gray-300 mb-1 flex justify-between">
            <span>剩余机会</span>
            <span>{{ gameStore.roundCount }}/{{ GAME_RULES.initialRoundCount }}</span>
          </div>
          <ProgressBar :value="gameStore.roundCount" :max="GAME_RULES.initialRoundCount" color="#ef4444" />
        </div>
        
        <div v-if="gameStore.hintCount > 0 && !gameStore.isEnding" class="bg-[#0a0515]/90 px-3 py-2 rounded-xl border border-gray-800 shadow-lg backdrop-blur-md flex items-center md:px-4">
          <button 
            @click="handleHint" 
            :disabled="gameStore.isWaiting || isCinematicOverlayActive"
            class="text-xs text-yellow-500 hover:text-yellow-400 font-bold disabled:opacity-50 flex items-center gap-2 transition-colors sm:text-sm"
          >
            <span class="text-lg">💡</span> 寻找线索 ({{ gameStore.hintCount }})
          </button>
        </div>
      </div>
      
      <div class="flex shrink-0 gap-2 md:gap-3">
        <button
          @click="openSaveSlots"
          :disabled="gameStore.isWaiting || isCinematicOverlayActive"
          class="bg-gray-800/80 hover:bg-gray-700 px-2.5 py-1.5 rounded text-sm border border-gray-600 backdrop-blur-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-800/80 md:px-3"
        >
          保存
        </button>
        <button @click="goHome" class="bg-gray-800/80 hover:bg-gray-700 px-2.5 py-1.5 rounded text-sm border border-gray-600 backdrop-blur-sm transition-colors md:px-3">退出</button>
      </div>
    </div>

    <!-- Save Slots -->
    <div
      v-if="showSaveSlots"
      class="absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm pointer-events-auto"
      @click.self="closeSaveSlots"
    >
      <div class="w-full max-w-sm rounded-lg border border-purple-400/30 bg-[#090711]/95 p-5 shadow-[0_0_32px_rgba(168,85,247,0.22)]">
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-base font-bold text-purple-100">选择保存栏位</h2>
          <button
            type="button"
            class="text-xl leading-none text-gray-500 transition-colors hover:text-white"
            aria-label="关闭"
            @click="closeSaveSlots"
          >
            ×
          </button>
        </div>

        <div class="grid gap-3">
          <button
            v-for="slotId in SAVE_SLOT_IDS"
            :key="slotId"
            type="button"
            class="rounded border border-gray-700 bg-black/45 px-4 py-3 text-left transition-colors hover:border-purple-400/70 hover:bg-purple-950/35"
            @click="saveToSlot(slotId)"
          >
            <span class="block text-sm font-bold text-gray-100">栏位 {{ slotId }}</span>
            <span class="mt-1 block text-xs text-gray-400">{{ getSlotStatus(slotId) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Dialog Box -->
    <div v-if="!isCinematicOverlayActive" class="absolute bottom-0 left-0 right-0 z-30 p-4 md:p-8 pointer-events-auto bg-gradient-to-t from-black via-black/80 to-transparent pt-24">
      <div class="max-w-4xl mx-auto">
        <div class="bg-black/60 border border-gray-700/50 rounded-xl p-6 shadow-2xl backdrop-blur-md min-h-[160px] flex flex-col justify-end transition-all duration-500">
          
          <div v-if="gameStore.isWaiting" class="italic text-gray-500 text-base md:text-lg py-4">
            <TypewriterText :text="gameStore.waitingText" />
          </div>
          
          <div v-else-if="latestHint" class="text-base md:text-lg leading-relaxed text-yellow-100/90 mb-6 bg-yellow-900/20 p-4 rounded-xl border border-yellow-700/30">
            <div class="font-bold text-yellow-500 text-sm mb-2 flex justify-between">
              <span>【内心直觉】</span>
              <button @click="clearHint" class="text-gray-500 hover:text-white">✕</button>
            </div>
            <TypewriterText :text="latestHint" @complete="onTextComplete" :key="latestHint" />
          </div>
          
          <div v-else-if="latestMessage" class="text-lg md:text-xl leading-relaxed text-gray-100">
            <div class="font-pixel text-purple-400 text-lg mb-3">
              {{ latestMessage.role === 'assistant' ? (gameStore.isEnding ? GAME_ROLE.narratorSpeakerName : GAME_ROLE.assistantSpeakerName) : GAME_ROLE.playerSpeakerName }}
            </div>
            <TypewriterText :text="latestMessage.content" @complete="onTextComplete" :key="gameStore.messages.length" />
          </div>

          <!-- Input Area -->
          <div v-if="!gameStore.isWaiting && !gameStore.isEnding && textCompleted" class="mt-6">
            <div class="flex gap-4">
            <input 
              v-model="inputText" 
              @keyup.enter="handleSend"
              type="text" 
              class="flex-1 bg-gray-900/80 border border-gray-600 rounded-lg px-4 py-3 text-gray-100 focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
              placeholder="对她说点什么..."
              autofocus
            />
            <button @click="handleSend" class="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-bold transition-all shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:shadow-[0_0_20px_rgba(168,85,247,0.6)]">
              发送
            </button>
            </div>
          </div>

          <div v-if="canShowEndingSettlement" class="mt-6 space-y-4" data-test="ending-settlement">
            <div
              v-if="endingDefinition"
              class="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              :class="{
                'border-red-300/35 bg-red-950/25 text-red-50': gameStore.endingType === ENDINGS.death.type,
                'border-sky-300/35 bg-sky-950/25 text-sky-50': gameStore.endingType === ENDINGS.disappear.type,
                'border-emerald-300/35 bg-emerald-950/25 text-emerald-50': gameStore.endingType === ENDINGS.acquaintance.type
              }"
            >
              <span class="text-xs opacity-75">结局</span>
              <strong class="text-base">{{ endingDefinition.achievementName }}</strong>
            </div>

            <section class="border-t border-gray-700/60 pt-4 text-sm text-gray-300">
              <div class="mb-3 flex items-center justify-between text-xs uppercase text-purple-300/80">
                <span>本局回声</span>
                <span v-if="isEndingSummaryLoading" class="text-gray-500">整理中...</span>
              </div>

              <div v-if="gameStore.endingSummary" class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <div class="border-l border-purple-400/50 pl-3">
                    <div class="text-xs text-gray-500">使用句数</div>
                    <div class="mt-0.5 font-bold text-gray-100">{{ gameStore.endingSummary.roundsUsed }} 句</div>
                  </div>
                  <div class="border-l border-pink-400/50 pl-3">
                    <div class="text-xs text-gray-500">好感触发</div>
                    <div class="mt-0.5 font-bold text-gray-100">{{ gameStore.endingSummary.affectionBoostCount }} 次</div>
                  </div>
                </div>
                <p class="leading-relaxed text-gray-200">
                  <span class="text-gray-500">关键转折句：</span>“{{ gameStore.endingSummary.turningLine }}”
                </p>
                <p class="leading-relaxed text-purple-100/90">
                  <span class="text-gray-500">局后评语：</span>{{ gameStore.endingSummary.comment }}
                </p>
              </div>

              <div v-else class="text-gray-500">
                正在从这一夜里挑出最重要的一句话……
              </div>
            </section>

            <div class="flex justify-center gap-4">
              <button v-if="gameStore.endingType === ENDINGS.acquaintance.type" @click="goToChatAfter" class="px-8 py-3 bg-[#07c160] hover:bg-[#06ad56] text-white font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(7,193,96,0.4)]">
                添加联系人...
              </button>
              <button v-else @click="goHome" class="px-8 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-600 transition-colors">
                返回标题
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  DEATH_ENDING_SEQUENCE_FRAMES,
  ENDING_BY_TYPE,
  ENDINGS,
  GAME_ENTRY_SESSION_KEY,
  GAME_ENTRY_TYPES,
  GAME_ROLE,
  GAME_RULES,
  GAMEPLAY_PRELOAD_IMAGES,
  OPENING_SEQUENCE_FRAMES,
  ROOFTOP_BGM_SRCS,
  resolveWaitingBackground,
  resolveWaitingMobileBackground,
  resolveVisualState
} from '@/domain/gameContract'
import { useGameStore } from '@/store/gameStore'
import { audioManager } from '@/modules/AudioManager'
import { SaveSystem, type SaveSlot } from '@/modules/SaveSystem'
import { AchievementTracker } from '@/modules/AchievementTracker'
import EndingSequenceOverlay from '@/components/EndingSequenceOverlay.vue'
import OpeningSequenceOverlay from '@/components/OpeningSequenceOverlay.vue'
import TypewriterText from '@/components/TypewriterText.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const router = useRouter()
const gameStore = useGameStore()
const SAVE_SLOT_IDS = GAME_RULES.saveSlotIds

const inputText = ref('')
const textCompleted = ref(false)
const latestHint = ref<string | null>(null)
const showSaveSlots = ref(false)
const saveSlots = ref<SaveSlot[]>([])
const isEndingSummaryLoading = ref(false)
const isOpeningSequenceActive = ref(false)
const isDeathEndingSequenceActive = ref(false)
const hasPlayedDeathEndingSequence = ref(false)
const hasStartedBgm = ref(false)
const preloadedImages = new Set<string>()

const latestMessage = computed(() => {
  if (gameStore.messages.length === 0) return null
  return gameStore.messages[gameStore.messages.length - 1]
})

const saveSlotMap = computed(() => new Map(saveSlots.value.map((slot) => [slot.id, slot])))
const hasPlayerMessages = computed(() => gameStore.messages.some((message) => message.role === 'user'))
const endingDefinition = computed(() =>
  gameStore.endingType ? ENDING_BY_TYPE[gameStore.endingType] : null
)
const isCinematicOverlayActive = computed(() => isOpeningSequenceActive.value || isDeathEndingSequenceActive.value)
const canShowEndingSettlement = computed(() =>
  gameStore.isEnding && textCompleted.value && !isDeathEndingSequenceActive.value
)

const currentVisualState = computed(() => resolveVisualState({
  roundCount: gameStore.roundCount,
  affection: gameStore.affection,
  isEnding: gameStore.isEnding,
  endingType: gameStore.endingType,
  aiStateType: gameStore.lastAiStateTag,
  emotionType: gameStore.lastEmotionTag
}))

const currentBg = computed(() =>
  gameStore.isWaiting
    ? {
        desktop: resolveWaitingBackground(currentVisualState.value),
        mobile: resolveWaitingMobileBackground(currentVisualState.value)
      }
    : {
        desktop: currentVisualState.value.backgroundImage,
        mobile: currentVisualState.value.mobileBackgroundImage
      }
)

const preloadImages = (sources: readonly string[]) => {
  sources.forEach((src) => {
    if (!src || preloadedImages.has(src)) return

    preloadedImages.add(src)
    const image = new Image()
    image.decoding = 'async'
    image.src = src
  })
}

const startRooftopBgm = () => {
  if (hasStartedBgm.value) return
  hasStartedBgm.value = true
  audioManager.playBgm(ROOFTOP_BGM_SRCS)
}

const completeOpeningSequence = () => {
  isOpeningSequenceActive.value = false
  startRooftopBgm()
}

const shouldStartDeathEndingSequence = () =>
  gameStore.endingType === ENDINGS.death.type &&
  !hasPlayedDeathEndingSequence.value &&
  !isDeathEndingSequenceActive.value

const completeDeathEndingSequence = () => {
  isDeathEndingSequenceActive.value = false
}

const onTextComplete = () => {
  textCompleted.value = true
  if (gameStore.isEnding && gameStore.endingType) {
    AchievementTracker.unlock(gameStore.endingType)
    AchievementTracker.evaluateFromState(gameStore.$state)
    void ensureEndingSummary()
    if (shouldStartDeathEndingSequence()) {
      hasPlayedDeathEndingSequence.value = true
      isDeathEndingSequenceActive.value = true
    }
  }
}

const ensureEndingSummary = async () => {
  if (!gameStore.isEnding || gameStore.endingSummary || isEndingSummaryLoading.value) return

  isEndingSummaryLoading.value = true
  try {
    await gameStore.generateEndingSummary()
  } finally {
    isEndingSummaryLoading.value = false
  }
}

const handleSend = async () => {
  const text = inputText.value.trim()
  if (!text || gameStore.isWaiting || gameStore.isEnding || isCinematicOverlayActive.value) return
  
  audioManager.playSfx('click')
  inputText.value = ''
  textCompleted.value = false
  latestHint.value = null
  
  await gameStore.sendMessage(text)
  if (!gameStore.isEnding) {
    AchievementTracker.evaluateFromState(gameStore.$state)
  }
}

const handleHint = async () => {
  if (gameStore.hintCount <= 0 || gameStore.isWaiting || isCinematicOverlayActive.value) return
  audioManager.playSfx('click')
  textCompleted.value = false
  const hint = await gameStore.requestHint()
  if (hint) {
    latestHint.value = hint
  }
}

const clearHint = () => {
  audioManager.playSfx('click')
  latestHint.value = null
  textCompleted.value = true // Ensure input shows up immediately after closing hint
}

const formatSaveTime = (timestamp: number) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp))

const getSlotStatus = (slotId: number) => {
  const slot = saveSlotMap.value.get(slotId)
  return slot ? `已有存档：${formatSaveTime(slot.timestamp)}` : '空栏位'
}

const refreshSaveSlots = () => {
  saveSlots.value = SaveSystem.getSlots()
}

const openSaveSlots = () => {
  audioManager.playSfx('click')
  if (gameStore.isWaiting || isCinematicOverlayActive.value) {
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
  const existingSlot = saveSlotMap.value.get(slotId)
  if (existingSlot && !confirm(`栏位 ${slotId} 已有存档，是否覆盖？`)) return

  if (SaveSystem.save(slotId)) {
    refreshSaveSlots()
    AchievementTracker.evaluateSaveSlots(saveSlots.value)
    showSaveSlots.value = false
    alert(`游戏已保存至栏位 ${slotId}`)
  } else {
    alert(gameStore.isWaiting ? '正在等待回应，暂时不能保存。' : '保存失败')
  }
}

const goHome = () => {
  audioManager.playSfx('click')
  router.push('/')
}

const goToChatAfter = () => {
  audioManager.playSfx('click')
  router.push('/chat-after')
}

onMounted(() => {
  AchievementTracker.unlock('first_try')
  preloadImages(GAMEPLAY_PRELOAD_IMAGES)
  startRooftopBgm()

  if (gameStore.isEnding && gameStore.endingType === ENDINGS.death.type) {
    hasPlayedDeathEndingSequence.value = true
  }

  const entryType = sessionStorage.getItem(GAME_ENTRY_SESSION_KEY)
  sessionStorage.removeItem(GAME_ENTRY_SESSION_KEY)
  const shouldPlayOpening = entryType === GAME_ENTRY_TYPES.newGame && !hasPlayerMessages.value && !gameStore.isEnding

  if (shouldPlayOpening) {
    isOpeningSequenceActive.value = true
    return
  }

})
</script>
