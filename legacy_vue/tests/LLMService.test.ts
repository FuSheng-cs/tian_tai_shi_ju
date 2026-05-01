import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_STATES, ENDINGS } from '../src/domain/gameContract'
import type { Message } from '../src/domain/gameState'
import { LLMService, saveLLMConfig } from '../src/modules/LLMService'

const mockFetch = vi.fn()

const mockBackendResponse = (body: unknown) => {
  mockFetch.mockResolvedValue({
    json: async () => body
  } as Response)
}

const getLastRequestBody = () => {
  const init = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]?.[1] as RequestInit
  return JSON.parse(init.body as string)
}

describe('LLMService', () => {
  const history: Message[] = [
    { role: 'assistant', content: '夜风很冷。' },
    { role: 'user', content: '我可以坐一会儿吗？' }
  ]

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
    saveLLMConfig({
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-test',
      baseUrl: 'https://llm.example/v1'
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('assembles the main chat request with state context and player LLM config', async () => {
    mockBackendResponse({ reply: '她看了你一眼。' })

    const reply = await LLMService.chat('你还好吗？', history, {
      roundsLeft: 8,
      affection: 5,
      affectionBoostCount: 1,
      turnsUsed: 3,
      aiState: AI_STATES.watching.type
    })

    expect(reply).toBe('她看了你一眼。')
    expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/chat$/), expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }))
    expect(getLastRequestBody()).toEqual({
      history,
      user_message: '你还好吗？',
      rounds_left: 8,
      affection: 5,
      affection_boost_count: 1,
      turns_used: 3,
      ai_state: AI_STATES.watching.type,
      provider: 'openai',
      api_key: 'test-key',
      model: 'gpt-test',
      base_url: 'https://llm.example/v1'
    })
  })

  it('assembles the ending summary request and maps snake_case response fields', async () => {
    mockBackendResponse({
      turning_line: '我可以坐一会儿吗？',
      comment: '她在这一句里停了下来。'
    })

    const summary = await LLMService.getEndingSummary(history, {
      endingType: ENDINGS.acquaintance.type,
      roundsUsed: 2,
      affectionBoostCount: 1
    })

    expect(summary).toEqual({
      turningLine: '我可以坐一会儿吗？',
      comment: '她在这一句里停了下来。'
    })
    expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/ending-summary$/), expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }))
    expect(getLastRequestBody()).toEqual({
      history,
      ending_type: ENDINGS.acquaintance.type,
      rounds_used: 2,
      affection_boost_count: 1,
      provider: 'openai',
      api_key: 'test-key',
      model: 'gpt-test',
      base_url: 'https://llm.example/v1'
    })
  })
})
