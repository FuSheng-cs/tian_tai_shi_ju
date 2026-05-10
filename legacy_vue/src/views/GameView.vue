<template>
  <div class="game-view min-h-screen w-full relative flex flex-col bg-black text-gray-100 overflow-hidden">
    <!-- Background (now using the character images directly as they contain the full scene) -->
    <div class="absolute inset-0 z-0">
      <picture class="block h-full w-full">
        <source :srcset="currentBg.mobile" media="(max-width: 768px)" />
        <img
          :src="currentBg.desktop"
          class="w-full h-full object-cover transition-opacity duration-1000"
          :class="backgroundImageClass"
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
        <div class="rounded-md border border-white/10 bg-black/35 px-2 py-1.5 shadow-[0_0_18px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
          <ChanceCigarettes :value="gameStore.roundCount" :max="GAME_RULES.initialRoundCount" />
        </div>
        
        <div v-if="gameStore.hintCount > 0 && !gameStore.isEnding" class="rounded-md border border-white/10 bg-black/35 px-2 py-1.5 shadow-[0_0_18px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
          <button 
            @click="handleHint" 
            :disabled="gameStore.isWaiting || isCinematicOverlayActive"
            class="hint-hud-button"
            :aria-label="`寻找线索，剩余 ${gameStore.hintCount} / ${GAME_RULES.initialHintCount}`"
          >
            <span class="hint-hud-button__icon" aria-hidden="true">
              <img :src="HINT_BULB_IMAGE" alt="" draggable="false" />
            </span>
            <span class="hint-hud-button__content">
              <span class="hint-hud-button__label">寻找线索</span>
              <span class="hint-hud-button__count">{{ gameStore.hintCount }}/{{ GAME_RULES.initialHintCount }}</span>
            </span>
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
          
          <div v-else-if="latestHint" class="hint-card">
            <span class="hint-card__perforation" aria-hidden="true"></span>
            <div class="hint-card__header">
              <span class="hint-card__title">
                <img :src="HINT_BULB_IMAGE" alt="" draggable="false" />
                <span>内心直觉</span>
              </span>
              <button type="button" @click="clearHint" class="hint-card__close" aria-label="关闭线索">✕</button>
            </div>
            <div class="hint-card__copy">
              <TypewriterText :text="latestHint" @complete="onTextComplete" :key="latestHint" />
            </div>
          </div>
          
          <div v-else-if="latestMessage" class="text-lg md:text-xl leading-relaxed text-gray-100">
            <div class="font-pixel text-purple-400 text-lg mb-3">
              {{ latestMessage.role === 'assistant' ? (gameStore.isEnding ? GAME_ROLE.narratorSpeakerName : GAME_ROLE.assistantSpeakerName) : GAME_ROLE.playerSpeakerName }}
            </div>
            <TypewriterText :text="latestMessage.content" @complete="onTextComplete" :key="gameStore.messages.length" />
          </div>

          <!-- Input Area -->
          <div v-if="!gameStore.isWaiting && !gameStore.isEnding && textCompleted" class="mt-6">
            <div class="dialog-input-row">
            <input 
              v-model="inputText" 
              @keyup.enter="handleSend"
              type="text" 
              class="dialog-input"
              placeholder="对她说点什么..."
              autofocus
            />
            <button type="button" @click="handleSend" class="dialog-send-button" aria-label="发送">
              <svg class="dialog-send-icon" viewBox="0 0 16 16" aria-hidden="true" shape-rendering="crispEdges">
                <path
                  class="dialog-send-icon__body"
                  d="M2 7h2V6h2V5h2V4h2V3h4v1h-1v2h-1v2h-1v3h-1v2H9v-1H8v-2H7V9H5V8H2V7z"
                />
                <path
                  class="dialog-send-icon__cut"
                  d="M6 8h2v1h1v1h1v1H9v-1H8V9H6V8z"
                />
                <path class="dialog-send-icon__spark" d="M12 4h1v1h-1V4z" />
              </svg>
              <span class="sr-only">发送</span>
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
  CHAT_AFTER_SAVE_SLOT_SESSION_KEY,
  GAME_ENTRY_SESSION_KEY,
  GAME_ENTRY_TYPES,
  GAME_ROLE,
  GAME_RULES,
  GAMEPLAY_PRELOAD_IMAGES,
  OPENING_SEQUENCE_FRAMES,
  ROOFTOP_BGM_SRCS,
  resolveWaitingBackground,
  resolveWaitingMobileBackground,
  resolveVisualState,
  type ResolvedVisualState
} from '@/domain/gameContract'
import { useGameStore } from '@/store/gameStore'
import { audioManager } from '@/modules/AudioManager'
import { SaveSystem, type SaveSlot } from '@/modules/SaveSystem'
import { AchievementTracker } from '@/modules/AchievementTracker'
import ChanceCigarettes from '@/components/ChanceCigarettes.vue'
import EndingSequenceOverlay from '@/components/EndingSequenceOverlay.vue'
import OpeningSequenceOverlay from '@/components/OpeningSequenceOverlay.vue'
import TypewriterText from '@/components/TypewriterText.vue'

const router = useRouter()
const gameStore = useGameStore()
const SAVE_SLOT_IDS = GAME_RULES.saveSlotIds
const HINT_BULB_IMAGE = '/assets/images/ui_hint_bulb.svg'

const inputText = ref('')
const textCompleted = ref(false)
const latestHint = ref<string | null>(null)
const showSaveSlots = ref(false)
const saveSlots = ref<SaveSlot[]>([])
const isEndingSummaryLoading = ref(false)
const isOpeningSequenceActive = ref(false)
const isDeathEndingSequenceActive = ref(false)
const hasPlayedDeathEndingSequence = ref(gameStore.isEnding && gameStore.endingType === ENDINGS.death.type)
const hasStartedBgm = ref(false)
const waitingVisualState = ref<ResolvedVisualState | null>(null)
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
const isDeathEndingSequencePending = computed(() =>
  gameStore.isEnding &&
  gameStore.endingType === ENDINGS.death.type &&
  !hasPlayedDeathEndingSequence.value
)
const canShowEndingSettlement = computed(() =>
  gameStore.isEnding && textCompleted.value && !isDeathEndingSequenceActive.value
)

const currentVisualState = computed(() => resolveVisualState({
  roundCount: isDeathEndingSequencePending.value ? Math.min(gameStore.roundCount, 1) : gameStore.roundCount,
  affection: gameStore.affection,
  isEnding: gameStore.isEnding && !isDeathEndingSequencePending.value,
  endingType: isDeathEndingSequencePending.value ? null : gameStore.endingType,
  aiStateType: gameStore.lastAiStateTag,
  emotionType: gameStore.lastEmotionTag
}))

const currentBg = computed(() =>
  gameStore.isWaiting
    ? {
        desktop: resolveWaitingBackground(waitingVisualState.value ?? currentVisualState.value),
        mobile: resolveWaitingMobileBackground(waitingVisualState.value ?? currentVisualState.value)
      }
    : {
        desktop: currentVisualState.value.backgroundImage,
        mobile: currentVisualState.value.mobileBackgroundImage
      }
)

const backgroundImageClass = computed(() =>
  isDeathEndingSequencePending.value
    ? 'death-cinematic-background'
    : gameStore.isEnding
      ? 'opacity-100'
      : 'opacity-80'
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
  if (gameStore.isEnding && gameStore.endingType === ENDINGS.death.type) return
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
      audioManager.stopBgm()
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
  
  waitingVisualState.value = currentVisualState.value
  try {
    await gameStore.sendMessage(text)
  } finally {
    waitingVisualState.value = null
  }
  if (!gameStore.isEnding) {
    AchievementTracker.evaluateFromState(gameStore.$state)
  }
}

const handleHint = async () => {
  if (gameStore.hintCount <= 0 || gameStore.isWaiting || isCinematicOverlayActive.value) return
  audioManager.playSfx('click')
  textCompleted.value = false
  waitingVisualState.value = currentVisualState.value
  try {
    const hint = await gameStore.requestHint()
    if (hint) {
      latestHint.value = hint
    }
  } finally {
    waitingVisualState.value = null
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
  sessionStorage.removeItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY)
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

<style scoped>
.death-cinematic-background {
  opacity: 0.78;
  filter: brightness(0.82) contrast(1.05);
  transition:
    opacity 1000ms ease,
    filter 1000ms ease;
}

.hint-card {
  position: relative;
  margin-bottom: 24px;
  overflow: hidden;
  border: 1px solid rgba(229, 231, 235, 0.16);
  border-radius: 7px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 12px),
    radial-gradient(circle at 16% 0, rgba(255, 238, 179, 0.14), transparent 34%),
    linear-gradient(135deg, rgba(7, 7, 9, 0.86), rgba(16, 12, 9, 0.82));
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.035),
    inset 0 18px 38px rgba(255, 255, 255, 0.025),
    0 0 24px rgba(0, 0, 0, 0.42);
  color: rgba(238, 238, 238, 0.92);
  padding: 14px 16px 16px 34px;
}

.hint-card::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 100% 9px, 11px 100%;
  content: "";
  opacity: 0.32;
  mix-blend-mode: screen;
}

.hint-card__perforation {
  position: absolute;
  top: 9px;
  bottom: 9px;
  left: 10px;
  width: 10px;
  border-right: 1px solid rgba(229, 231, 235, 0.08);
  background:
    radial-gradient(circle, rgba(229, 231, 235, 0.34) 0 2px, transparent 2.4px)
    center top / 8px 13px repeat-y;
  opacity: 0.58;
}

.hint-card__header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

.hint-card__title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(250, 238, 188, 0.86);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-shadow: 0 0 7px rgba(255, 210, 112, 0.18), 0 1px 2px rgba(0, 0, 0, 0.86);
}

.hint-card__title img {
  width: 16px;
  height: 16px;
  filter: drop-shadow(0 0 5px rgba(255, 235, 176, 0.34));
  image-rendering: pixelated;
  pointer-events: none;
  user-select: none;
}

.hint-card__close {
  border: 0;
  padding: 1px 2px;
  background: transparent;
  color: rgba(229, 231, 235, 0.42);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  transition: color 160ms ease, filter 160ms ease;
}

.hint-card__close:hover {
  color: rgba(255, 255, 255, 0.86);
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.18));
}

.hint-card__copy {
  position: relative;
  z-index: 1;
  color: rgba(242, 242, 242, 0.92);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.78);
}

.dialog-input-row {
  display: flex;
  gap: 12px;
}

.dialog-input {
  min-width: 0;
  flex: 1 1 auto;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 7px;
  background:
    linear-gradient(180deg, rgba(8, 13, 24, 0.9), rgba(6, 9, 17, 0.88));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.035),
    inset 0 0 18px rgba(0, 0, 0, 0.32);
  color: rgba(243, 244, 246, 0.94);
  font: inherit;
  padding: 11px 13px;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    background 180ms ease;
}

.dialog-input::placeholder {
  color: rgba(156, 163, 175, 0.72);
}

.dialog-input:focus {
  outline: none;
  border-color: rgba(168, 85, 247, 0.46);
  background:
    linear-gradient(180deg, rgba(10, 14, 25, 0.94), rgba(6, 8, 16, 0.92));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    inset 0 0 18px rgba(0, 0, 0, 0.34),
    0 0 0 1px rgba(168, 85, 247, 0.08),
    0 0 18px rgba(168, 85, 247, 0.18);
}

.dialog-send-button {
  flex: 0 0 auto;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(213, 196, 255, 0.38);
  border-radius: 3px;
  background:
    linear-gradient(180deg, rgba(55, 36, 82, 0.98) 0%, rgba(31, 23, 47, 0.98) 49%, rgba(13, 11, 20, 0.98) 50%, rgba(44, 24, 69, 0.98) 100%);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.86),
    0 3px 0 rgba(7, 6, 12, 0.95),
    0 4px 0 rgba(116, 80, 154, 0.2),
    0 0 10px rgba(124, 58, 237, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.11),
    inset 2px 0 0 rgba(255, 255, 255, 0.035),
    inset -2px 0 0 rgba(0, 0, 0, 0.38),
    inset 0 -2px 0 rgba(0, 0, 0, 0.72);
  color: rgba(246, 242, 255, 0.95);
  font: inherit;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  min-height: 46px;
  width: 58px;
  min-width: 58px;
  text-shadow:
    0 1px 0 rgba(0, 0, 0, 0.9),
    0 0 6px rgba(232, 213, 255, 0.24);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    filter 160ms ease,
    transform 160ms ease;
}

.dialog-send-button::before {
  content: '';
  position: absolute;
  inset: 2px;
  z-index: 0;
  background:
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.055) 0 1px, transparent 1px 5px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.07), transparent 42%, rgba(0, 0, 0, 0.2) 43% 100%);
  opacity: 0.72;
  pointer-events: none;
}

.dialog-send-button::after {
  content: '';
  position: absolute;
  right: 5px;
  bottom: 4px;
  left: 5px;
  height: 2px;
  background: repeating-linear-gradient(90deg, rgba(221, 205, 255, 0.34) 0 4px, transparent 4px 7px);
  opacity: 0.45;
  pointer-events: none;
}

.dialog-send-icon {
  position: relative;
  z-index: 1;
  width: 24px;
  height: 24px;
  filter:
    drop-shadow(0 1px 0 rgba(0, 0, 0, 0.95))
    drop-shadow(0 0 5px rgba(221, 205, 255, 0.28));
  image-rendering: pixelated;
}

.dialog-send-icon__body,
.dialog-send-icon__spark {
  fill: rgba(238, 235, 246, 0.94);
}

.dialog-send-icon__cut {
  fill: rgba(26, 18, 38, 0.94);
}

.dialog-send-button:hover {
  border-color: rgba(231, 220, 255, 0.55);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.9),
    0 3px 0 rgba(7, 6, 12, 0.95),
    0 4px 0 rgba(151, 115, 194, 0.24),
    0 0 14px rgba(168, 85, 247, 0.24),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 2px 0 0 rgba(255, 255, 255, 0.045),
    inset -2px 0 0 rgba(0, 0, 0, 0.34),
    inset 0 -2px 0 rgba(0, 0, 0, 0.66);
  filter: brightness(1.04);
}

.dialog-send-button:active {
  transform: translateY(2px);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.9),
    0 1px 0 rgba(7, 6, 12, 0.95),
    0 0 8px rgba(124, 58, 237, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 2px 0 rgba(0, 0, 0, 0.55);
}

.hint-hud-button {
  border: 0;
  padding: 0;
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: rgba(229, 231, 235, 0.82);
  font: inherit;
  line-height: 1;
  transition:
    color 180ms ease,
    opacity 180ms ease,
    filter 180ms ease;
}

.hint-hud-button:hover:not(:disabled) {
  color: rgba(250, 246, 218, 0.96);
  filter: drop-shadow(0 0 5px rgba(255, 240, 190, 0.18));
}

.hint-hud-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.hint-hud-button__icon {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  filter:
    drop-shadow(0 0 3px rgba(255, 244, 202, 0.46))
    drop-shadow(0 0 8px rgba(255, 218, 143, 0.16));
}

.hint-hud-button__icon img {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
  pointer-events: none;
  user-select: none;
}

.hint-hud-button__content {
  display: grid;
  gap: 4px;
  text-align: left;
}

.hint-hud-button__label {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.86);
}

.hint-hud-button__count {
  color: rgba(229, 231, 235, 0.72);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.86);
}

@media (max-width: 640px) {
  .hint-card {
    margin-bottom: 20px;
    padding: 12px 13px 13px 30px;
  }

  .hint-card__copy {
    font-size: 14px;
    line-height: 1.65;
  }

  .dialog-input-row {
    gap: 10px;
  }

  .dialog-input {
    padding: 10px 12px;
  }

  .dialog-send-button {
    min-height: 43px;
    width: 52px;
    min-width: 52px;
    padding: 0;
  }

  .dialog-send-icon {
    width: 22px;
    height: 22px;
  }

  .hint-hud-button {
    min-height: 42px;
    gap: 6px;
  }

  .hint-hud-button__icon {
    width: 20px;
    height: 20px;
    flex-basis: 20px;
  }

  .hint-hud-button__label,
  .hint-hud-button__count {
    font-size: 10px;
  }
}
</style>
