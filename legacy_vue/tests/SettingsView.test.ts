import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveLLMConfig } from '../src/modules/LLMService'
import SettingsView from '../src/views/SettingsView.vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ back: vi.fn() })
}))

vi.mock('../src/modules/AudioManager', () => ({
  audioManager: {
    playSfx: vi.fn(),
    updateVolumes: vi.fn()
  }
}))

const mockFetch = vi.fn()

enableAutoUnmount(afterEach)

const runConnectionTest = async () => {
  const wrapper = mount(SettingsView)
  await flushPromises()
  const button = wrapper.findAll('button').find((item) => item.text() === '测试连接')
  if (!button) throw new Error('Connection test button is missing')
  await button.trigger('click')
  await flushPromises()
  expect(button.attributes('disabled')).toBeUndefined()
  return wrapper
}

describe('SettingsView connection test', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
    saveLLMConfig({
      provider: 'deepseek',
      apiKey: 'test-key',
      model: 'deepseek-flash',
      baseUrl: 'https://api.deepseek.com'
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the saved configuration and reports a real reply as successful', async () => {
    mockFetch.mockResolvedValue(Response.json({ reply: '连接测试回复' }))

    const wrapper = await runConnectionTest()

    expect(wrapper.get('[role="status"]').text()).toBe('连接成功')
    expect(mockFetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST'
    }))
    const request = mockFetch.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(request.body as string)).toMatchObject({
      provider: 'deepseek',
      api_key: 'test-key',
      model: 'deepseek-flash',
      base_url: 'https://api.deepseek.com'
    })
  })

  it.each([
    [404, '未找到后端 API，请检查本地代理或后端地址'],
    [502, '后端暂时不可用，请确认服务已启动'],
    [503, '后端暂时不可用，请确认服务已启动'],
    [504, '后端暂时不可用，请确认服务已启动'],
    [500, '后端请求失败']
  ])('explains HTTP %s instead of blaming the API key', async (status, message) => {
    mockFetch.mockResolvedValue(new Response('', { status }))

    const wrapper = await runConnectionTest()

    expect(wrapper.get('[role="status"]').text()).toBe(`${message}（HTTP ${status}）`)
  })

  it('identifies an HTML fallback page instead of treating it as API data', async () => {
    mockFetch.mockResolvedValue(new Response('<html></html>', {
      headers: { 'Content-Type': 'text/html' }
    }))

    const wrapper = await runConnectionTest()

    expect(wrapper.get('[role="status"]').text()).toBe(
      '返回的不是 API 数据，请检查本地代理或后端地址'
    )
  })

  it('preserves the provider error even when a fallback reply is present', async () => {
    mockFetch.mockResolvedValue(Response.json({
      error: '服务商鉴权失败（HTTP 401）',
      reply: '本地备用回复'
    }))

    const wrapper = await runConnectionTest()

    expect(wrapper.get('[role="status"]').text()).toBe('失败：服务商鉴权失败（HTTP 401）')
  })

  it('does not report demo mode as a successful provider connection', async () => {
    mockFetch.mockResolvedValue(Response.json({ reply: '模拟回复：你好' }))

    const wrapper = await runConnectionTest()

    expect(wrapper.get('[role="status"]').text()).toBe('请检查 API Key 或服务商配置')
  })

  it('explains a network failure and allows another attempt', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    const wrapper = await runConnectionTest()

    expect(wrapper.get('[role="status"]').text()).toBe(
      '无法连接后端，请确认服务已启动并检查网络'
    )
  })
})
