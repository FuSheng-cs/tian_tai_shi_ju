<template>
  <main class="start-view" aria-labelledby="start-title">
    <picture class="home-layer home-background" aria-hidden="true">
      <source :srcset="MENU_HOME_BG_MOBILE" media="(max-width: 768px)" type="image/webp" />
      <img
        :src="MENU_HOME_BG_DESKTOP"
        alt=""
        decoding="async"
        fetchpriority="high"
        draggable="false"
      />
    </picture>

    <div class="home-vignette" aria-hidden="true"></div>
    <BgmControl />
    <section class="home-composition">
      <div class="home-brand">
        <h1 id="start-title" class="sr-only">天台十句</h1>
        <picture class="title-picture" :class="{ 'title-ready': titleReady }"
          :style="{
            '--title-desktop': `url(${HOME_TITLE.desktop})`,
            '--title-mobile': `url(${HOME_TITLE.mobile})`
          }">
          <span v-if="!titleReady" class="title-fallback" aria-hidden="true">天台十句</span>
          <source :srcset="HOME_TITLE.mobile" media="(max-width: 768px)" type="image/webp" />
          <source :srcset="HOME_TITLE.desktop" type="image/webp" />
          <img
            class="home-title-art title-art"
            :src="MENU_TITLE_IMAGE"
            width="1660"
            height="496"
            @load="titleReady = true"
            alt="" aria-hidden="true"
            decoding="async"
            fetchpriority="high"
            draggable="false"
          />
        </picture>
        <p class="home-tagline">你需要在十句话内救下一个女孩</p>
      </div>

      <nav class="home-actions" aria-label="主菜单">
        <button
          v-for="action in MENU_ACTIONS"
          :key="action.id"
          type="button"
          class="menu-button"
          :class="{ 'menu-button-primary': action.primary }"
          :aria-label="action.label"
          @click="action.onClick"
        >
          <span class="menu-button-copy">{{ action.text }}</span>
        </button>
      </nav>
    </section>

    <div v-if="showLoadSlots" class="save-slot-overlay" @click.self="closeLoadSlots">
      <section class="save-slot-panel" aria-label="读取存档">
        <header class="save-slot-header">
          <h2>选择读取栏位</h2>
          <button type="button" aria-label="关闭" @click="closeLoadSlots">×</button>
        </header>

        <div class="save-slot-list">
          <button
            v-for="slotId in SAVE_SLOT_IDS"
            :key="slotId"
            type="button"
            class="save-slot-button"
            :disabled="!hasSlot(slotId)"
            @click="loadFromSlot(slotId)"
          >
            <span class="save-slot-title">{{ getSlotTitle(slotId) }}</span>
            <span class="save-slot-status">{{ getSlotStatus(slotId) }}</span>
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CHAT_AFTER_SLOT_QUERY_KEY,
  GAME_ENTRY_QUERY_KEY,
  GAME_ENTRY_TYPES,
  GAME_RULES
} from '@/domain/gameContract'
import { useGameStore } from '@/store/gameStore'
import { audioManager } from '@/modules/AudioManager'
import BgmControl from '@/components/BgmControl.vue'
import { SAVE_SLOT_KINDS, SaveSystem } from '@/modules/SaveSystem'
import { useSaveSlots } from '@/composables/useSaveSlots'
import { HOME_TITLE } from '@/domain/homeTitle.generated'


const router = useRouter()
const gameStore = useGameStore()
const SAVE_SLOT_IDS = GAME_RULES.saveSlotIds
const MENU_TITLE_IMAGE = '/assets/images/menu_title.png'
const titleReady = ref(false)

const showLoadSlots = ref(false)
const { refreshSaveSlots, getSlot, hasSlot, getSlotTitle, getSlotStatus } = useSaveSlots()

const startGame = () => {
  audioManager.playSfx('click')
  gameStore.resetGame()
  router.push({ path: '/game', query: { [GAME_ENTRY_QUERY_KEY]: GAME_ENTRY_TYPES.newGame } })
}

const loadGame = () => {
  audioManager.playSfx('click')
  refreshSaveSlots()
  showLoadSlots.value = true
}

const closeLoadSlots = () => {
  showLoadSlots.value = false
}

const loadFromSlot = (slotId: number) => {
  audioManager.playSfx('click')
  const slot = getSlot(slotId)
  if (!slot) return

  if (slot.kind === SAVE_SLOT_KINDS.chatAfter) {
    if (SaveSystem.loadChatAfter(slotId)) {
      router.push({ path: '/chat-after', query: { [CHAT_AFTER_SLOT_QUERY_KEY]: slotId } })
      return
    }

    alert('未找到有效存档。')
    refreshSaveSlots()
    return
  }

  if (SaveSystem.load(slotId)) {
    router.push({ path: '/game', query: { [GAME_ENTRY_QUERY_KEY]: GAME_ENTRY_TYPES.load } })
  } else {
    alert('未找到有效存档。')
    refreshSaveSlots()
  }
}

const goToSettings = () => {
  audioManager.playSfx('click')
  router.push('/settings')
}

const goToAchievements = () => {
  audioManager.playSfx('click')
  router.push('/achievements')
}
const MENU_HOME_BG_DESKTOP = '/assets/images/menu_home_bg_1600.webp'
const MENU_HOME_BG_MOBILE = '/assets/images/menu_home_bg_900.webp'
const MENU_ACTIONS = [
  { id: 'start', text: '开始', label: '开始游戏', primary: true, onClick: startGame },
  { id: 'load', text: '读档', label: '读取存档', primary: false, onClick: loadGame },
  { id: 'achievements', text: '成就', label: '成就图鉴', primary: false, onClick: goToAchievements },
  { id: 'settings', text: '设置', label: '游戏设置', primary: false, onClick: goToSettings }
] as const
</script>

<style scoped>
.start-view {
  --title-color: #bfb3d0;
  --home-violet-strong: #f1edf6;
  position: relative;
  width: 100%; height: 100svh; min-height: 100svh;
  overflow: hidden;
  color: #dedbe2;
  background: #050506;
  isolation: isolate;
}
.start-view.fade-enter-active { transition: none; }
.start-view.fade-enter-from { opacity: 1; }
.home-background, .home-background img, .home-vignette {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}
.home-background img {
  object-fit: cover;
  object-position: center;
  filter: grayscale(1) contrast(1.03) brightness(0.91);
}
.home-vignette {
  z-index: 1;
  background: linear-gradient(90deg, transparent 38%, rgba(0, 0, 0, 0.2) 69%, rgba(0, 0, 0, 0.1)),
    linear-gradient(180deg, transparent 70%, rgba(0, 0, 0, 0.22));
}
.home-composition {
  position: absolute;
  z-index: 4;
  top: clamp(92px, 13svh, 140px);
  right: clamp(48px, 10vw, 190px);
  width: min(39vw, 600px);
  display: grid;
  justify-items: center;
  gap: clamp(28px, 4svh, 42px);
  text-align: center;
}
.home-brand { width: 100%; }
.title-picture { position: relative; display: block; width: 100%; isolation: isolate; }
.home-title-art { display: block; width: 100%; height: auto; filter: brightness(1.08); }
.title-picture::after {
  content: '';
  position: absolute; inset: 0;
  background: var(--title-color);
  mask-image: var(--title-desktop);
  mask-position: center; mask-repeat: no-repeat; mask-size: contain;
  opacity: 0;
  mix-blend-mode: color;
  pointer-events: none;
}
.title-ready::after { opacity: 1; }
@supports not (mask-image: url('')) { .title-picture::after { display: none; } }
.title-fallback {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  color: var(--title-color);
  font-size: clamp(32px, 4vw, 64px);
  letter-spacing: 0.12em;
}
.home-tagline {
  margin: 16px 0 0;
  color: #bbb8c2;
  font-size: clamp(13px, 1vw, 16px);
  line-height: 1.65;
  letter-spacing: 0.035em;
  text-shadow: 0 1px 5px #000;
}
.home-actions {
  display: grid;
  gap: 12px;
  width: min(250px, 70%);
}
.menu-button {
  position: relative;
  width: 100%; min-height: 52px;
  padding: 0;
  border: 0; background: transparent;
  color: #c9c6d0;
  cursor: pointer;
  font-size: 24px; line-height: 1.5;
  letter-spacing: 0.11em;
  text-shadow: 0 1px 5px #000;
  transition: color 140ms ease, text-shadow 140ms ease;
}
.menu-button::after {
  content: '';
  position: absolute; bottom: 0; left: 20%; right: 20%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(214, 208, 225, 0.22), transparent);
}
.menu-button-primary { color: #e3dce9; }
.menu-button:hover { color: #fff; text-shadow: 0 0 9px rgba(210, 199, 226, 0.25); }
.menu-button:focus-visible { outline: 1px solid #c8c2d0; outline-offset: 4px; border-radius: 2px; }
:deep(.bgm-control) { color: #b8b5bf; border-color: rgba(194, 188, 204, 0.27); }
@media (max-width: 768px) {
  .home-background img { object-position: 18% center; }
  .home-composition {
    top: max(88px, calc(env(safe-area-inset-top) + 72px));
    left: 50%; right: auto; transform: translateX(-50%);
    width: min(84%, 420px);
    gap: 28px;
  }
  .title-picture::after { mask-image: var(--title-mobile); }
  .home-tagline { margin-top: 14px; font-size: 13px; letter-spacing: 0; }
  .home-actions { width: min(230px, 76%); gap: 9px; }
  .menu-button { min-height: 46px; font-size: 22px; }
  .home-vignette { background: linear-gradient(180deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.16) 60%, rgba(0, 0, 0, 0.18)); }
}
@media (max-height: 620px) and (min-width: 769px) {
  .home-composition { top: 66px; right: 8vw; width: min(42vw, 500px); gap: 18px; }
  .title-picture { width: min(100%, 360px); margin: 0 auto; }
  .home-actions { gap: 4px; }
  .menu-button { min-height: 42px; font-size: 21px; }
}
@media (max-height: 450px) {
  .home-composition { top: 58px; gap: 12px; }
  .title-picture { max-width: 260px; margin: 0 auto; }
  .home-tagline { margin-top: 6px; font-size: 12px; }
  .home-actions { gap: 2px; }
  .menu-button { min-height: 34px; font-size: 18px; }
}
@media (prefers-reduced-motion: reduce) { .menu-button { transition: none; } }
.save-slot-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 24px;
  background:
    radial-gradient(circle at center, rgba(84, 66, 118, 0.16), transparent 40%),
    rgba(0, 0, 0, 0.66);
  backdrop-filter: blur(2px);
}

.save-slot-panel {
  width: min(92vw, 430px);
  padding: 18px;
  border: 1px solid rgba(142, 141, 155, 0.34);
  border-radius: 6px;
  color: rgba(229, 226, 235, 0.9);
  background:
    linear-gradient(180deg, rgba(15, 16, 21, 0.92), rgba(4, 5, 8, 0.94)),
    radial-gradient(circle at top, rgba(154, 125, 202, 0.14), transparent 50%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    0 22px 70px rgba(0, 0, 0, 0.6);
}

.save-slot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.save-slot-header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0;
}

.save-slot-header button {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(142, 141, 155, 0.28);
  border-radius: 4px;
  color: rgba(226, 222, 235, 0.78);
  background: rgba(8, 10, 14, 0.58);
  cursor: pointer;
}

.save-slot-header button:hover,
.save-slot-header button:focus-visible {
  border-color: rgba(216, 208, 235, 0.52);
  color: rgba(255, 255, 255, 0.94);
  outline: none;
}

.save-slot-list {
  display: grid;
  gap: 10px;
}

.save-slot-button {
  display: grid;
  gap: 5px;
  min-height: 72px;
  padding: 13px 14px;
  border: 1px solid rgba(124, 130, 145, 0.3);
  border-radius: 4px;
  color: rgba(226, 222, 235, 0.84);
  text-align: left;
  background:
    linear-gradient(180deg, rgba(18, 20, 27, 0.76), rgba(7, 8, 12, 0.84)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 4px);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.save-slot-button:not(:disabled):hover,
.save-slot-button:not(:disabled):focus-visible {
  border-color: rgba(211, 202, 231, 0.52);
  background:
    linear-gradient(180deg, rgba(27, 27, 35, 0.82), rgba(9, 10, 14, 0.9)),
    radial-gradient(circle at right, rgba(153, 121, 202, 0.13), transparent 50%);
  outline: none;
  transform: translateY(-1px);
}

.save-slot-button:disabled {
  color: rgba(158, 156, 166, 0.48);
  cursor: not-allowed;
  opacity: 0.72;
}

.save-slot-title,
.save-slot-status {
  display: block;
}

.save-slot-title {
  font-size: 1rem;
  font-weight: 700;
}

.save-slot-status {
  font-size: 0.82rem;
  color: rgba(181, 177, 192, 0.62);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

</style>
