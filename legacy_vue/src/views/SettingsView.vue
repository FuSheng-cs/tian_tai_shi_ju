<template>
  <div class="settings-view settings-scroll h-screen min-h-0 overflow-x-hidden overflow-y-scroll bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black p-4 text-gray-100 sm:p-8 relative">
    <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pink-900/10 rounded-full blur-[120px] pointer-events-none"></div>

    <button
      type="button"
      @click="goBack"
      class="fixed left-4 top-4 z-30 inline-flex items-center gap-2 rounded-lg border border-gray-700/70 bg-gray-950/78 px-3 py-2 text-sm font-medium text-gray-200 shadow-lg backdrop-blur-md transition-colors hover:border-purple-400/60 hover:bg-gray-900 hover:text-white sm:left-6 sm:top-6"
      aria-label="返回上一页"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      <span>返回</span>
    </button>

    <div class="relative z-10 mx-auto w-full max-w-3xl rounded-2xl border border-gray-700/50 bg-gray-950/72 p-5 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-8">
      <header class="mb-8 flex flex-col gap-2">
        <p class="text-xs uppercase tracking-[0.28em] text-purple-300/70">System Config</p>
        <h2 class="text-3xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-300">
          设置
        </h2>
      </header>

      <div class="space-y-9">
        <section class="space-y-5">
          <div class="flex items-end justify-between gap-4 border-b border-gray-700 pb-3">
            <div>
              <h3 class="text-xl text-purple-200">AI 模型设置</h3>
              <p class="mt-1 text-sm text-gray-500">选择服务商后，模型名和 Base URL 可留空使用默认值。</p>
            </div>
            <span class="hidden rounded-full border border-purple-400/30 px-3 py-1 text-xs text-purple-200 sm:inline-flex">
              {{ protocolLabel }}
            </span>
          </div>

          <div class="space-y-4">
            <div v-for="group in providerGroups" :key="group.id" class="space-y-2">
              <div class="flex items-baseline justify-between gap-3">
                <h4 class="text-sm font-semibold text-gray-300">{{ group.title }}</h4>
                <span class="text-xs text-gray-600">{{ group.description }}</span>
              </div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <button
                  v-for="provider in group.items"
                  :key="provider.id"
                  type="button"
                  @click="selectProvider(provider.id)"
                  :class="[
                    'provider-option min-h-[78px] rounded-lg border px-3 py-3 text-left transition-all',
                    llmConfig.provider === provider.id
                      ? 'border-purple-400 bg-purple-700/70 text-white shadow-[0_0_18px_rgba(168,85,247,0.32)]'
                      : 'border-gray-700 bg-gray-900/72 text-gray-400 hover:border-gray-500 hover:bg-gray-900 hover:text-gray-100'
                  ]"
                >
                  <span class="flex items-center justify-between gap-2">
                    <span class="font-semibold">{{ provider.name }}</span>
                    <CheckCircle2 v-if="llmConfig.provider === provider.id" class="h-4 w-4 text-purple-100" aria-hidden="true" />
                  </span>
                  <span class="mt-1 block text-xs opacity-70">{{ provider.vendor }}</span>
                  <span class="mt-2 inline-flex rounded border border-white/10 px-1.5 py-0.5 text-[11px] opacity-75">
                    {{ provider.protocol === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容' }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-700/70 bg-black/18 p-4">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-sm font-semibold text-gray-300">
                  <KeyRound class="h-4 w-4 text-purple-300" aria-hidden="true" />
                  API Key
                </label>
                <div class="relative">
                  <input
                    :type="showKey ? 'text' : 'password'"
                    v-model="llmConfig.apiKey"
                    @input="saveLLMCfg"
                    :placeholder="currentProvider.keyPlaceholder"
                    class="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 pr-12 text-gray-100 outline-none transition-colors focus:border-purple-500"
                  />
                  <button
                    type="button"
                    @click="showKey = !showKey"
                    class="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 transition-colors hover:text-gray-200"
                    :aria-label="showKey ? '隐藏 API Key' : '显示 API Key'"
                  >
                    <EyeOff v-if="showKey" class="h-4 w-4" aria-hidden="true" />
                    <Eye v-else class="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <p class="text-xs leading-relaxed text-gray-500">
                  {{ currentProvider.hint }} API Key 只保存在本地浏览器；测试连接时会发送到后端用于调用对应服务商。
                </p>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="flex flex-col gap-2">
                  <label class="flex items-center justify-between gap-2 text-sm font-semibold text-gray-300">
                    <span class="flex items-center gap-2">
                      <Server class="h-4 w-4 text-purple-300" aria-hidden="true" />
                      模型名
                    </span>
                    <button type="button" class="text-xs text-gray-500 hover:text-purple-200" @click="llmConfig.model = ''; saveLLMCfg()">
                      使用默认
                    </button>
                  </label>
                  <input
                    type="text"
                    v-model="llmConfig.model"
                    @input="saveLLMCfg"
                    :list="modelDatalistId"
                    :placeholder="currentProvider.defaultModel || '填写模型名'"
                    class="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm text-gray-100 outline-none transition-colors focus:border-purple-500"
                  />
                  <datalist :id="modelDatalistId">
                    <option v-for="model in currentProvider.models" :key="model" :value="model" />
                  </datalist>
                  <p class="text-xs text-gray-600">当前将使用：{{ effectiveModel }}</p>
                </div>

                <div class="flex flex-col gap-2">
                  <label class="flex items-center justify-between gap-2 text-sm font-semibold text-gray-300">
                    <span class="flex items-center gap-2">
                      <Link2 class="h-4 w-4 text-purple-300" aria-hidden="true" />
                      Base URL
                    </span>
                    <button type="button" class="text-xs text-gray-500 hover:text-purple-200" @click="llmConfig.baseUrl = ''; saveLLMCfg()">
                      使用默认
                    </button>
                  </label>
                  <input
                    type="text"
                    v-model="llmConfig.baseUrl"
                    @input="saveLLMCfg"
                    :placeholder="currentProvider.defaultBaseUrl || 'https://your-api.example/v1'"
                    class="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 font-mono text-sm text-gray-100 outline-none transition-colors focus:border-purple-500"
                  />
                  <p class="truncate text-xs text-gray-600">当前将使用：{{ effectiveBaseUrl }}</p>
                </div>
              </div>

              <div class="flex flex-col gap-3 border-t border-gray-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="text-xs leading-relaxed text-gray-500">
                  <p>密钥入口：{{ currentProvider.credentialUrl || '由你的中转服务提供' }}</p>
                  <p v-if="currentProvider.id === 'custom'">自定义服务需兼容 OpenAI Chat Completions 响应结构。</p>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    @click="testConnection"
                    :disabled="!canTestConnection"
                    class="inline-flex items-center gap-2 rounded-lg border border-purple-500/40 bg-purple-700/70 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-600 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-500"
                  >
                    <Loader2 v-if="isTesting" class="h-4 w-4 animate-spin" aria-hidden="true" />
                    <PlugZap v-else class="h-4 w-4" aria-hidden="true" />
                    {{ isTesting ? '测试中' : '测试连接' }}
                  </button>
                  <span v-if="testResult" :class="testResult.ok ? 'text-green-400' : 'text-red-400'" class="text-sm">
                    {{ testResult.msg }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="border-b border-gray-700 pb-2 text-xl text-gray-300">音频</h3>

          <div class="flex items-center justify-between gap-6">
            <label class="text-gray-300">主音量</label>
            <input type="range" min="0" max="1" step="0.1" v-model.number="settings.bgmVolume" @change="updateSettings" class="w-1/2">
          </div>

          <div class="flex items-center justify-between gap-6">
            <label class="text-gray-300">音效音量</label>
            <input type="range" min="0" max="1" step="0.1" v-model.number="settings.sfxVolume" @change="updateSettings" class="w-1/2">
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="border-b border-gray-700 pb-2 text-xl text-gray-300">显示</h3>

          <div class="flex items-center justify-between gap-6">
            <label class="text-gray-300">字体大小 ({{ settings.fontSize }}px)</label>
            <input type="range" min="14" max="24" step="1" v-model.number="settings.fontSize" @change="updateSettings" class="w-1/2">
          </div>

          <div class="flex items-center justify-between gap-6">
            <label class="text-gray-300">行高 ({{ settings.lineHeight }})</label>
            <input type="range" min="1.2" max="2.0" step="0.1" v-model.number="settings.lineHeight" @change="updateSettings" class="w-1/2">
          </div>

          <label class="flex items-center justify-between gap-6 text-gray-300">
            <span>屏幕阅读器友好模式</span>
            <input type="checkbox" v-model="settings.isScreenReaderMode" @change="updateSettings" class="h-5 w-5">
          </label>
        </section>
      </div>

      <div class="mt-10 flex justify-end">
        <button
          type="button"
          @click="goBack"
          class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-gray-700 to-gray-600 px-7 py-2.5 font-medium text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:from-gray-600 hover:to-gray-500"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          返回
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  PlugZap,
  Server
} from 'lucide-vue-next'
import { GAME_RULES } from '@/domain/gameContract'
import { useSettingsStore } from '@/store/settingsStore'
import { audioManager } from '@/modules/AudioManager'
import {
  LLM_PROVIDERS,
  getLLMProvider,
  loadLLMConfig,
  saveLLMConfig,
  type LLMConfig,
  type LLMProviderId,
  type LLMProviderOption
} from '@/modules/LLMService'

const router = useRouter()
const settings = useSettingsStore()

const llmConfig = ref<LLMConfig>({ provider: 'qwen', apiKey: '', model: '', baseUrl: '' })
const showKey = ref(false)
const isTesting = ref(false)
const testResult = ref<{ ok: boolean; msg: string } | null>(null)
const modelDatalistId = 'llm-model-suggestions'

const providerGroups = computed(() => [
  {
    id: 'domestic',
    title: '国产模型',
    description: '中文叙事优先',
    items: LLM_PROVIDERS.filter((provider) => provider.region === 'domestic')
  },
  {
    id: 'global',
    title: 'GPT / Claude',
    description: '海外主流 API',
    items: LLM_PROVIDERS.filter((provider) => provider.region === 'global')
  },
  {
    id: 'custom',
    title: '自定义',
    description: '中转或兼容服务',
    items: LLM_PROVIDERS.filter((provider) => provider.region === 'custom')
  }
])

const currentProvider = computed<LLMProviderOption>(() => getLLMProvider(llmConfig.value.provider))
const effectiveModel = computed(() => llmConfig.value.model.trim() || currentProvider.value.defaultModel || '未设置')
const effectiveBaseUrl = computed(() => llmConfig.value.baseUrl.trim() || currentProvider.value.defaultBaseUrl || '未设置')
const protocolLabel = computed(() =>
  currentProvider.value.protocol === 'anthropic' ? 'Anthropic Messages API' : 'OpenAI Compatible API'
)
const requiresCustomFields = computed(() => currentProvider.value.id === 'custom')
const canTestConnection = computed(() =>
  Boolean(llmConfig.value.apiKey) &&
  !isTesting.value &&
  (!requiresCustomFields.value || Boolean(llmConfig.value.model.trim() && llmConfig.value.baseUrl.trim()))
)

onMounted(() => {
  llmConfig.value = loadLLMConfig()
})

const selectProvider = (id: LLMProviderId) => {
  const previousProvider = currentProvider.value
  const nextProvider = getLLMProvider(id)
  const modelWasDefault = !llmConfig.value.model || llmConfig.value.model === previousProvider.defaultModel
  const baseUrlWasDefault = !llmConfig.value.baseUrl || llmConfig.value.baseUrl === previousProvider.defaultBaseUrl

  llmConfig.value.provider = nextProvider.id
  if (modelWasDefault) llmConfig.value.model = ''
  if (baseUrlWasDefault) llmConfig.value.baseUrl = ''
  saveLLMCfg()
}

const saveLLMCfg = () => {
  saveLLMConfig(llmConfig.value)
  testResult.value = null
}

const testConnection = async () => {
  if (!canTestConnection.value) return
  isTesting.value = true
  testResult.value = null
  audioManager.playSfx('click')

  try {
    const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
    const res = await fetch(`${backendUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history: [],
        user_message: '连接测试',
        rounds_left: GAME_RULES.initialRoundCount,
        affection: 0,
        affection_boost_count: 0,
        turns_used: 1,
        provider: llmConfig.value.provider,
        api_key: llmConfig.value.apiKey,
        model: llmConfig.value.model,
        base_url: llmConfig.value.baseUrl
      })
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    if (data.error) {
      testResult.value = { ok: false, msg: `失败：${data.error}` }
    } else if (data.reply && !data.reply.includes('模拟回复')) {
      testResult.value = { ok: true, msg: '连接成功' }
    } else {
      testResult.value = { ok: false, msg: '请检查 API Key 或服务商配置' }
    }
  } catch (e) {
    testResult.value = { ok: false, msg: '连接失败，请检查后端或网络' }
  } finally {
    isTesting.value = false
  }
}

const updateSettings = () => {
  audioManager.playSfx('click')
  settings.applyTheme()
  audioManager.updateVolumes()
}

const goBack = () => {
  audioManager.playSfx('click')
  router.back()
}
</script>

<style scoped>
.settings-scroll {
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(168, 85, 247, 0.5) rgba(15, 23, 42, 0.35);
}

.settings-scroll::-webkit-scrollbar {
  width: 10px;
}

.settings-scroll::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.35);
}

.settings-scroll::-webkit-scrollbar-thumb {
  background: rgba(168, 85, 247, 0.5);
  border: 2px solid rgba(15, 23, 42, 0.35);
  border-radius: 999px;
}

.settings-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(196, 181, 253, 0.72);
}

.provider-option {
  letter-spacing: 0;
}
</style>
