<template>
  <div class="settings-view settings-scroll h-screen min-h-0 overflow-x-hidden overflow-y-scroll bg-[#f7f7f7] p-4 text-gray-900 sm:p-8 relative">

    <button
      type="button"
      @click="goBack"
      class="settings-frame-button settings-frame-button--floating"
      aria-label="返回上一页"
    >
      <PixelIcon name="arrow_left" class="h-4 w-4" />
      <span>返回</span>
    </button>

    <div class="settings-panel relative z-10 mx-auto w-full max-w-3xl border border-gray-400 bg-white p-5 sm:p-8">
      <header class="mb-8 flex flex-col gap-2">
        <p class="text-xs tracking-[0.18em] text-gray-600">天台十句</p>
        <h2 class="text-3xl font-bold tracking-wide text-gray-900">
          设置
        </h2>
      </header>

      <div class="space-y-9">
        <section class="space-y-5">
          <div class="flex items-end justify-between gap-4 border-b border-gray-300 pb-3">
            <div>
              <h3 class="text-xl text-[#655969]">AI 模型设置</h3>
              <p class="mt-1 text-sm text-gray-600">选择服务商后，模型名和 Base URL 可留空使用默认值。</p>
              <p class="mt-1 text-xs text-gray-600">模型预设更新于 2026-10-01，实际可用模型以账户权限为准。</p>
            </div>
            <span class="hidden rounded-full border border-[#aaa0ad] px-3 py-1 text-xs text-[#655969] sm:inline-flex">
              {{ protocolLabel }}
            </span>
          </div>

          <div class="space-y-4">
            <div v-for="group in providerGroups" :key="group.id" class="space-y-2">
              <div class="flex items-baseline justify-between gap-3">
                <h4 class="text-sm font-semibold text-gray-700">{{ group.title }}</h4>
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
                      ? 'border-[#87768d] bg-[#eee9f0] text-gray-900'
                      : 'border-gray-300 bg-gray-50 text-gray-700 hover:border-gray-500 hover:bg-white hover:text-gray-900'
                  ]"
                >
                  <span class="flex items-center justify-between gap-2">
                    <span class="font-semibold">{{ provider.name }}</span>
                    <PixelIcon v-if="llmConfig.provider === provider.id" name="check" class="h-4 w-4 text-[#655969]" />
                  </span>
                  <span class="mt-1 block text-xs opacity-70">{{ provider.vendor }}</span>
                  <span class="mt-2 inline-flex rounded border border-gray-300 px-1.5 py-0.5 text-[11px] opacity-75">
                    {{ provider.protocol === 'anthropic' ? 'Anthropic' : 'OpenAI 兼容' }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-gray-300 bg-gray-50 p-4">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <PixelIcon name="key" class="h-4 w-4 text-[#655969]" />
                  API Key
                </label>
                <div class="relative">
                  <input
                    :type="showKey ? 'text' : 'password'"
                    v-model="llmConfig.apiKey"
                    @input="saveLLMCfg"
                    :placeholder="currentProvider.keyPlaceholder"
                    class="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 pr-12 text-gray-900 outline-none transition-colors focus:border-[#87768d]"
                  />
                  <button
                    type="button"
                    @click="showKey = !showKey"
                    class="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-600 transition-colors hover:text-gray-200"
                    :aria-label="showKey ? '隐藏 API Key' : '显示 API Key'"
                  >
                    <PixelIcon :name="showKey ? 'eye_off' : 'eye'" class="h-4 w-4" />
                  </button>
                </div>
                <p class="text-xs leading-relaxed text-gray-600">
                  {{ currentProvider.hint }} API Key 保存在本地浏览器，请求时会发送到后端用于调用对应服务商。
                </p>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div class="flex flex-col gap-2">
                  <label class="flex items-center justify-between gap-2 text-sm font-semibold text-gray-700">
                    <span class="flex items-center gap-2">
                      <PixelIcon name="server" class="h-4 w-4 text-[#655969]" />
                      模型名
                    </span>
                    <button type="button" class="text-xs text-gray-600 hover:text-[#655969]" @click="llmConfig.model = ''; saveLLMCfg()">
                      使用默认
                    </button>
                  </label>
                  <input
                    type="text"
                    v-model="llmConfig.model"
                    @input="saveLLMCfg"
                    :list="modelDatalistId"
                    :placeholder="currentProvider.defaultModel || '填写模型名'"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition-colors focus:border-[#87768d]"
                  />
                  <datalist :id="modelDatalistId">
                    <option v-for="model in currentProvider.models" :key="model" :value="model" />
                  </datalist>
                  <p class="text-xs text-gray-600">当前将使用：{{ effectiveModel }}</p>
                </div>

                <div class="flex flex-col gap-2">
                  <label class="flex items-center justify-between gap-2 text-sm font-semibold text-gray-700">
                    <span class="flex items-center gap-2">
                      <PixelIcon name="link" class="h-4 w-4 text-[#655969]" />
                      Base URL
                    </span>
                    <button type="button" class="text-xs text-gray-600 hover:text-[#655969]" @click="llmConfig.baseUrl = ''; saveLLMCfg()">
                      使用默认
                    </button>
                  </label>
                  <input
                    type="text"
                    v-model="llmConfig.baseUrl"
                    @input="saveLLMCfg"
                    :placeholder="currentProvider.defaultBaseUrl || 'https://your-api.example/v1'"
                    class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-sm text-gray-900 outline-none transition-colors focus:border-[#87768d]"
                  />
                  <p class="truncate text-xs text-gray-600">当前将使用：{{ effectiveBaseUrl }}</p>
                </div>
              </div>

              <div class="flex flex-col gap-3 border-t border-gray-300 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="text-xs leading-relaxed text-gray-600">
                  <p>密钥入口：{{ currentProvider.credentialUrl || '由你的中转服务提供' }}</p>
                  <p v-if="currentProvider.id === 'custom'">自定义服务需兼容 OpenAI Chat Completions 响应结构。</p>
                </div>
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    @click="testConnection"
                    :disabled="!canTestConnection"
                    class="settings-frame-button settings-frame-button--test"
                  >
                    <PixelIcon v-if="isTesting" name="spinner" class="h-4 w-4 animate-spin" />
                    <PixelIcon v-else name="plug" class="h-4 w-4" />
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
          <h3 class="border-b border-gray-300 pb-2 text-xl text-gray-700">音频</h3>

          <div class="flex items-center justify-between gap-6">
            <label class="text-gray-700">主音量</label>
            <input type="range" min="0" max="1" step="0.1" v-model.number="settings.bgmVolume" @change="updateSettings" class="w-1/2">
          </div>

          <div class="flex items-center justify-between gap-6">
            <label class="text-gray-700">音效音量</label>
            <input type="range" min="0" max="1" step="0.1" v-model.number="settings.sfxVolume" @change="updateSettings" class="w-1/2">
          </div>
        </section>

        <section class="space-y-4">
          <h3 class="border-b border-gray-300 pb-2 text-xl text-gray-700">显示</h3>

          <div class="flex items-center justify-between gap-6">
            <label class="text-gray-700">字体大小 ({{ settings.fontSize }}px)</label>
            <input type="range" min="14" max="24" step="1" v-model.number="settings.fontSize" @change="updateSettings" class="w-1/2">
          </div>

          <div class="flex items-center justify-between gap-6">
            <label class="text-gray-700">行高 ({{ settings.lineHeight }})</label>
            <input type="range" min="1.2" max="2.0" step="0.1" v-model.number="settings.lineHeight" @change="updateSettings" class="w-1/2">
          </div>

          <label class="flex items-center justify-between gap-6 text-gray-700">
            <span>屏幕阅读器友好模式</span>
            <input type="checkbox" v-model="settings.isScreenReaderMode" @change="updateSettings" class="h-5 w-5">
          </label>
        </section>
      </div>

      <div class="mt-10 flex justify-end">
        <button
          type="button"
          @click="goBack"
          class="settings-frame-button settings-frame-button--footer"
        >
          <PixelIcon name="arrow_left" class="h-4 w-4" />
          返回
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PixelIcon from '@/components/PixelIcon.vue'
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
  } catch {
    testResult.value = { ok: false, msg: '连接失败，请检查后端或网络' }
  } finally {
    isTesting.value = false
  }
}

const updateSettings = () => {
  settings.applyTheme()
  audioManager.updateVolumes()
}

const goBack = () => {
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

.settings-frame-button {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid rgba(135, 154, 176, 0.42);
  border-radius: 4px;
  background:
    linear-gradient(180deg, rgba(18, 22, 30, 0.82), rgba(8, 10, 14, 0.72));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.055),
    inset 0 -1px 0 rgba(0, 0, 0, 0.58),
    0 8px 22px rgba(0, 0, 0, 0.24);
  color: rgba(239, 244, 248, 0.92);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  padding: 0 15px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.86);
  transition:
    border-color 160ms ease,
    background 160ms ease,
    box-shadow 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.settings-frame-button:hover:not(:disabled),
.settings-frame-button:focus-visible:not(:disabled) {
  border-color: rgba(171, 188, 207, 0.62);
  background:
    linear-gradient(180deg, rgba(24, 29, 38, 0.9), rgba(10, 12, 17, 0.8));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.075),
    inset 0 -1px 0 rgba(0, 0, 0, 0.62),
    0 0 0 1px rgba(255, 255, 255, 0.025),
    0 9px 22px rgba(0, 0, 0, 0.28);
  color: rgba(255, 255, 255, 0.96);
}

.settings-frame-button:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow:
    inset 0 1px 0 rgba(0, 0, 0, 0.52),
    0 4px 12px rgba(0, 0, 0, 0.24);
}

.settings-frame-button:disabled {
  cursor: not-allowed;
  border-color: rgba(94, 108, 126, 0.36);
  background:
    linear-gradient(180deg, rgba(17, 20, 26, 0.56), rgba(7, 8, 12, 0.5));
  color: rgba(135, 146, 160, 0.62);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.025),
    inset 0 -1px 0 rgba(0, 0, 0, 0.4);
}

.settings-frame-button--floating {
  position: fixed;
  left: 16px;
  top: 16px;
  z-index: 30;
  backdrop-filter: blur(8px);
}

.settings-frame-button--test {
  flex: 0 0 auto;
  padding-inline: 16px;
}

.settings-frame-button--footer {
  min-width: 82px;
  padding-inline: 22px;
}

.settings-scroll { scrollbar-color: #8e8492 #eeeeee; }
.settings-scroll::-webkit-scrollbar-track { background: #eeeeee; }
.settings-scroll::-webkit-scrollbar-thumb { background: #8e8492; border-color: #eeeeee; }
.settings-scroll::-webkit-scrollbar-thumb:hover { background: #6f6275; }
.settings-frame-button {
  border: 1px solid #77717d;
  border-radius: 0;
  background: #fff;
  box-shadow: 3px 3px 0 #d6d2d9;
  color: #29262d;
  text-shadow: none;
}
.settings-frame-button:hover:not(:disabled),
.settings-frame-button:focus-visible:not(:disabled) {
  border-color: #75657d;
  background: #efecf0;
  box-shadow: 3px 3px 0 #c6bccb;
  color: #29262d;
}
.settings-frame-button:disabled {
  border-color: #d1cdd2;
  background: #f1f1f1;
  color: #8a858c;
  box-shadow: none;
}
@media (max-width: 639px) {
  .settings-panel { margin-top: 54px; }
}

@media (min-width: 640px) {
  .settings-frame-button--floating {
    left: 24px;
    top: 24px;
  }
}
</style>
