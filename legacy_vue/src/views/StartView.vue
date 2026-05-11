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

    <picture class="home-layer home-title-mist" aria-hidden="true">
      <source :srcset="MENU_HOME_TITLE_MIST_MOBILE" media="(max-width: 768px)" type="image/webp" />
      <img :src="MENU_HOME_TITLE_MIST_DESKTOP" alt="" decoding="async" draggable="false" />
    </picture>

    <picture class="home-layer home-menu-aura" aria-hidden="true">
      <source :srcset="MENU_HOME_MENU_AURA_MOBILE" media="(max-width: 768px)" type="image/webp" />
      <img :src="MENU_HOME_MENU_AURA_DESKTOP" alt="" decoding="async" draggable="false" />
    </picture>

    <div class="home-vignette" aria-hidden="true"></div>
    <section class="home-composition">
      <div class="home-brand">
        <h1 id="start-title" class="sr-only">天台十句</h1>
        <picture>
          <source :srcset="MENU_TITLE_WEBP_IMAGE" type="image/webp" />
          <img
            class="home-title-art"
            :src="MENU_TITLE_IMAGE"
            width="1660"
            height="496"
            alt="天台十句"
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
          :style="{ '--action-delay': `${action.delay}ms` }"
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
            :disabled="!hasLoadSlot(slotId)"
            @click="loadFromSlot(slotId)"
          >
            <span class="save-slot-title">{{ getLoadSlotTitle(slotId) }}</span>
            <span class="save-slot-status">{{ getLoadSlotStatus(slotId) }}</span>
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CHAT_AFTER_SAVE_SLOT_SESSION_KEY,
  GAME_ENTRY_SESSION_KEY,
  GAME_ENTRY_TYPES,
  GAME_RULES
} from '@/domain/gameContract'
import { audioManager } from '@/modules/AudioManager'
import { SAVE_SLOT_KINDS, SaveSystem, type SaveSlot } from '@/modules/SaveSystem'
import { useGameStore } from '@/store/gameStore'

const router = useRouter()
const gameStore = useGameStore()
const SAVE_SLOT_IDS = GAME_RULES.saveSlotIds

const MENU_HOME_BG_DESKTOP = '/assets/images/menu_home_bg_1600.webp'
const MENU_HOME_BG_MOBILE = '/assets/images/menu_home_bg_900.webp'
const MENU_HOME_TITLE_MIST_DESKTOP = '/assets/images/menu_home_title_mist_1600.webp'
const MENU_HOME_TITLE_MIST_MOBILE = '/assets/images/menu_home_title_mist_900.webp'
const MENU_HOME_MENU_AURA_DESKTOP = '/assets/images/menu_home_menu_aura_1600.webp'
const MENU_HOME_MENU_AURA_MOBILE = '/assets/images/menu_home_menu_aura_900.webp'
const MENU_TITLE_WEBP_IMAGE = '/assets/images/menu_title.webp'
const MENU_TITLE_IMAGE = '/assets/images/menu_title.png'

const showLoadSlots = ref(false)
const saveSlots = ref<SaveSlot[]>([])

const saveSlotMap = computed(() => new Map(saveSlots.value.map((slot) => [slot.id, slot])))

const startGame = () => {
  audioManager.playSfx('click')
  gameStore.resetGame()
  sessionStorage.setItem(GAME_ENTRY_SESSION_KEY, GAME_ENTRY_TYPES.newGame)
  router.push('/game')
}

const loadGame = () => {
  audioManager.playSfx('click')
  refreshSaveSlots()
  showLoadSlots.value = true
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

const hasLoadSlot = (slotId: number) => saveSlotMap.value.has(slotId)

const getLoadSlotStatus = (slotId: number) => {
  const slot = saveSlotMap.value.get(slotId)
  return slot ? `已有存档：${formatSaveTime(slot.timestamp)}` : '空栏位'
}

const getLoadSlotTitle = (slotId: number) => {
  const slot = saveSlotMap.value.get(slotId)
  return slot?.kind === SAVE_SLOT_KINDS.chatAfter ? `栏位 ${slotId}（日后谈）` : `栏位 ${slotId}`
}

const closeLoadSlots = () => {
  showLoadSlots.value = false
}

const loadFromSlot = (slotId: number) => {
  audioManager.playSfx('click')
  if (!hasLoadSlot(slotId)) return

  const slot = saveSlotMap.value.get(slotId)
  if (slot?.kind === SAVE_SLOT_KINDS.chatAfter) {
    if (SaveSystem.loadChatAfter(slotId)) {
      sessionStorage.setItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY, String(slotId))
      router.push('/chat-after')
      return
    }

    alert('未找到有效存档。')
    refreshSaveSlots()
    return
  }

  if (SaveSystem.load(slotId)) {
    sessionStorage.setItem(GAME_ENTRY_SESSION_KEY, GAME_ENTRY_TYPES.load)
    sessionStorage.removeItem(CHAT_AFTER_SAVE_SLOT_SESSION_KEY)
    router.push('/game')
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

const MENU_ACTIONS = [
  {
    id: 'start',
    text: '开始',
    label: '开始游戏',
    primary: true,
    delay: 900,
    onClick: startGame
  },
  {
    id: 'load',
    text: '读档',
    label: '读取存档',
    primary: false,
    delay: 1080,
    onClick: loadGame
  },
  {
    id: 'achievements',
    text: '成就',
    label: '成就图鉴',
    primary: false,
    delay: 1260,
    onClick: goToAchievements
  },
  {
    id: 'settings',
    text: '设置',
    label: '游戏设置',
    primary: false,
    delay: 1440,
    onClick: goToSettings
  }
] as const
</script>

<style scoped>
.start-view {
  --home-violet: rgba(190, 171, 232, 0.78);
  --home-violet-strong: rgba(237, 228, 255, 0.96);
  --home-muted: rgba(205, 199, 220, 0.68);
  --home-dim: rgba(156, 150, 172, 0.48);
  --home-line: rgba(185, 177, 203, 0.28);

  position: relative;
  width: 100vw;
  height: 100vh;
  min-height: 560px;
  overflow: hidden;
  color: var(--home-muted);
  background: #020204;
  isolation: isolate;
}

.home-layer,
.home-layer img,
.home-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.home-layer {
  z-index: 0;
}

.home-layer img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  user-select: none;
}

.home-background img {
  object-position: center;
  filter: contrast(1.05) brightness(0.92);
  animation: sceneFade 760ms ease-out both;
}

.home-title-mist,
.home-menu-aura {
  z-index: 1;
  mix-blend-mode: screen;
  opacity: 0.74;
}

.home-title-mist img,
.home-menu-aura img {
  filter: saturate(0.72) brightness(0.82);
}

.home-menu-aura {
  opacity: 0.64;
}

.home-vignette {
  z-index: 2;
  background:
    radial-gradient(circle at 21% 42%, rgba(255, 255, 255, 0.04), transparent 26%),
    radial-gradient(circle at 70% 32%, rgba(171, 138, 224, 0.12), transparent 24%),
    linear-gradient(90deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.06) 34%, rgba(0, 0, 0, 0.52) 100%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.16), transparent 28%, rgba(0, 0, 0, 0.58));
}

.home-composition {
  position: absolute;
  z-index: 4;
  top: clamp(46px, 10vh, 92px);
  right: clamp(56px, 11vw, 174px);
  width: min(44vw, 650px);
  min-width: 480px;
  display: grid;
  justify-items: center;
  gap: clamp(18px, 3vh, 34px);
  text-align: center;
}

.home-brand {
  width: 100%;
}

.home-title-art {
  width: min(100%, 650px);
  height: auto;
  display: block;
  margin: 0 auto;
  opacity: 0;
  transform: translateY(10px);
  filter: blur(7px) brightness(0.64);
  animation: titleReveal 880ms cubic-bezier(0.2, 0.75, 0.18, 1) 260ms both;
  user-select: none;
}

.home-tagline {
  position: relative;
  width: min(76%, 560px);
  margin: 4px auto 0;
  padding: 0 18px;
  color: rgba(196, 190, 208, 0.66);
  font-family: var(--font-hanyi-pixel) !important;
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.35;
  letter-spacing: 0;
  text-align: center;
  text-shadow:
    0 0 4px rgba(214, 198, 255, 0.2),
    0 0 12px rgba(156, 126, 214, 0.12),
    0 1px 1px rgba(0, 0, 0, 0.82);
  opacity: 0;
  transform: translateY(12px);
  filter: blur(8px) brightness(0.55);
  animation: titleReveal 800ms cubic-bezier(0.2, 0.75, 0.18, 1) 620ms both;
}

.home-tagline::before,
.home-tagline::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 42px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(196, 188, 216, 0.38), transparent);
}

.home-tagline::before {
  right: calc(100% - 8px);
}

.home-tagline::after {
  left: calc(100% - 8px);
}

.home-actions {
  position: relative;
  display: grid;
  gap: clamp(8px, 1.7vh, 14px);
  justify-items: center;
  width: min(300px, 74%);
  margin-top: clamp(4px, 1vh, 12px);
}

.menu-button {
  --action-delay: 900ms;

  position: relative;
  width: 100%;
  min-height: clamp(42px, 6.2vh, 56px);
  padding: 0;
  border: 0;
  border-radius: 0;
  color: rgba(218, 211, 230, 0.72);
  background: transparent;
  cursor: pointer;
  opacity: 0;
  transform: translateY(12px);
  filter: blur(8px) brightness(0.55);
  animation: menuReveal 820ms cubic-bezier(0.2, 0.75, 0.18, 1) var(--action-delay) both;
}

.menu-button::before {
  content: '';
  position: absolute;
  left: 12%;
  right: 12%;
  top: 50%;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(171, 157, 202, 0.16),
    rgba(223, 214, 243, 0.38),
    rgba(171, 157, 202, 0.16),
    transparent
  );
  opacity: 0.62;
  transform: translateY(18px) scaleX(0.86);
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.menu-button::after {
  content: '';
  position: absolute;
  inset: 4px 8%;
  background: radial-gradient(ellipse at center, rgba(166, 132, 218, 0.2), transparent 62%);
  opacity: 0;
  filter: blur(12px);
  transition: opacity 180ms ease;
}

.menu-button-copy {
  position: relative;
  z-index: 1;
  display: inline-block;
  min-width: 4em;
  font-family: var(--font-hanyi-pixel) !important;
  font-size: 1.58rem;
  font-weight: 700;
  letter-spacing: 0;
  text-shadow:
    0 0 8px rgba(208, 185, 255, 0.32),
    0 0 22px rgba(106, 78, 160, 0.22),
    0 1px 1px rgba(0, 0, 0, 0.86);
  transition:
    color 180ms ease,
    filter 180ms ease,
    transform 180ms ease;
}

.menu-button:hover,
.menu-button:focus-visible {
  color: var(--home-violet-strong);
  outline: none;
}

.menu-button:hover::before,
.menu-button:focus-visible::before {
  opacity: 0.95;
  transform: translateY(18px) scaleX(1.02);
}

.menu-button:hover::after,
.menu-button:focus-visible::after {
  opacity: 1;
}

.menu-button:hover .menu-button-copy,
.menu-button:focus-visible .menu-button-copy {
  filter: brightness(1.18);
  transform: translateY(-1px);
}

.menu-button:focus-visible .menu-button-copy {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.28em;
}

.menu-button:active .menu-button-copy {
  transform: translateY(1px);
}

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

@keyframes sceneFade {
  from {
    opacity: 0;
    filter: contrast(1.02) brightness(0.68) blur(3px);
  }
  to {
    opacity: 1;
    filter: contrast(1.05) brightness(0.92) blur(0);
  }
}

@keyframes titleReveal {
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0) brightness(1);
  }
}

@keyframes menuReveal {
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0) brightness(1);
  }
}

@media (max-width: 960px) {
  .start-view {
    min-height: 620px;
  }

  .home-background img {
    object-position: 34% center;
  }

  .home-vignette {
    background:
      radial-gradient(circle at 26% 40%, rgba(255, 255, 255, 0.03), transparent 30%),
      linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.26) 42%, rgba(0, 0, 0, 0.76)),
      linear-gradient(90deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.36));
  }

  .home-composition {
    top: 7vh;
    right: 0;
    left: 0;
    width: auto;
    min-width: 0;
    padding: 0 22px;
    gap: 14px;
  }

  .home-title-art {
    width: min(94vw, 520px);
  }

  .home-actions {
    width: min(64vw, 250px);
    margin-top: 7px;
  }
}

@media (max-width: 640px) {
  .start-view {
    min-height: 100svh;
  }

  .home-background img {
    object-position: 24% center;
  }

  .home-composition {
    top: max(26px, 5.8vh);
    padding: 0 18px;
  }

  .home-title-art {
    width: min(92vw, 440px);
  }

  .home-tagline {
    width: min(82vw, 430px);
    font-size: 0.82rem;
    padding: 0 10px;
  }

  .home-tagline::before,
  .home-tagline::after {
    width: 24px;
  }

  .home-actions {
    width: min(58vw, 210px);
    gap: 6px;
  }

  .menu-button {
    min-height: 42px;
  }

  .menu-button-copy {
    font-size: 1.34rem;
  }

  .save-slot-overlay {
    padding: 16px;
    align-items: end;
  }

  .save-slot-panel {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-background img,
  .home-title-art,
  .home-tagline,
  .menu-button {
    animation-duration: 1ms;
    animation-delay: 0ms;
    transform: none;
    filter: none;
  }

}
</style>
