<template>
  <main class="start-view" aria-labelledby="start-title">
    <div class="menu-bg" aria-hidden="true"></div>
    <div class="character-layer" aria-hidden="true"></div>
    <div class="rain-layer" aria-hidden="true"></div>
    <div class="menu-shade" aria-hidden="true"></div>
    <div class="purple-haze" aria-hidden="true"></div>

    <section class="menu-shell">
      <div class="brand-panel">
        <h1 id="start-title" class="sr-only">天台十句</h1>
        <picture>
          <source :srcset="MENU_TITLE_WEBP_IMAGE" type="image/webp" />
          <img
            class="title-art"
            :src="MENU_TITLE_IMAGE"
            width="1660"
            height="496"
            alt=""
            aria-hidden="true"
            decoding="async"
            fetchpriority="high"
            draggable="false"
          />
        </picture>
        <p class="tagline">
          <span class="quote-mark quote-mark-open" aria-hidden="true">“</span>
          <span class="quote-copy">
            <strong>{{ GAME_RULES.initialRoundCount }} 句话后</strong>，她可能从天台坠落。<br />
            你说的每一个字，都在决定她靠近你，还是靠近风。
          </span>
          <span class="quote-mark quote-mark-close" aria-hidden="true">”</span>
        </p>
      </div>

      <article class="intro-card" aria-label="关于游戏">
        <header class="intro-heading">
          <Info :size="20" :stroke-width="1.9" aria-hidden="true" />
          <span>关于游戏</span>
        </header>
        <p>
          在这个霓虹闪烁的深夜，你来到了天台。坐在围栏边缘的女孩名叫{{ GAME_ROLE.characterName }}。
          她厌倦世界，也厌倦被人用标准答案拯救。
        </p>
        <p>
          你的目标：用有限的 {{ GAME_RULES.initialRoundCount }} 句话靠近她的内心，把她从边缘拉回来。
        </p>
        <ul class="intro-list">
          <li>每一句话都可能改变她的情绪与选择。</li>
          <li>倾听比说教更重要，敷衍会让她离你更远。</li>
          <li>不同回应会导向不同结局与后续相遇。</li>
        </ul>
      </article>

      <nav class="action-menu" aria-label="主菜单">
        <button type="button" class="menu-button menu-button-primary" @click="startGame">
          <Sparkles :size="24" :stroke-width="1.8" aria-hidden="true" />
          <span>开始游戏</span>
          <ArrowRight class="arrow-icon" :size="24" :stroke-width="1.8" aria-hidden="true" />
        </button>

        <button type="button" class="menu-button" @click="loadGame">
          <FolderOpen :size="23" :stroke-width="1.8" aria-hidden="true" />
          <span>读取存档</span>
        </button>

        <button type="button" class="menu-button" @click="goToAchievements">
          <Trophy :size="23" :stroke-width="1.8" aria-hidden="true" />
          <span>成就图鉴</span>
        </button>

        <button type="button" class="menu-button" @click="goToSettings">
          <Settings :size="23" :stroke-width="1.8" aria-hidden="true" />
          <span>游戏设置</span>
        </button>
      </nav>
    </section>

    <footer class="menu-footer" aria-label="版本信息">
      <span class="footer-dot"></span>
      <span>v1.7.0</span>
      <span class="footer-line"></span>
      <span>AI-DRIVEN NARRATIVE EXPERIENCE</span>
    </footer>

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
import { CHAT_AFTER_SAVE_SLOT_SESSION_KEY, GAME_ENTRY_SESSION_KEY, GAME_ENTRY_TYPES, GAME_ROLE, GAME_RULES } from '@/domain/gameContract'
import { useGameStore } from '@/store/gameStore'
import { audioManager } from '@/modules/AudioManager'
import { SAVE_SLOT_KINDS, SaveSystem, type SaveSlot } from '@/modules/SaveSystem'
import {
  ArrowRight,
  FolderOpen,
  Info,
  Settings,
  Sparkles,
  Trophy
} from 'lucide-vue-next'

const router = useRouter()
const gameStore = useGameStore()
const SAVE_SLOT_IDS = GAME_RULES.saveSlotIds
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
</script>

<style scoped>
.start-view {
  --menu-violet: #b66cff;
  --menu-violet-soft: #d8b6ff;
  --menu-line: rgba(216, 182, 255, 0.42);
  --menu-panel: rgba(8, 8, 16, 0.58);
  --menu-panel-strong: rgba(8, 8, 16, 0.72);
  --menu-text: rgba(245, 241, 255, 0.92);
  --menu-muted: rgba(224, 219, 235, 0.74);

  position: relative;
  width: 100%;
  height: 100svh;
  min-height: 660px;
  overflow: hidden;
  color: var(--menu-text);
  background: #050508;
  font-family: "Microsoft YaHei", "Noto Sans SC", "Source Han Sans", sans-serif;
  isolation: isolate;
}

.menu-bg,
.character-layer,
.rain-layer,
.menu-shade,
.purple-haze {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.menu-bg {
  z-index: 0;
  background-image: url('/assets/images/menu_bg_rooftop_1600.webp');
  background-image: image-set(
    url('/assets/images/menu_bg_rooftop_1600.webp') type('image/webp'),
    url('/assets/images/menu_bg_rooftop.png') type('image/png')
  );
  background-position: center;
  background-size: cover;
  filter: saturate(0.9) contrast(1.08) brightness(0.78);
  transform: scale(1.035);
  animation: menu-bg-drift 38s ease-in-out infinite;
}

.character-layer {
  z-index: 4;
  background-image: url('/assets/images/char_girl_smoke_1600.webp');
  background-image: image-set(
    url('/assets/images/char_girl_smoke_1600.webp') type('image/webp'),
    url('/assets/images/char_girl_smoke.png') type('image/png')
  );
  background-position: center 52%;
  background-size: cover;
  opacity: 0.42;
  filter: grayscale(0.12) saturate(0.72) contrast(1.08) brightness(0.74);
  mix-blend-mode: normal;
  -webkit-mask-image: radial-gradient(
    ellipse 42% 68% at 58% 55%,
    black 0%,
    black 42%,
    rgba(0, 0, 0, 0.46) 62%,
    transparent 82%
  );
  mask-image: radial-gradient(
    ellipse 42% 68% at 58% 55%,
    black 0%,
    black 42%,
    rgba(0, 0, 0, 0.46) 62%,
    transparent 82%
  );
}

.rain-layer {
  z-index: 2;
  background-image: url('/assets/images/vfx_rain_sprite.webp');
  background-repeat: repeat;
  background-size: 360px 360px;
  opacity: 0.22;
  mix-blend-mode: screen;
  animation: rain-fall 1.8s linear infinite;
}

.menu-shade {
  z-index: 3;
  background:
    linear-gradient(90deg, rgba(3, 3, 8, 0.88) 0%, rgba(7, 7, 14, 0.58) 34%, rgba(3, 3, 8, 0.72) 100%),
    linear-gradient(180deg, rgba(4, 4, 9, 0.18) 0%, rgba(4, 4, 9, 0.2) 48%, rgba(4, 4, 9, 0.9) 100%);
}

.purple-haze {
  z-index: 3;
  opacity: 0.78;
  background:
    radial-gradient(ellipse at 22% 24%, rgba(162, 83, 255, 0.34), transparent 30%),
    radial-gradient(ellipse at 82% 44%, rgba(157, 85, 255, 0.22), transparent 28%),
    linear-gradient(180deg, transparent 64%, rgba(22, 10, 32, 0.54) 100%);
}

.menu-shell {
  position: absolute;
  z-index: 6;
  left: 50%;
  top: 50%;
  width: min(100vw, calc(100svh * 16 / 9));
  max-width: 1920px;
  aspect-ratio: 16 / 9;
  transform: translate(-50%, -50%);
  container-type: inline-size;
}

.brand-panel {
  position: absolute;
  left: 10.4%;
  top: 13.2%;
  width: 38.8%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.title-art {
  display: block;
  width: 37.4cqw;
  max-width: none;
  height: auto;
  margin: 0;
  user-select: none;
  filter:
    drop-shadow(0 0 16px rgba(187, 115, 255, 0.74))
    drop-shadow(0 0 36px rgba(133, 67, 198, 0.48));
}

.tagline {
  display: flex;
  align-items: flex-start;
  gap: 0.78cqw;
  width: 31.4cqw;
  max-width: none;
  margin: 1.2cqw 0 0 3.6cqw;
  color: rgba(240, 235, 250, 0.84);
  font-size: clamp(0.9rem, 1.08cqw, 1.08rem);
  line-height: 1.68;
  font-style: italic;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.82);
}

.tagline strong {
  color: var(--menu-violet-soft);
  font-weight: 800;
  text-shadow: 0 0 16px rgba(182, 108, 255, 0.62);
}

.quote-mark {
  flex: 0 0 auto;
  color: var(--menu-violet);
  font-family: Georgia, "Times New Roman", serif;
  font-size: clamp(1.55rem, 2.05cqw, 2.2rem);
  font-style: normal;
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 0 14px rgba(182, 108, 255, 0.82);
}

.quote-mark-open {
  margin-top: 0.18em;
}

.quote-mark-close {
  align-self: flex-end;
  margin-bottom: -0.08em;
}

.quote-copy {
  min-width: 0;
}

.quote-copy strong {
  color: var(--menu-violet);
  filter: drop-shadow(0 0 10px rgba(182, 108, 255, 0.74));
}

.intro-card {
  position: absolute;
  left: 13.9%;
  top: 46.4%;
  width: 30.4cqw;
  max-width: none;
  padding: 1.5cqw 1.9cqw 1.65cqw;
  color: var(--menu-muted);
  background:
    linear-gradient(180deg, rgba(22, 15, 34, 0.64), rgba(4, 4, 10, 0.64)),
    rgba(0, 0, 0, 0.28);
  border: 1px solid var(--menu-line);
  border-radius: 8px;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 18px 60px rgba(0, 0, 0, 0.42),
    0 0 36px rgba(151, 78, 230, 0.18);
  backdrop-filter: blur(9px);
}

.intro-heading {
  display: flex;
  align-items: center;
  gap: 0.62cqw;
  margin-bottom: 0.86cqw;
  color: var(--menu-violet-soft);
  font-size: clamp(0.9rem, 1.06cqw, 1.05rem);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.intro-card p {
  margin: 0 0 0.76cqw;
  font-size: clamp(0.84rem, 0.92cqw, 0.96rem);
  line-height: 1.76;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.7);
}

.intro-list {
  display: grid;
  gap: 0.5cqw;
  margin: 1cqw 0 0;
  padding: 0.96cqw 0 0;
  border-top: 1px dashed rgba(216, 182, 255, 0.24);
  list-style: none;
}

.intro-list li {
  position: relative;
  padding-left: 1.45cqw;
  font-size: clamp(0.78rem, 0.84cqw, 0.88rem);
  line-height: 1.62;
  color: rgba(231, 226, 240, 0.74);
}

.intro-list li::before {
  content: "";
  position: absolute;
  left: 0.12cqw;
  top: 0.68em;
  width: 0.42cqw;
  height: 0.42cqw;
  border: 1px solid var(--menu-violet);
  transform: rotate(45deg);
  box-shadow: 0 0 10px rgba(182, 108, 255, 0.76);
}

.action-menu {
  position: absolute;
  left: 65.2%;
  top: 38.2%;
  width: 22.9cqw;
  display: grid;
  gap: 1.05cqw;
}

.menu-button {
  position: relative;
  display: grid;
  grid-template-columns: 2cqw 1fr 2cqw;
  align-items: center;
  min-height: 4.8cqw;
  padding: 0 1.5cqw;
  overflow: hidden;
  color: rgba(247, 243, 255, 0.88);
  background:
    linear-gradient(180deg, rgba(16, 15, 22, 0.74), rgba(5, 5, 10, 0.74)),
    rgba(0, 0, 0, 0.36);
  border: 1px solid rgba(220, 207, 242, 0.32);
  border-radius: 8px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.08) inset,
    0 14px 32px rgba(0, 0, 0, 0.38);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    color 180ms ease,
    transform 180ms ease,
    background-color 180ms ease;
}

.menu-button::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0;
  background: linear-gradient(90deg, rgba(182, 108, 255, 0.28), rgba(255, 255, 255, 0.04));
  transition: opacity 180ms ease;
}

.menu-button svg,
.menu-button span {
  position: relative;
  z-index: 1;
}

.menu-button svg {
  color: var(--menu-violet-soft);
}

.menu-button span {
  justify-self: center;
  font-size: clamp(1rem, 1.36cqw, 1.35rem);
  font-weight: 700;
  letter-spacing: 0.12em;
}

.menu-button:hover,
.menu-button:focus-visible {
  color: #fff;
  border-color: rgba(229, 205, 255, 0.78);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.1) inset,
    0 0 0 1px rgba(182, 108, 255, 0.28),
    0 0 34px rgba(182, 108, 255, 0.28),
    0 18px 42px rgba(0, 0, 0, 0.46);
  transform: translateY(-2px);
}

.menu-button:hover::before,
.menu-button:focus-visible::before {
  opacity: 1;
}

.menu-button:focus-visible {
  outline: 2px solid rgba(229, 205, 255, 0.82);
  outline-offset: 3px;
}

.menu-button-primary {
  min-height: 5.2cqw;
  color: #fff;
  background:
    linear-gradient(90deg, rgba(115, 45, 177, 0.52), rgba(25, 19, 38, 0.7)),
    var(--menu-panel-strong);
  border-color: rgba(198, 126, 255, 0.86);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.14) inset,
    0 0 0 1px rgba(182, 108, 255, 0.2),
    0 0 26px rgba(182, 108, 255, 0.44),
    0 18px 48px rgba(0, 0, 0, 0.5);
}

.menu-button-primary span {
  font-size: clamp(1.08rem, 1.52cqw, 1.48rem);
}

.arrow-icon {
  justify-self: end;
  transition: transform 180ms ease;
}

.menu-button-primary:hover .arrow-icon,
.menu-button-primary:focus-visible .arrow-icon {
  transform: translateX(5px);
}

.menu-footer {
  position: absolute;
  z-index: 7;
  left: 50%;
  bottom: 24px;
  display: flex;
  align-items: center;
  gap: 14px;
  width: min(540px, calc(100% - 48px));
  transform: translateX(-50%);
  color: rgba(222, 214, 234, 0.44);
  font-family: "Consolas", "Cascadia Mono", monospace;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  white-space: nowrap;
}

.footer-dot {
  width: 8px;
  height: 8px;
  background: var(--menu-violet);
  transform: rotate(45deg);
  box-shadow: 0 0 12px rgba(182, 108, 255, 0.84);
}

.footer-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(216, 182, 255, 0.34), transparent);
}

.save-slot-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.58);
  backdrop-filter: blur(8px);
}

.save-slot-panel {
  width: min(380px, 100%);
  padding: 20px;
  color: var(--menu-text);
  background:
    linear-gradient(180deg, rgba(22, 15, 34, 0.92), rgba(4, 4, 10, 0.94)),
    rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(216, 182, 255, 0.42);
  border-radius: 8px;
  box-shadow:
    0 18px 60px rgba(0, 0, 0, 0.54),
    0 0 34px rgba(182, 108, 255, 0.22);
}

.save-slot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.save-slot-header h2 {
  margin: 0;
  color: var(--menu-violet-soft);
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0;
}

.save-slot-header button {
  color: rgba(224, 219, 235, 0.62);
  font-size: 1.5rem;
  line-height: 1;
  transition: color 180ms ease;
}

.save-slot-header button:hover,
.save-slot-header button:focus-visible {
  color: #fff;
}

.save-slot-list {
  display: grid;
  gap: 12px;
}

.save-slot-button {
  display: block;
  width: 100%;
  padding: 13px 16px;
  text-align: left;
  background: rgba(0, 0, 0, 0.36);
  border: 1px solid rgba(220, 207, 242, 0.26);
  border-radius: 8px;
  transition:
    border-color 180ms ease,
    background-color 180ms ease,
    color 180ms ease;
}

.save-slot-button:not(:disabled):hover,
.save-slot-button:not(:disabled):focus-visible {
  background: rgba(92, 39, 140, 0.36);
  border-color: rgba(216, 182, 255, 0.78);
}

.save-slot-button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.save-slot-title,
.save-slot-status {
  display: block;
}

.save-slot-title {
  color: rgba(247, 243, 255, 0.92);
  font-size: 0.95rem;
  font-weight: 800;
}

.save-slot-status {
  margin-top: 4px;
  color: rgba(224, 219, 235, 0.62);
  font-size: 0.78rem;
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

@keyframes menu-bg-drift {
  0% {
    transform: scale(1.035) translate(0, 0);
  }
  50% {
    transform: scale(1.07) translate(-0.8%, -0.5%);
  }
  100% {
    transform: scale(1.035) translate(0, 0);
  }
}

@keyframes rain-fall {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 90px 360px;
  }
}

@media (max-width: 980px) {
  .start-view {
    min-height: 100svh;
    overflow-y: auto;
  }

  .menu-bg {
    background-image: url('/assets/images/menu_bg_rooftop_900.webp');
    background-image: image-set(
      url('/assets/images/menu_bg_rooftop_900.webp') type('image/webp'),
      url('/assets/images/menu_bg_rooftop.png') type('image/png')
    );
    background-position: center;
  }

  .character-layer {
    opacity: 0.28;
    background-image: url('/assets/images/char_girl_smoke_900.webp');
    background-image: image-set(
      url('/assets/images/char_girl_smoke_900.webp') type('image/webp'),
      url('/assets/images/char_girl_smoke.png') type('image/png')
    );
    background-position: center;
    -webkit-mask-image: linear-gradient(180deg, transparent 0%, black 20%, black 70%, transparent 100%);
    mask-image: linear-gradient(180deg, transparent 0%, black 20%, black 70%, transparent 100%);
  }

  .menu-shade {
    background:
      linear-gradient(180deg, rgba(3, 3, 8, 0.78) 0%, rgba(3, 3, 8, 0.56) 42%, rgba(3, 3, 8, 0.94) 100%),
      linear-gradient(90deg, rgba(3, 3, 8, 0.76), rgba(3, 3, 8, 0.58));
  }

  .menu-shell {
    position: relative;
    left: auto;
    top: auto;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 18px;
    width: min(560px, calc(100% - 32px));
    max-width: none;
    min-height: auto;
    aspect-ratio: auto;
    transform: none;
    container-type: normal;
    margin: 0 auto;
    padding: 26px 0 78px;
  }

  .brand-panel {
    position: static;
    width: 100%;
    order: 1;
    align-items: center;
  }

  .action-menu {
    position: static;
    width: 100%;
    order: 2;
    gap: 12px;
  }

  .intro-card {
    position: static;
    order: 3;
    width: 100%;
    max-width: none;
    transform: none;
    padding: 18px 18px 20px;
  }

  .title-art {
    width: min(100%, 420px);
    margin: 0 auto;
  }

  .tagline {
    justify-content: center;
    width: 100%;
    max-width: 440px;
    margin: 4px auto 0;
    font-size: 0.98rem;
    line-height: 1.75;
    text-align: left;
  }

  .quote-mark {
    font-size: 1.7rem;
  }

  .intro-heading {
    gap: 10px;
    font-size: 0.95rem;
  }

  .intro-list li {
    padding-left: 24px;
  }

  .intro-list li::before {
    left: 2px;
    width: 7px;
    height: 7px;
  }

  .menu-button,
  .menu-button-primary {
    min-height: 62px;
    grid-template-columns: 30px 1fr 30px;
    padding: 0 18px;
  }

  .menu-button span {
    font-size: 1rem;
    letter-spacing: 0.1em;
  }

  .menu-button-primary span {
    font-size: 1.08rem;
  }

  .menu-footer {
    position: relative;
    left: auto;
    bottom: auto;
    margin: -58px auto 18px;
    transform: none;
    justify-content: center;
    width: calc(100% - 32px);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
  }

  .footer-line {
    display: none;
  }
}

@media (max-width: 480px) {
  .menu-shell {
    width: calc(100% - 24px);
    padding-top: 20px;
  }

  .title-art {
    width: min(100%, 340px);
  }

  .tagline {
    font-size: 0.9rem;
  }

  .intro-heading {
    margin-bottom: 12px;
  }

  .intro-card p {
    font-size: 0.88rem;
    line-height: 1.7;
  }

  .intro-list {
    margin-top: 14px;
  }

  .intro-list li {
    font-size: 0.84rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-bg,
  .rain-layer {
    animation: none;
  }

  .menu-button,
  .menu-button::before,
  .arrow-icon {
    transition: none;
  }
}
</style>
