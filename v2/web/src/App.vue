<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  Camera,
  Check,
  ChevronRight,
  Download,
  LoaderCircle,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-vue-next'
import SceneDialog from './components/SceneDialog.vue'
import { useAmbientAudio } from './composables/useAmbientAudio'
import { useGame } from './composables/useGame'
import { usePreferences } from './composables/usePreferences'
import {
  countCharacters,
  makeMemento,
  observations,
  phaseNames,
  rehearsalLines,
  type EndingChoice,
  type Observation,
  type PlayMode,
} from './domain'

const game = useGame()
const {
  session,
  health,
  healthLoading,
  healthError,
  savedId,
  busy,
  error,
  notice,
  pendingTurn,
  pendingEnding,
} = game
const { preferences, systemReducedMotion } = usePreferences()
const audio = useAmbientAudio()
const { soundEnabled, musicVolume, rainVolume, isPlaying } = audio
const screen = ref<'home' | 'intro' | 'game'>('home')
const modal = ref<'start' | 'settings' | 'about' | 'journal' | null>(null)
const journalTab = ref<'memories' | 'transcript'>('memories')
const introStep = ref(0)
const input = ref('')
const selectedObservation = ref<Observation | undefined>()
const inspecting = ref<Observation | null>(null)
const composing = ref(false)
const textarea = ref<HTMLTextAreaElement>()
const exportNotice = ref('')
const chars = computed(() => countCharacters(input.value))
const reducedMotion = computed(
  () => preferences.value.motion === 'reduced' || systemReducedMotion.value,
)
const sceneArt = computed(() => {
  if (screen.value !== 'game' || !session.value) return '/art/rooftop.webp'
  if (session.value.status === 'ended') return '/art/dawn.webp'
  if (session.value.phase !== 'arrival') return '/art/listening.webp'
  return '/art/rooftop.webp'
})
const sceneTime = computed(() => {
  const turn = session.value?.turn ?? 0
  return turn < 3 ? '23:47' : turn < 7 ? '23:52' : turn < 10 ? '00:03' : '00:12'
})
const lastCharacter = computed(() =>
  [...(session.value?.messages ?? [])].reverse().find((message) => message.role === 'character'),
)
const lastNarration = computed(() => {
  const messages = session.value?.messages ?? []
  const lastPlayerIndex = messages.map((message) => message.role).lastIndexOf('player')
  return [...messages.slice(lastPlayerIndex + 1)]
    .reverse()
    .find((message) => message.role === 'narrator')
})
const lastPlayer = computed(() =>
  [...(session.value?.messages ?? [])].reverse().find((message) => message.role === 'player'),
)
const observation = computed(() => observations.find((item) => item.id === inspecting.value))
const selectedObject = computed(() =>
  observations.find((item) => item.id === selectedObservation.value),
)
const canSend = computed(
  () =>
    !busy.value &&
    (Boolean(pendingTurn.value) ||
      (chars.value > 0 && chars.value <= 120 && input.value.trim().length > 0)),
)
const introScenes = [
  {
    number: '01',
    kicker: '23:47 / 消防楼梯',
    text: '消防门没有关严。',
    detail: '雨声从门缝里传进来。你推开门，走进这座城市少有人停留的一角。',
  },
  {
    number: '02',
    kicker: '屋檐下 / 一个陌生人',
    text: '有人护着一个牛皮纸袋。',
    detail: '相机背带绕在她的手腕上。她听见门声，没有回头。你停在一个不会打扰她的距离。',
  },
  {
    number: '03',
    kicker: '这一夜 / 十次开口',
    text: '不必找到一句完美的话。',
    detail: '看看身边的东西，听听她的话。你有十次开口的时间，至于说什么，由你自己决定。',
  },
]
const endingChoices: { id: EndingChoice; number: string; title: string; description: string }[] = [
  {
    id: 'handoff',
    number: '01',
    title: '陪她走到门里的灯下',
    description: '把这一夜，交给下一段有人在的路。',
  },
  {
    id: 'separate',
    number: '02',
    title: '道一声晚安，各自离开',
    description: '有些相遇不必延长，也已经留下了什么。',
  },
  {
    id: 'correspondence',
    number: '03',
    title: '问她，愿不愿意寄来一张照片',
    description: '给未来留一个可以回应、也可以拒绝的邀请。',
  },
]

onMounted(() => {
  void game.checkHealth()
})
watch(
  () => session.value?.id,
  () => {
    input.value = ''
    selectedObservation.value = undefined
    inspecting.value = null
  },
)
watch(
  () => (screen.value === 'home' ? 'arrival' : (session.value?.phase ?? 'arrival')),
  (phase) => audio.setPhase(phase),
  { immediate: true },
)

async function focusScene() {
  await nextTick()
  document.getElementById('main-content')?.focus({ preventScroll: true })
  window.scrollTo({ top: 0, behavior: 'instant' })
}
watch(screen, () => {
  void focusScene()
})
watch(
  () => session.value?.status,
  (status, previous) => {
    if (status === 'ended' && previous !== 'ended' && screen.value === 'game') void focusScene()
  },
)

function openStart() {
  modal.value = 'start'
  error.value = ''
  if (!healthLoading.value) void game.checkHealth()
}

async function start(mode: PlayMode) {
  if (await game.start(mode)) {
    modal.value = null
    introStep.value = 0
    screen.value = 'intro'
  }
}

async function resume() {
  const previousPending = pendingTurn.value
  if (await game.resume()) {
    if (previousPending && !pendingTurn.value && lastPlayer.value?.text === previousPending.text) {
      input.value = ''
      selectedObservation.value = undefined
    }
    screen.value = 'game'
  }
}

function enterGame() {
  screen.value = 'game'
  introStep.value = 0
}

async function send() {
  if (!canSend.value || composing.value) return
  if (await game.send(input.value, selectedObservation.value)) {
    input.value = ''
    selectedObservation.value = undefined
    inspecting.value = null
  }
}

function onComposeKey(event: KeyboardEvent) {
  if (
    event.key === 'Enter' &&
    (event.ctrlKey || event.metaKey) &&
    !event.isComposing &&
    !composing.value &&
    event.keyCode !== 229
  ) {
    event.preventDefault()
    void send()
  }
}

function chooseObservation() {
  if (!inspecting.value || pendingTurn.value || busy.value) return
  selectedObservation.value =
    selectedObservation.value === inspecting.value ? undefined : inspecting.value
  inspecting.value = null
  textarea.value?.focus()
}

function useAuthoredLine(line: string) {
  if (busy.value || pendingTurn.value) return
  input.value = line
  textarea.value?.focus()
}

async function chooseEnding(choice: EndingChoice) {
  await game.end(choice)
}

function goHome() {
  screen.value = 'home'
  modal.value = null
  error.value = ''
}

function exportMemento() {
  if (!session.value) return
  const file = new Blob(['\ufeff', makeMemento(session.value)], {
    type: 'text/plain;charset=utf-8',
  })
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `天台十句-${session.value.ending?.title ?? '雨夜留存'}.txt`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  exportNotice.value = '这一夜已存成文字，留给以后的你。'
}

function printMemento() {
  window.print()
}

async function onJournalKeys(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  journalTab.value =
    event.key === 'Home'
      ? 'memories'
      : event.key === 'End'
        ? 'transcript'
        : journalTab.value === 'memories'
          ? 'transcript'
          : 'memories'
  await nextTick()
  document.getElementById(`${journalTab.value}-tab`)?.focus()
}
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'reduced-motion': reducedMotion,
      'large-type': preferences.textSize === 'large',
      'in-game': screen !== 'home',
      'at-ending': session?.status === 'ended' && screen === 'game',
    }"
  >
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <div class="scene-background" aria-hidden="true">
      <img :key="sceneArt" class="rooftop-art" :src="sceneArt" alt="" fetchpriority="high" />
      <div class="scene-shade" />
      <div class="rain-veil" />
      <div class="film-grain" />
    </div>

    <header class="site-header">
      <button class="wordmark" aria-label="返回天台十句首页" @click="goHome">
        <span class="frame-mark" aria-hidden="true"><span /><span /><span /><span /></span>
        <span>天台十句<span class="wordmark-edition">第二卷</span></span>
      </button>
      <div v-if="screen === 'game' && session" class="chapter-indicator">
        <span class="live-dot" />{{ phaseNames[session.phase] }}
      </div>
      <div v-else class="header-edition">AN INTERACTIVE SHORT STORY<span>VOL. 02</span></div>
      <nav class="header-actions" aria-label="作品选项">
        <button
          class="icon-button sound-toggle"
          :class="{ active: isPlaying }"
          :aria-label="isPlaying ? '关闭声音' : '开启声音'"
          :title="isPlaying ? '关闭声音' : '开启声音'"
          @click="audio.toggle"
        >
          <Volume2 v-if="isPlaying" :size="17" :stroke-width="1.4" /><VolumeX
            v-else
            :size="17"
            :stroke-width="1.4"
          />
        </button>
        <button
          class="icon-button"
          aria-label="阅读与声音设置"
          title="阅读与声音设置"
          @click="modal = 'settings'"
        >
          <SlidersHorizontal :size="17" :stroke-width="1.4" />
        </button>
      </nav>
    </header>

    <main v-if="screen === 'home'" id="main-content" class="home-main" tabindex="-1">
      <div class="home-content">
        <p class="edition-line">
          <span class="tiny-cross">+</span> 一部由你开口的互动短篇 <span class="edition-rule" />
        </p>
        <h1 class="game-title">
          <span>天台</span><span>十句<span class="title-period">。</span></span>
        </h1>
        <div class="subtitle-line">
          <span class="subtitle-stroke" />
          <p>未寄出的底片</p>
          <span class="small-number">02</span>
        </div>
        <p class="home-description">雨停之前，<br />陪一个陌生人，把话慢慢说完。</p>
        <div class="home-play-actions">
          <button class="primary-button home-start" @click="openStart">
            <span>走上天台</span><ArrowUpRight :size="19" :stroke-width="1.4" />
          </button>
          <button v-if="savedId" class="continue-button" :disabled="busy" @click="resume">
            <LoaderCircle v-if="busy" class="spin" :size="14" /><span
              v-else
              class="continue-dot"
            />接着上次的雨夜<ChevronRight :size="14" />
          </button>
        </div>
        <p v-if="error" role="alert" class="home-error">{{ error }}</p>
        <p class="play-length">约 15—25 分钟<span>·</span>自由输入<span>·</span>建议戴上耳机</p>
      </div>
      <div class="scene-caption" aria-hidden="true">
        <span class="caption-line" /><span>23:47</span
        ><span class="caption-place">某座城市的天台<br />雨还在下。</span>
      </div>
      <footer class="home-footer">
        <div class="footer-note"><span class="status-pip" />不是每一张底片，都需要被展出。</div>
        <div class="footer-links">
          <button @click="modal = 'about'">关于这场相遇 <ArrowUpRight :size="12" /></button
          ><span class="footer-divider" /><span class="build-label">TIANTAI / V2</span>
        </div>
      </footer>
    </main>

    <main v-else-if="screen === 'intro'" id="main-content" class="intro-main" tabindex="-1">
      <button class="text-button intro-skip" @click="enterGame">
        跳过序章 <ArrowRight :size="14" />
      </button>
      <Transition name="scene" mode="out-in">
        <div :key="introStep" class="intro-scene">
          <span class="intro-number">{{ introScenes[introStep]?.number }}</span>
          <p class="eyebrow">{{ introScenes[introStep]?.kicker }}</p>
          <h1>{{ introScenes[introStep]?.text }}</h1>
          <p class="intro-detail">{{ introScenes[introStep]?.detail }}</p>
          <button class="intro-next" @click="introStep < 2 ? introStep++ : enterGame()">
            <span>{{ introStep < 2 ? '再往前一点' : '在这里停一会儿' }}</span
            ><ArrowRight :size="20" :stroke-width="1" />
          </button>
        </div>
      </Transition>
      <div class="intro-progress" aria-label="序章进度">
        <span v-for="n in 3" :key="n" :class="{ filled: n <= introStep + 1 }" />
      </div>
    </main>

    <main
      v-else-if="session"
      id="main-content"
      tabindex="-1"
      class="game-main"
      :class="{ 'ending-main': session.status === 'ended' }"
    >
      <div class="game-topline">
        <button class="back-home text-button" @click="goHome">
          <ArrowLeft :size="14" />暂离天台
        </button>
        <span class="mode-label"
          ><span :class="['mode-dot', { live: session.mode === 'live' }]" />{{
            session.mode === 'live' ? 'AI 即时对话' : '剧本排演'
          }}</span
        >
        <button class="journal-button" @click="modal = 'journal'">
          <BookOpen :size="15" :stroke-width="1.4" />这一夜的留存<span>{{
            String(session.memories.length).padStart(2, '0')
          }}</span>
        </button>
      </div>

      <template v-if="session.status !== 'ended'">
        <div class="dialogue-stage">
          <div class="story-margin">
            <span
              >夜 /
              {{
                String(session.turn + (session.status === 'active' ? 1 : 0)).padStart(2, '0')
              }}</span
            ><span class="vertical-line" />
          </div>
          <Transition name="dialogue" mode="out-in">
            <section
              :key="session.revision"
              class="dialogue-content"
              aria-live="polite"
              aria-atomic="true"
            >
              <p v-if="lastPlayer" class="last-player"><span>你</span>{{ lastPlayer.text }}</p>
              <p v-if="lastNarration" class="narrator-line">{{ lastNarration.text }}</p>
              <p class="speaker-label"><span class="speaker-rule" />天台上的人</p>
              <blockquote class="character-line">
                {{ lastCharacter?.text ?? '你也睡不着？' }}
              </blockquote>
              <div class="dialogue-end" aria-hidden="true"><span /><span /><span /></div>
            </section>
          </Transition>
          <div class="scene-coordinate" aria-hidden="true">
            <span>35mm</span><span>{{ sceneTime }}</span
            ><span>雨 / 夜</span>
          </div>
        </div>

        <div v-if="session.status === 'active'" class="interaction-area">
          <div class="observation-bar">
            <span class="observation-label"><Camera :size="13" :stroke-width="1.3" />看看身边</span>
            <div class="observation-options" aria-label="观察身边的事物">
              <button
                v-for="item in observations"
                :key="item.id"
                :class="{
                  selected: selectedObservation === item.id,
                  inspected: session.observations.includes(item.id),
                }"
                :aria-pressed="selectedObservation === item.id"
                @click="inspecting = inspecting === item.id ? null : item.id"
              >
                <span class="object-mark">{{ item.mark }}</span
                >{{ item.title }}<Check v-if="selectedObservation === item.id" :size="11" /><span
                  v-else
                  class="object-plus"
                  >+</span
                >
              </button>
            </div>
          </div>
          <Transition name="detail">
            <section
              v-if="observation"
              class="observation-detail"
              :aria-label="`观察${observation.title}`"
            >
              <div>
                <span class="eyebrow">{{ observation.mark }} / {{ observation.title }}</span>
                <p>{{ observation.text }}</p>
              </div>
              <button
                class="text-button"
                :disabled="busy || Boolean(pendingTurn)"
                @click="chooseObservation"
              >
                {{
                  selectedObservation === observation.id
                    ? '先放下这个念头'
                    : '把这个细节带进下一句话'
                }}<ArrowDown :size="14" />
              </button>
              <button class="detail-close" aria-label="收起观察" @click="inspecting = null">
                ×
              </button>
            </section>
          </Transition>
          <details v-if="session.mode === 'rehearsal'" class="rehearsal-assist">
            <summary>看看剧本里的回应 <ChevronRight :size="12" /></summary>
            <p>
              这是作者写下的两种说法。点选后可以修改，按「开口」才会送出；排演对白仍按固定顺序播放。
            </p>
            <button
              v-for="line in rehearsalLines[session.turn] ?? []"
              :key="line"
              :disabled="busy || Boolean(pendingTurn)"
              @click="useAuthoredLine(line)"
            >
              {{ line }}<ArrowUpRight :size="13" />
            </button>
          </details>
          <form class="composer" @submit.prevent="send">
            <div class="composer-top">
              <label for="your-words">轮到你了<span>说一句自己的话</span></label
              ><span class="turn-label"
                >{{ String(session.turn).padStart(2, '0') }}<span>/</span>10</span
              >
            </div>
            <div v-if="selectedObject" class="selected-context">
              <span>你留意到：{{ selectedObject.title }}</span
              ><button
                :disabled="busy || Boolean(pendingTurn)"
                type="button"
                aria-label="取消观察细节"
                @click="selectedObservation = undefined"
              >
                ×
              </button>
            </div>
            <div class="compose-row">
              <textarea
                id="your-words"
                ref="textarea"
                v-model="input"
                rows="2"
                maxlength="480"
                aria-label="写下这一句"
                :readonly="busy || Boolean(pendingTurn)"
                :aria-describedby="'compose-hint compose-count'"
                :aria-invalid="chars > 120"
                :placeholder="
                  session.turn === 0 ? '雨好像还要下一会儿……' : '不急着给答案。你想对她说什么？'
                "
                @compositionstart="composing = true"
                @compositionend="composing = false"
                @keydown="onComposeKey"
              />
              <button
                type="submit"
                class="send-button"
                :disabled="!canSend"
                :aria-label="busy ? '等待回应' : pendingTurn ? '重试这句话' : '说出这句话'"
              >
                <LoaderCircle
                  v-if="busy"
                  :size="20"
                  class="spin"
                  :stroke-width="1.3"
                /><ArrowUpRight v-else :size="22" :stroke-width="1.3" /><span>{{
                  busy ? '倾听中' : pendingTurn ? '重试' : '开口'
                }}</span>
              </button>
            </div>
            <div class="composer-bottom">
              <p id="compose-hint">
                {{
                  busy
                    ? '给她一点时间。你的话已经留在这里。'
                    : pendingTurn
                      ? '原话已保留。重试会接上同一次对话，不重复计次。'
                      : 'Ctrl / ⌘ + Enter 发送'
                }}
              </p>
              <span id="compose-count" :class="{ 'over-limit': chars > 120 }"
                >{{ chars }} / 120</span
              >
            </div>
            <div
              class="turn-ticks"
              role="progressbar"
              aria-label="这一夜的十次开口"
              :aria-valuenow="session.turn"
              :aria-valuemin="0"
              :aria-valuemax="10"
              :aria-valuetext="`已说 ${session.turn} 句，共十句`"
            >
              <span
                v-for="n in 10"
                :key="n"
                :class="{ used: n <= session.turn, current: n === session.turn + 1 }"
              />
            </div>
          </form>
          <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
          <p v-if="notice" class="inline-notice" role="status">{{ notice }}</p>
          <p v-if="session.mode === 'rehearsal'" class="rehearsal-note">
            剧本排演 · 回应来自固定剧本；你的文字会被留存，但不会被 AI 解读。
          </p>
        </div>

        <section v-else class="ending-choices" aria-labelledby="choice-heading">
          <div class="choice-heading">
            <p class="eyebrow">十句话之后</p>
            <h2 id="choice-heading">这段路，想怎么走完？</h2>
            <p>没有标准答案。只是一个你愿意做出的动作。</p>
          </div>
          <button
            v-for="choice in endingChoices"
            :key="choice.id"
            :disabled="busy || (Boolean(pendingEnding) && pendingEnding?.choice !== choice.id)"
            @click="chooseEnding(choice.id)"
          >
            <span class="choice-number">{{ choice.number }}</span
            ><span class="choice-copy"
              ><strong>{{ choice.title }}</strong
              ><span>{{ choice.description }}</span></span
            ><LoaderCircle
              v-if="busy && pendingEnding?.choice === choice.id"
              class="spin"
              :size="18"
            /><ArrowUpRight v-else :size="19" :stroke-width="1.2" />
          </button>
          <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
        </section>
      </template>

      <article v-else-if="session.ending" class="memento">
        <div class="ending-kicker">
          <span class="tiny-cross">+</span> 这一夜，留下一张底片 <span class="tiny-cross">+</span>
        </div>
        <span class="ending-frame-number">翌日 06:10 / 余响</span>
        <h1>{{ session.ending.title }}</h1>
        <p class="ending-subtitle">{{ session.ending.subtitle }}</p>
        <div class="ending-prose">
          <p v-for="(paragraph, index) in session.ending.paragraphs" :key="index">
            {{ paragraph }}
          </p>
        </div>
        <div v-if="session.ending.echo" class="player-echo">
          <span class="eyebrow">你在那个雨夜说过</span>
          <blockquote>{{ session.ending.echo }}</blockquote>
          <span class="echo-rule" />
        </div>
        <div v-if="session.memories.length" class="ending-memory">
          <Camera :size="15" :stroke-width="1.2" />
          <div>
            <span>{{ session.memories[session.memories.length - 1]?.title }}</span>
            <p>{{ session.memories[session.memories.length - 1]?.text }}</p>
          </div>
        </div>
        <div class="memento-actions">
          <button class="primary-button" @click="exportMemento">
            <Download :size="15" />保存这一夜</button
          ><button class="text-button" @click="printMemento">
            印成一张留念 <ArrowUpRight :size="13" />
          </button>
        </div>
        <p v-if="exportNotice" class="export-notice" role="status">{{ exportNotice }}</p>
        <footer class="ending-footer">
          <p>人和人的相遇，<br />可以很短，也可以留下很久。</p>
          <span>天台十句 · 未寄出的底片</span>
          <div>
            <button class="text-button" @click="modal = 'journal'">重读这一夜</button><span>·</span
            ><button class="text-button" @click="goHome">回到封面</button><span>·</span
            ><button class="text-button" @click="openStart">开始另一夜</button>
          </div>
          <small
            >{{ session.mode === 'live' ? 'AI 即时对话' : '剧本排演 · 固定对白' }} / THE END</small
          >
        </footer>
      </article>
    </main>

    <SceneDialog :open="modal === 'start'" title="走进这一夜" @close="modal = null">
      <div class="start-dialog-content">
        <span class="dialog-frame-number">23:47</span>
        <h2>在开始之前，<br />留一点时间给彼此。</h2>
        <p class="dialog-body">
          这是一个关于孤独、摄影与倾听的虚构短篇，包含心理危机与轻生议题，不直接呈现伤害过程。你可以随时暂停或离开；不需要承担拯救另一个人的责任。
        </p>
        <div class="mode-explanation">
          <span class="eyebrow">十次开口 / 一次相遇</span>
          <p>观察身边的细节，用自己的话回应。<br />没有好感度，没有标准答案，也不必说得漂亮。</p>
        </div>
        <p v-if="savedId" class="replace-notice">开始新的一夜，会替换此浏览器的继续进度。</p>
        <div v-if="healthLoading" class="connection-status" role="status">
          <LoaderCircle class="spin" :size="15" />正在确认雨夜的连接……
        </div>
        <div v-else-if="healthError" class="connection-error">
          <p role="alert">{{ healthError }}</p>
          <button class="text-button" @click="game.checkHealth">
            重新连接 <ArrowRight :size="14" />
          </button>
        </div>
        <template v-else-if="health">
          <div v-if="health.aiConfigured" class="mode-ready">
            <span class="live-dot" /><span
              >AI 即时对话已配置<small>她会回应你写下的具体内容。</small></span
            >
          </div>
          <div v-else class="rehearsal-explanation">
            <span class="eyebrow">当前可体验：剧本排演</span>
            <p>
              此环境尚未接入
              AI。排演会完整呈现作者写好的故事；你的自由输入会被保存，但不会影响对白。AI
              接入后，才能开始真正的即时对话。
            </p>
          </div>
          <button
            class="primary-button dialog-primary"
            :disabled="busy"
            @click="start(health.aiConfigured ? 'live' : 'rehearsal')"
          >
            <span>{{
              busy ? '正在推开门……' : health.aiConfigured ? '进入雨夜' : '体验剧本排演'
            }}</span
            ><LoaderCircle v-if="busy" class="spin" :size="17" /><ArrowUpRight v-else :size="18" />
          </button>
          <button
            v-if="health.aiConfigured"
            class="text-button optional-rehearsal"
            :disabled="busy"
            @click="start('rehearsal')"
          >
            先读作者的剧本排演 <ArrowRight :size="12" />
          </button>
        </template>
        <p v-if="error" class="inline-error" role="alert">{{ error }}</p>
      </div>
    </SceneDialog>

    <SceneDialog :open="modal === 'settings'" title="把这一夜调到舒服的位置" @close="modal = null">
      <div class="settings-content">
        <h2>慢慢来。</h2>
        <p class="dialog-body">阅读和声音，都按你的习惯。</p>
        <fieldset class="setting-group">
          <legend>文字大小</legend>
          <div class="segmented-control">
            <button
              :aria-pressed="preferences.textSize === 'normal'"
              @click="preferences.textSize = 'normal'"
            >
              标准</button
            ><button
              :aria-pressed="preferences.textSize === 'large'"
              @click="preferences.textSize = 'large'"
            >
              大一些
            </button>
          </div>
        </fieldset>
        <fieldset class="setting-group">
          <legend>画面动效</legend>
          <div class="segmented-control">
            <button
              :aria-pressed="preferences.motion === 'system'"
              @click="preferences.motion = 'system'"
            >
              跟随系统</button
            ><button
              :aria-pressed="preferences.motion === 'reduced'"
              @click="preferences.motion = 'reduced'"
            >
              减少动态
            </button>
          </div>
        </fieldset>
        <div class="audio-setting">
          <div><AudioLines :size="17" /><span>原创雨夜声景</span></div>
          <button class="text-button" :aria-pressed="isPlaying" @click="audio.toggle">
            {{ isPlaying ? '关闭声音' : '开启声音' }}<Volume2 v-if="isPlaying" :size="14" /><VolumeX
              v-else
              :size="14"
            />
          </button>
        </div>
        <label class="range-setting"
          >远处的旋律<span>{{ Math.round(musicVolume * 100) }}%</span
          ><input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="musicVolume"
            aria-label="音乐音量"
            @input="
              audio.setMusicVolume(Number(($event.target as HTMLInputElement).value))
            " /></label
        ><label class="range-setting"
          >屋檐下的雨<span>{{ Math.round(rainVolume * 100) }}%</span
          ><input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="rainVolume"
            aria-label="雨声音量"
            @input="audio.setRainVolume(Number(($event.target as HTMLInputElement).value))"
        /></label>
        <p class="settings-note">
          {{
            soundEnabled && !isPlaying
              ? '声音偏好已保存，点击开启后才会播放。'
              : '所有设置只保存在当前浏览器。声音不会自动播放。'
          }}
        </p>
      </div>
    </SceneDialog>

    <SceneDialog :open="modal === 'about'" title="关于这场相遇" @close="modal = null"
      ><div class="about-content">
        <span class="eyebrow">TIANTAI / VOL. 02</span>
        <h2>有些话，<br />只需要有人听见。</h2>
        <p>
          《天台十句：未寄出的底片》是一部 AI
          原生的互动短篇。故事发生在一个雨夜；你和一个陌生人，在天亮之前分享十次开口的时间。
        </p>
        <p>
          在即时模式中，她会记得你说过的具体内容，身边被你注意到的小事也会进入对话。剧本排演则是一条完整、固定的作者叙事，用来体验作品的节奏与氛围。
        </p>
        <p>
          我们不为倾听打分，也不把另一个人的命运做成奖品。你可以暂停、静静读一会，也可以拒绝，留下一个不完美的告别。
        </p>
        <div class="about-credits">
          <span>原创文字 × 生成式场景美术 × 原创合成声景</span
          ><span
            >对话进度保存在服务器；浏览器仅记住此夜的编号。<br />导出的文字留念只下载到你的设备。</span
          >
        </div>
        <p class="content-care">
          若故事让你感到不适，可以随时离开，联系你信任的人。如果你正处于紧急危险中，请立即联系当地紧急服务。
        </p>
      </div></SceneDialog
    >

    <SceneDialog :open="modal === 'journal'" title="这一夜的留存" drawer @close="modal = null"
      ><div v-if="session" class="journal-content">
        <div class="journal-title">
          <span class="eyebrow">CONTACT SHEET / {{ String(session.turn).padStart(2, '0') }}</span>
          <h2>被你看见的，<br />会留下来。</h2>
        </div>
        <div class="journal-tabs" role="tablist" aria-label="留存内容" @keydown="onJournalKeys">
          <button
            id="memories-tab"
            role="tab"
            :aria-selected="journalTab === 'memories'"
            :tabindex="journalTab === 'memories' ? 0 : -1"
            aria-controls="memory-panel"
            @click="journalTab = 'memories'"
          >
            底片 <span>{{ session.memories.length }}</span></button
          ><button
            id="transcript-tab"
            role="tab"
            :aria-selected="journalTab === 'transcript'"
            :tabindex="journalTab === 'transcript' ? 0 : -1"
            aria-controls="transcript-panel"
            @click="journalTab = 'transcript'"
          >
            完整对话
          </button>
        </div>
        <div
          v-if="journalTab === 'memories'"
          id="memory-panel"
          class="memory-list"
          role="tabpanel"
          aria-labelledby="memories-tab"
        >
          <p v-if="!session.memories.length" class="journal-empty">
            底片还没有显影。<br />先听听她，也看看这场雨。
          </p>
          <article
            v-for="(memory, index) in session.memories"
            :key="memory.id"
            class="memory-entry"
          >
            <span class="memory-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div>
              <p class="memory-turn">第 {{ memory.sourceTurn }} 次开口之后</p>
              <h3>{{ memory.title }}</h3>
              <p>{{ memory.text }}</p>
            </div>
          </article>
          <p v-if="session.observations.length" class="journal-observations">
            你留意过：{{
              session.observations
                .map((id) => observations.find((item) => item.id === id)?.title ?? id)
                .join('、')
            }}
          </p>
        </div>
        <div
          v-else
          id="transcript-panel"
          class="transcript-list"
          role="tabpanel"
          aria-labelledby="transcript-tab"
        >
          <article
            v-for="message in session.messages"
            :key="message.id"
            :class="['transcript-entry', message.role]"
          >
            <span>{{
              message.role === 'player'
                ? '你'
                : message.role === 'character'
                  ? '天台上的人'
                  : '雨夜'
            }}</span>
            <p>{{ message.text }}</p>
          </article>
        </div>
        <button class="text-button journal-export" @click="exportMemento">
          <Download :size="14" />把这一夜存成文字
        </button>
        <p v-if="exportNotice" class="export-notice" role="status">{{ exportNotice }}</p>
      </div></SceneDialog
    >
  </div>
</template>
