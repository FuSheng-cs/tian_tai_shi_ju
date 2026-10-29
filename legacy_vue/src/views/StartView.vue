<template>
  <main class="start-view" aria-labelledby="start-title">
    <picture class="menu-scene" aria-hidden="true">
      <source media="(max-width: 760px)" :srcset="`${SCENE_ROOT}/rooftop-960.webp`" />
      <img
        :src="`${SCENE_ROOT}/rooftop-1672.webp`"
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
        <h1 id="start-title" class="game-title">
          <span class="sr-only">{{ GAME_ROLE.gameTitle }}</span>
          <span class="title-window" aria-hidden="true">
            <span v-if="!titleReady" class="title-fallback">天台十句</span>
            <img
              class="title-art"
              :class="{ 'is-ready': titleReady }"
              :src="titleImage"
              width="2172"
              height="724"
              alt=""
              decoding="async"
              fetchpriority="high"
              draggable="false"
              @load="titleReady = true"
              @error="onTitleError"
            />
          </span>
        </h1>
        <p class="tagline">你有十句话。先听她说完。</p>
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
            <X :size="20" :stroke-width="1.5" aria-hidden="true" />
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
          <p class="about-lead">一部关于倾听、理解与共情的互动叙事作品。</p>
          <p>
            雨刚停，你来到了学校天台。大学生{{ GAME_ROLE.characterName }}坐在离你几步远的地方。
            从一句回应开始，试着听见她还没说出口的话。
          </p>
          <p>
            你有 {{ GAME_RULES.initialRoundCount }} 次开口的机会。每次有效发送消耗一次机会，
            认真倾听、尊重选择，一起寻找下一个安全的地方。
          </p>
          <blockquote>{{ GAME_ROLE.tagline }}</blockquote>
          <p class="about-safety">
            故事与角色均为虚构。现实中的支持没有十句期限，也没有万能台词。
            遇到危险时，请联系可信任的人、学校心理中心或当地紧急服务。
          </p>
        </div>
      </section>
    </dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { X } from 'lucide-vue-next'
import {
  CHAT_AFTER_SLOT_QUERY_KEY,
  GAME_ENTRY_QUERY_KEY,
  GAME_ENTRY_TYPES,
  GAME_ROLE,
  GAME_RULES
} from '@/domain/gameContract'
import { useGameStore } from '@/store/gameStore'
import { audioManager } from '@/modules/AudioManager'
import BgmControl from '@/components/BgmControl.vue'
import { SAVE_SLOT_KINDS, SaveSystem } from '@/modules/SaveSystem'
import { useSaveSlots } from '@/composables/useSaveSlots'

const SCENE_ROOT = '/assets/images/homepage_20261029'
const SAVE_SLOT_IDS = GAME_RULES.saveSlotIds
const router = useRouter()
const gameStore = useGameStore()
const titleImage = ref(`${SCENE_ROOT}/title-expanded-v1.webp`)
const titleReady = ref(false)
const selectedMenuItem = ref('start')
const menuDialog = ref<HTMLDialogElement | null>(null)
const activeDialog = ref<'saves' | 'about' | null>(null)
const saveError = ref('')
let dialogTrigger: HTMLElement | null = null

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

const onTitleError = () => {
  if (titleImage.value.endsWith('.webp')) titleImage.value = `${SCENE_ROOT}/title-expanded-v1.png`
}

const startGame = () => {
  audioManager.playSfx('click')
  gameStore.resetGame()
  router.push({ path: '/game', query: { [GAME_ENTRY_QUERY_KEY]: GAME_ENTRY_TYPES.newGame } })
}

const openDialog = async (kind: 'saves' | 'about') => {
  audioManager.playSfx('click')
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

  audioManager.playSfx('click')
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
  audioManager.playSfx('click')
  router.push('/settings')
}

const goToAchievements = () => {
  audioManager.playSfx('click')
  router.push('/achievements')
}

onMounted(() => {
  refreshSaveSlots()
  window.addEventListener('focus', refreshSaveSlots)
  window.addEventListener('storage', refreshSaveSlots)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', refreshSaveSlots)
  window.removeEventListener('storage', refreshSaveSlots)
})
</script>

<style scoped>
.start-view {
  --menu-night: #090b0e;
  --menu-paper: #e2e1de;
  --menu-muted: #a3a9b2;
  --menu-violet: #b3a6c7;
  --menu-gutter: clamp(40px, 8.4vw, 180px);

  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100svh;
  overflow: hidden auto;
  color: var(--menu-paper);
  background: var(--menu-night);
  scrollbar-width: thin;
  scrollbar-color: #49434f var(--menu-night);
}

/* Text and controls are available immediately, including during the route entrance. */
.start-view.fade-enter-active { transition: none; }
.start-view.fade-enter-from { opacity: 1; }

.menu-scene,
.menu-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.menu-scene { z-index: -2; }
.menu-scene img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 72% center;
  user-select: none;
}

.menu-shade {
  z-index: -1;
  background:
    linear-gradient(90deg, rgb(5 7 10 / 38%), rgb(5 7 10 / 12%) 38%, transparent 62%),
    linear-gradient(0deg, rgb(5 7 10 / 52%), transparent 24%);
}

.menu-shell {
  position: relative;
  flex: 1 0 auto;
  width: min(100%, 1920px);
  margin-inline: auto;
  padding: clamp(76px, 17svh, 220px) var(--menu-gutter) 40px;
}

.brand-panel { width: clamp(380px, 34vw, 660px); }
.game-title { margin: 0; font-weight: 400; }
.title-window {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1130 / 280;
  overflow: visible;
}

/* Preserve the approved artwork's transparent margins and complete particle field. */
.title-art {
  position: absolute;
  top: -48%;
  left: -23%;
  display: block;
  width: 138%;
  max-width: none;
  height: auto;
  opacity: 0;
  pointer-events: none;
  user-select: none;
}
.title-art.is-ready { opacity: 1; }
.title-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  color: #d3cbdc;
  font-size: clamp(64px, 7vw, 128px);
  line-height: 1;
  letter-spacing: 0.1em;
}

.tagline {
  margin: clamp(18px, 2.4svh, 28px) 0 0;
  color: #c4c5cb;
  font-size: clamp(16px, 1.2vw, 22px);
  font-weight: 400;
  line-height: 1.7;
  letter-spacing: 0.18em;
  text-shadow: 0 2px 8px #000;
}

.action-menu {
  display: grid;
  gap: 10px;
  width: clamp(270px, 22vw, 340px);
  margin-top: clamp(36px, 7svh, 86px);
}

.menu-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: clamp(50px, 5.7svh, 62px);
  padding: 8px 24px;
  border: 1px solid transparent;
  border-radius: 1px;
  color: #c3c4cc;
  background: transparent;
  text-align: left;
  font-size: clamp(20px, 1.5vw, 26px);
  font-weight: 400;
  line-height: 1.4;
  letter-spacing: 0.22em;
  text-shadow: 0 2px 8px #000;
  cursor: pointer;
  transition:
    color 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
  -webkit-tap-highlight-color: transparent;
}

.menu-button-primary {
  min-height: clamp(54px, 6.1svh, 66px);
  margin-bottom: 4px;
}

.menu-button.is-selected:not(:disabled) {
  border-color: rgb(179 166 199 / 62%);
  color: #eeebf1;
  background: rgb(179 166 199 / 5%);
  box-shadow: inset 2px 0 0 #c9bed7, 0 0 18px rgb(179 166 199 / 16%);
}

.menu-button.is-selected:not(:disabled):hover,
.menu-button.is-selected:focus-visible {
  border-color: rgb(179 166 199 / 65%);
  color: #f2eff4;
  background: rgb(226 225 222 / 8%);
}
.menu-button:not(:disabled):active { background: rgb(226 225 222 / 4%); }
.menu-button.is-selected:focus-visible,
.footer-link:focus-visible,
.dialog-close:focus-visible,
.save-slot-button:focus-visible {
  outline: 2px solid var(--menu-violet);
  outline-offset: 5px;
}
.menu-button:disabled { color: #92949d; cursor: default; }
.empty-save-note {
  color: #8e929e;
  font-size: 12px;
  line-height: 1.5;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.menu-footer {
  position: relative;
  flex: 0 0 auto;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  width: min(100%, 1920px);
  margin-inline: auto;
  padding: 12px var(--menu-gutter) max(32px, env(safe-area-inset-bottom));
}
.footer-link {
  justify-self: start;
  min-height: 44px;
  padding: 8px 0;
  border: 0;
  color: #9da1af;
  background: transparent;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: color 160ms ease;
}
.footer-link-end { justify-self: end; }
.footer-link:hover { color: var(--menu-paper); }
.footer-message {
  margin: 0;
  color: #b7b8c1;
  font-size: 14px;
  line-height: 1.5;
  letter-spacing: 0.22em;
}

.start-view :deep(.bgm-control) {
  top: max(24px, env(safe-area-inset-top));
  right: max(28px, env(safe-area-inset-right));
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: 1px;
  color: #b6b4c0;
  background: rgb(9 11 14 / 42%);
  letter-spacing: 0.06em;
  transition: color 160ms ease, border-color 160ms ease;
}
.start-view :deep(.bgm-control:hover) { border-color: #6b6379; color: #e2e1de; }
.start-view :deep(.bgm-control:focus-visible) { outline-color: var(--menu-violet); }

.menu-dialog {
  width: min(480px, calc(100vw - 40px));
  max-height: calc(100svh - 48px);
  margin: auto;
  padding: 0;
  overflow: auto;
  border: 1px solid #625b6b;
  border-radius: 2px;
  color: var(--menu-paper);
  background: #111318;
  box-shadow: 0 24px 100px rgb(0 0 0 / 60%);
  scrollbar-width: thin;
  scrollbar-color: #625b6b #111318;
}
.menu-dialog::backdrop { background: rgb(3 5 8 / 78%); backdrop-filter: blur(5px); }
.dialog-panel { padding: 28px; }
.dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.dialog-header h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 400;
  line-height: 1.5;
  letter-spacing: 0.14em;
}
.dialog-close {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  margin: -8px -10px -8px 0;
  border: 0;
  color: #b6b0c0;
  background: transparent;
  cursor: pointer;
}
.dialog-close:hover { color: #fff; }
.dialog-intro,
.dialog-footnote {
  color: var(--menu-muted);
  font-size: 14px;
  line-height: 1.8;
}
.dialog-intro { margin: 14px 0 24px; }
.dialog-footnote { margin: 20px 0 0; }
.save-slot-list { display: grid; gap: 12px; }
.save-slot-button {
  display: grid;
  gap: 8px;
  width: 100%;
  min-height: 88px;
  padding: 18px 20px;
  border: 1px solid #51505b;
  border-radius: 1px;
  color: #e2e1de;
  background: rgb(226 225 222 / 3%);
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease;
}
.save-slot-button:not(:disabled):hover { border-color: #b3a6c7; background: rgb(179 166 199 / 8%); }
.save-slot-button:disabled { border-color: #2d3039; color: #8b8e98; cursor: default; }
.save-slot-title { font-size: 17px; line-height: 1.5; }
.save-slot-status { color: #a3a9b2; font-size: 13px; line-height: 1.6; }
.save-error { margin: 0 0 20px; color: #d8c5bd; font-size: 14px; line-height: 1.8; }
.about-copy { color: #bfc1c9; font-size: 15px; line-height: 1.9; }
.about-copy p { margin: 18px 0; }
.about-copy .about-lead { color: #e2e1de; }
.about-copy blockquote {
  margin: 24px 0;
  padding-left: 16px;
  border-left: 1px solid #8a7d9a;
  color: #cfc5da;
}
.about-copy .about-safety {
  margin-bottom: 0;
  padding-top: 18px;
  border-top: 1px solid #30313a;
  color: #a3a9b2;
  font-size: 13px;
}

@media (min-aspect-ratio: 21/9) {
  .menu-scene img { object-fit: contain; object-position: right center; }
}

@media (max-width: 760px), (max-width: 1024px) and (orientation: portrait) {
  .start-view { --menu-gutter: clamp(24px, 6.6vw, 52px); }
  .menu-scene { height: clamp(560px, 74svh, 760px); }
  .menu-scene img { object-position: 78% center; }
  .menu-shade {
    background:
      linear-gradient(180deg, rgb(5 7 10 / 20%), transparent 26%, #090b0e 73%),
      linear-gradient(90deg, rgb(5 7 10 / 32%), transparent 70%);
  }
  .menu-shell {
    min-height: calc(100svh - 94px);
    padding-top: max(76px, 10svh);
    padding-bottom: 24px;
  }
  .brand-panel { width: min(100%, 440px); }
  .title-art {
    top: -32%;
    left: calc(-1 * var(--menu-gutter));
    width: calc(100% + 2 * var(--menu-gutter));
  }
  .title-fallback { font-size: clamp(48px, 12vw, 86px); }
  .tagline { margin-top: 16px; font-size: clamp(15px, 3.8vw, 19px); letter-spacing: 0.12em; }
  .action-menu { width: min(100%, 310px); margin-top: clamp(160px, 24svh, 240px); gap: 8px; }
  .menu-button { min-height: 52px; padding-inline: 20px; font-size: 22px; }
  .menu-button-primary { min-height: 56px; }
  .menu-footer {
    column-gap: 12px;
    row-gap: 0;
    padding-top: 0;
    padding-bottom: max(22px, env(safe-area-inset-bottom));
  }
  .footer-message { font-size: 12px; letter-spacing: 0.12em; }
  .footer-link { font-size: 12px; letter-spacing: 0.06em; }
  .start-view :deep(.bgm-control) { top: max(14px, env(safe-area-inset-top)); right: 16px; }
  .dialog-panel { padding: 22px; }
}

@media (max-height: 620px) and (min-width: 480px) and (orientation: landscape) {
  .menu-scene { height: 100%; }
  .menu-scene img { object-position: 72% center; }
  .menu-shade {
    background:
      linear-gradient(90deg, rgb(5 7 10 / 38%), rgb(5 7 10 / 12%) 38%, transparent 62%),
      linear-gradient(0deg, rgb(5 7 10 / 52%), transparent 24%);
  }
  .menu-shell { min-height: 0; padding-top: 28px; padding-bottom: 24px; }
  .brand-panel { width: min(39vw, 420px); }
  .title-art { top: -48%; left: -12%; width: 128%; }
  .tagline { margin-top: 10px; font-size: 15px; }
  .action-menu { width: min(290px, 34vw); margin-top: 20px; gap: 4px; }
  .menu-button { min-height: 44px; font-size: 20px; }
  .menu-button-primary { min-height: 48px; }
  .menu-footer { padding-bottom: 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .start-view.fade-leave-active,
  .menu-button,
  .footer-link,
  .save-slot-button,
  .start-view :deep(.bgm-control) { transition: none; }
}
</style>
