<template>
  <div class="settings-view min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black p-8 relative overflow-hidden">
    <!-- Subtle Background Element -->
    <div class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-pink-900/10 rounded-full blur-[120px] pointer-events-none"></div>
    
    <div class="max-w-2xl mx-auto bg-gray-900/70 p-8 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-gray-700/50 backdrop-blur-xl relative z-10">
      <h2 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-8 tracking-wide">设置 (Settings)</h2>
      
      <div class="space-y-8">

        <!-- AI 模型设置 -->
        <div class="space-y-5">
          <h3 class="text-xl border-b border-gray-700 pb-2 text-purple-300">AI 模型设置</h3>

          <!-- Provider 选择 -->
          <div class="flex flex-col gap-2">
            <label class="text-gray-300 font-medium">AI 服务商</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="p in providers"
                :key="p.id"
                @click="selectProvider(p.id)"
                :class="[
                  'py-2 px-3 rounded border text-sm transition-all',
                  llmConfig.provider === p.id
                    ? 'bg-purple-700 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                    : 'bg-gray-900 border-gray-600 text-gray-400 hover:border-gray-400 hover:text-gray-200'
                ]"
              >
                <div class="font-medium">{{ p.name }}</div>
                <div class="text-xs opacity-60 mt-0.5">{{ p.label }}</div>
              </button>
            </div>
          </div>

          <!-- API Key 输入 -->
          <div class="flex flex-col gap-2">
            <label class="text-gray-300 font-medium">API Key</label>
            <div class="relative">
              <input
                :type="showKey ? 'text' : 'password'"
                v-model="llmConfig.apiKey"
                @input="saveLLMCfg"
                :placeholder="currentProvider?.keyPlaceholder || 'sk-xxxxxxxxxxxxxxxx'"
                class="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-gray-100 focus:border-purple-500 outline-none pr-10 transition-colors"
              />
              <button
                @click="showKey = !showKey"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs"
              >
                {{ showKey ? '隐藏' : '显示' }}
              </button>
            </div>
            <p class="text-xs text-gray-500">
              {{ currentProvider?.hint || '' }} API Key 仅保存在本地浏览器，不会上传到任意第三方服务器。
            </p>
          </div>

          <!-- 高级设置（折叠） -->
          <div class="border border-gray-700 rounded-lg overflow-hidden">
            <button
              @click="showAdvanced = !showAdvanced"
              class="w-full flex items-center justify-between px-4 py-3 text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors text-sm"
            >
              <span>高级设置（自定义模型/中转地址）</span>
              <span class="text-lg leading-none">{{ showAdvanced ? '▲' : '▼' }}</span>
            </button>

            <div v-if="showAdvanced" class="px-4 pb-4 pt-1 space-y-4 bg-gray-900/30">
              <div class="flex flex-col gap-2">
                <label class="text-gray-400 text-sm font-medium">模型名称 <span class="text-gray-600">（留空使用默认）</span></label>
                <input
                  type="text"
                  v-model="llmConfig.model"
                  @input="saveLLMCfg"
                  :placeholder="currentProvider?.defaultModel || ''"
                  class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-100 text-sm focus:border-purple-500 outline-none transition-colors"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-gray-400 text-sm font-medium">Base URL <span class="text-gray-600">（可用于 API 中转，留空使用官方地址）</span></label>
                <input
                  type="text"
                  v-model="llmConfig.baseUrl"
                  @input="saveLLMCfg"
                  :placeholder="currentProvider?.defaultBaseUrl || ''"
                  class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-300 text-sm focus:border-purple-500 outline-none font-mono transition-colors"
                />
              </div>
            </div>
          </div>

          <!-- 连接测试 -->
          <div class="flex items-center gap-3">
            <button
              @click="testConnection"
              :disabled="!llmConfig.apiKey || isTesting"
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm border border-gray-600 transition-colors"
            >
              {{ isTesting ? '测试中…' : '🔗 测试连接' }}
            </button>
            <span v-if="testResult" :class="testResult.ok ? 'text-green-400' : 'text-red-400'" class="text-sm">
              {{ testResult.msg }}
            </span>
          </div>
        </div>

        <!-- 音频 -->
        <div class="space-y-4">
          <h3 class="text-xl border-b border-gray-700 pb-2 text-gray-300">音频</h3>
          
          <div class="flex items-center justify-between">
            <label class="text-gray-300">主音量</label>
            <input type="range" min="0" max="1" step="0.1" v-model.number="settings.bgmVolume" @change="updateSettings" class="w-1/2">
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-gray-300">音效音量</label>
            <input type="range" min="0" max="1" step="0.1" v-model.number="settings.sfxVolume" @change="updateSettings" class="w-1/2">
          </div>
          

        </div>

        <!-- 显示 -->
        <div class="space-y-4">
          <h3 class="text-xl border-b border-gray-700 pb-2 text-gray-300">显示</h3>
          
          <div class="flex items-center justify-between">
            <label class="text-gray-300">字体大小 ({{ settings.fontSize }}px)</label>
            <input type="range" min="14" max="24" step="1" v-model.number="settings.fontSize" @change="updateSettings" class="w-1/2">
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-gray-300">行高 ({{ settings.lineHeight }})</label>
            <input type="range" min="1.2" max="2.0" step="0.1" v-model.number="settings.lineHeight" @change="updateSettings" class="w-1/2">
          </div>
          
          <div class="flex items-center justify-between">
            <label class="text-gray-300">屏幕阅读器友好模式</label>
            <input type="checkbox" v-model="settings.isScreenReaderMode" @change="updateSettings" class="w-5 h-5">
          </div>
        </div>
      </div>
      
      <div class="mt-10 flex justify-end">
        <button @click="goBack" class="py-2.5 px-8 bg-gradient-to-r from-gray-700 to-gray-600 hover:from-gray-600 hover:to-gray-500 rounded-xl transition-all duration-300 shadow-lg text-white font-medium hover:-translate-y-0.5">返回</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { GAME_RULES } from '@/domain/gameContract'
import { useSettingsStore } from '@/store/settingsStore'
import { audioManager } from '@/modules/AudioManager'
import { loadLLMConfig, saveLLMConfig, type LLMConfig } from '@/modules/LLMService'

const router = useRouter()
const settings = useSettingsStore()

// ---- LLM 配置 ----

const providers = [
  {
    id: 'qwen',
    name: '千问',
    label: '阿里云',
    defaultModel: 'qwen-plus',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    hint: '前往 dashscope.aliyuncs.com 获取 API Key。'
  },
  {
    id: 'doubao',
    name: '豆包',
    label: '字节跳动',
    defaultModel: 'doubao-pro-4k',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    keyPlaceholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    hint: '前往火山引擎方舟控制台获取 API Key。'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    label: 'GPT 系列',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
    keyPlaceholder: 'sk-xxxxxxxxxxxxxxxx',
    hint: '前往 platform.openai.com 获取 API Key。'
  }
]

const llmConfig = ref<LLMConfig>({ provider: 'qwen', apiKey: '', model: '', baseUrl: '' })
const showKey = ref(false)
const showAdvanced = ref(false)
const isTesting = ref(false)
const testResult = ref<{ ok: boolean; msg: string } | null>(null)

const currentProvider = computed(() => providers.find(p => p.id === llmConfig.value.provider))

onMounted(() => {
  llmConfig.value = loadLLMConfig()
})

const selectProvider = (id: string) => {
  llmConfig.value.provider = id
  saveLLMCfg()
}

const saveLLMCfg = () => {
  saveLLMConfig(llmConfig.value)
  testResult.value = null
}

const testConnection = async () => {
  if (!llmConfig.value.apiKey || isTesting.value) return
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
        user_message: '你好',
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

    // 优先检查 error 字段，这是后端明确返回的错误
    if (data.error) {
      testResult.value = { ok: false, msg: `⚠ ${data.error}` }
    } else if (data.reply && !data.reply.includes('模拟回复')) {
      testResult.value = { ok: true, msg: '✓ 连接成功！AI 响应正常' }
    } else {
      testResult.value = { ok: false, msg: '⚠ 请检查 API Key 是否正确' }
    }
  } catch (e) {
    testResult.value = { ok: false, msg: '✗ 连接失败，请检查后端服务或网络' }
  } finally {
    isTesting.value = false
  }
}

// ---- 其他设置 ----

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
