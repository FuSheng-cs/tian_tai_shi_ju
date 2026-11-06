<template>
  <main class="start-view" aria-labelledby="start-title">
    <picture class="menu-scene" aria-hidden="true">
      <source media="(max-width: 760px)" :srcset="`${SCENE_ROOT}/home-960.webp`" />
      <img
        :src="`${SCENE_ROOT}/home-1672.webp`"
        width="1672"
        height="941"
        alt=""
        decoding="async"
        fetchpriority="high"
        draggable="false"
      />
    </picture>
    <div class="menu-shade" aria-hidden="true"></div>

    <BgmControl />

    <section class="menu-shell" aria-label="游戏首页">
      <header class="brand-panel">
        <h1 id="start-title" class="game-title">{{ GAME_ROLE.gameTitle }}</h1>
      </header>

      <nav
        class="action-menu"
        aria-label="主菜单"
        @pointerover="selectMenuFromEvent"
        @pointermove="selectMenuFromEvent"
        @focusin="selectMenuFromEvent"
        @keydown="onMenuKeydown"
      >
        <button
          type="button"
          class="menu-button menu-button-primary"
          :class="{ 'is-selected': selectedMenuItem === 'start' }"
          data-menu-item="start"
          @pointerenter="warmEntryCGs"
          @focus="warmEntryCGs"
          @click="startGame"
        >
          <span>开始游戏</span>
        </button>
        <button
          type="button"
          class="menu-button"
          :class="{ 'is-selected': selectedMenuItem === 'continue' }"
          data-menu-item="continue"
          aria-label="继续游戏"
          :disabled="!latestSave"
          :aria-describedby="!latestSave ? 'continue-status' : undefined"
          @click="continueGame"
        >
          <span>继续游戏</span>
          <span v-if="!latestSave" class="empty-save-note" aria-hidden="true">暂无存档</span>
        </button>
        <span v-if="!latestSave" id="continue-status" class="sr-only">
          暂无可读取的存档，开始游戏后可保存进度。
        </span>
        <button
          type="button"
          class="menu-button"
          :class="{ 'is-selected': selectedMenuItem === 'load' }"
          data-menu-item="load"
          @click="openSaveSlots"
        >
          <span>读取存档</span>
        </button>
        <button
          type="button"
          class="menu-button"
          :class="{ 'is-selected': selectedMenuItem === 'settings' }"
          data-menu-item="settings"
          @click="goToSettings"
        >
          <span>设置</span>
        </button>
      </nav>
    </section>

    <footer class="menu-footer">
      <button type="button" class="footer-link" @click="openDialog('about')">关于作品</button>
      <p class="footer-message">别急，我在听。</p>
      <button type="button" class="footer-link footer-link-end" @click="goToAchievements">
        成就图鉴
      </button>
    </footer>

    <dialog
      ref="menuDialog"
      class="menu-dialog"
      aria-labelledby="menu-dialog-title"
      @cancel.prevent="closeDialog"
      @click.self="closeDialog"
    >
      <section class="dialog-panel">
        <header class="dialog-header">
          <h2 id="menu-dialog-title">{{ activeDialog === 'saves' ? '读取存档' : '关于作品' }}</h2>
          <button
            type="button"
            class="dialog-close"
            :aria-label="activeDialog === 'saves' ? '关闭读取存档' : '关闭关于作品'"
            autofocus
            @click="closeDialog"
          >
            <PixelIcon name="close" class="h-5 w-5" />
          </button>
        </header>

        <template v-if="activeDialog === 'saves'">
          <p class="dialog-intro">从上次停下的地方，继续听她说。</p>
          <p v-if="saveError" class="save-error" role="status">{{ saveError }}</p>
          <div class="save-slot-list">
            <button
              v-for="slotId in SAVE_SLOT_IDS"
              :key="slotId"
              type="button"
              class="save-slot-button"
              :disabled="!isUsableSlot(slotId)"
              @click="loadFromSlot(slotId)"
            >
              <span class="save-slot-title">{{ getSlotTitle(slotId) }}</span>
              <span class="save-slot-status">{{ slotStatus(slotId) }}</span>
            </button>
          </div>
          <p v-if="!latestSave" class="dialog-footnote">开始一段新的对话后，可在游戏中保存进度。</p>
        </template>

        <div v-else-if="activeDialog === 'about'" class="about-copy">
          <p class="about-lead">一款关于倾听与陪伴的 AI 原生叙事独立游戏。</p>
          <p>
            深夜，你在雨中的天台遇见独立摄影师{{ GAME_ROLE.characterName }}。她带着一台旧相机，坐在栏杆边。
            你说的每句话都会影响她接下来的回应，也可能改变这个夜晚的结局。
          </p>
          <p>
            你起初有 {{ GAME_RULES.initialRoundCount }} 次开口的机会。触动她的话可能换来继续交谈的机会。
            如果这个夜晚以相识收场，你们还可以在后日谈里继续聊天。
          </p>
          <blockquote>你有十句话。先听她说完。</blockquote>
          <p class="about-safety">
            故事与角色均为虚构。现实中的支持没有十句期限，也没有万能台词。
            遇到危险时，请联系可信任的人或当地紧急服务。
          </p>
        </div>
      </section>
    </dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '@/components/PixelIcon.vue'
import {
  CHAT_AFTER_SLOT_QUERY_KEY,
  GAME_ENTRY_QUERY_KEY,
  GAME_ENTRY_TYPES,
  GAME_ROLE,
  GAME_RULES
} from '@/domain/gameContract'
import { useGameStore } from '@/store/gameStore'
import BgmControl from '@/components/BgmControl.vue'
import { SAVE_SLOT_KINDS, SaveSystem } from '@/modules/SaveSystem'
import { useSaveSlots } from '@/composables/useSaveSlots'
import { scheduleEntryCGWarmup, warmEntryCGs } from '@/modules/CgWarmup'

const SCENE_ROOT = '/assets/images/pixel_city_20261104'
const SAVE_SLOT_IDS = GAME_RULES.saveSlotIds
const router = useRouter()
const gameStore = useGameStore()
const selectedMenuItem = ref('start')
const menuDialog = ref<HTMLDialogElement | null>(null)
const activeDialog = ref<'saves' | 'about' | null>(null)
const saveError = ref('')
let dialogTrigger: HTMLElement | null = null
let cancelWarmup: (() => void) | undefined

const { saveSlots, refreshSaveSlots, getSlot, getSlotTitle, getSlotStatus } = useSaveSlots()
const usableSlots = computed(() => saveSlots.value.filter((slot) => SaveSystem.isSlotValid(slot.id)))
const latestSave = computed(() =>
  [...usableSlots.value].sort((a, b) => b.timestamp - a.timestamp || a.id - b.id)[0] ?? null
)

watch(latestSave, (slot) => {
  if (!slot && selectedMenuItem.value === 'continue') selectedMenuItem.value = 'start'
})

const selectMenuFromEvent = (event: Event) => {
  if (!(event.target instanceof Element)) return
  const button = event.target.closest<HTMLButtonElement>('.menu-button')
  if (button && !button.disabled && button.dataset.menuItem) {
    selectedMenuItem.value = button.dataset.menuItem
  }
}

const onMenuKeydown = (event: KeyboardEvent) => {
  selectMenuFromEvent(event)
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  if (!(event.currentTarget instanceof HTMLElement)) return

  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(
    '.menu-button:not(:disabled)'
  )]
  const currentIndex = buttons.findIndex((button) => button === document.activeElement)
  if (currentIndex === -1) return

  event.preventDefault()
  const offset = event.key === 'ArrowUp' ? -1 : 1
  const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (currentIndex + offset + buttons.length) % buttons.length
  buttons[nextIndex]?.focus()
}

const isUsableSlot = (slotId: number) => usableSlots.value.some((slot) => slot.id === slotId)
const slotStatus = (slotId: number) => {
  if (isUsableSlot(slotId)) return getSlotStatus(slotId)
  return getSlot(slotId) ? '存档无法读取' : '空栏位'
}

const startGame = () => {
  warmEntryCGs()
  gameStore.resetGame()
  router.push({ path: '/game', query: { [GAME_ENTRY_QUERY_KEY]: GAME_ENTRY_TYPES.newGame } })
}

const openDialog = async (kind: 'saves' | 'about') => {
  if (kind === 'saves') refreshSaveSlots()
  dialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  activeDialog.value = kind
  await nextTick()
  if (!menuDialog.value?.open) menuDialog.value?.showModal()
}

const closeDialog = () => {
  menuDialog.value?.close()
  activeDialog.value = null
  dialogTrigger?.focus()
}

const openSaveSlots = () => {
  saveError.value = ''
  void openDialog('saves')
}

const reportLoadError = () => {
  refreshSaveSlots()
  saveError.value = '这份存档暂时无法读取，请选择其他栏位或开始新的游戏。'
  if (activeDialog.value !== 'saves') void openDialog('saves')
}

const loadFromSlot = (slotId: number) => {
  refreshSaveSlots()
  const slot = getSlot(slotId)
  if (!slot || !isUsableSlot(slotId)) {
    reportLoadError()
    return
  }

  if (slot.kind === SAVE_SLOT_KINDS.chatAfter) {
    if (SaveSystem.loadChatAfter(slotId)) {
      closeDialog()
      router.push({ path: '/chat-after', query: { [CHAT_AFTER_SLOT_QUERY_KEY]: slotId } })
      return
    }
  } else if (SaveSystem.load(slotId)) {
    closeDialog()
    router.push({ path: '/game', query: { [GAME_ENTRY_QUERY_KEY]: GAME_ENTRY_TYPES.load } })
    return
  }
  reportLoadError()
}

const continueGame = () => {
  refreshSaveSlots()
  if (latestSave.value) loadFromSlot(latestSave.value.id)
  else reportLoadError()
}

const goToSettings = () => {
  router.push('/settings')
}

const goToAchievements = () => {
  router.push('/achievements')
}

onMounted(() => {
  cancelWarmup = scheduleEntryCGWarmup()
  refreshSaveSlots()
  window.addEventListener('focus', refreshSaveSlots)
  window.addEventListener('storage', refreshSaveSlots)
})

onBeforeUnmount(() => {
  cancelWarmup?.()
  window.removeEventListener('focus', refreshSaveSlots)
  window.removeEventListener('storage', refreshSaveSlots)
})
</script>

<style scoped src="./start-pixel.css"></style>
