import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AI_STATES, EMOTIONS, ENDINGS } from '../src/domain/gameContract'
import type { Message } from '../src/domain/gameState'
import {
  LLMService,
  LLM_PROVIDERS,
  getLLMProvider,
  loadLLMConfig,
  saveLLMConfig
} from '../src/modules/LLMService'

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
    { role: 'assistant', content: 'opening' },
    { role: 'user', content: 'can I sit here?' }
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

  it('assembles the main chat request and maps structured evaluation', async () => {
    mockBackendResponse({
      reply: 'she looks at you',
      evaluation: {
        emotion: EMOTIONS.soft.type,
        ai_state: AI_STATES.watching.type,
        affection_delta: 5,
        pressure_delta: 1,
        ending_type: null,
        confidence: 0.8
      }
    })

    const turn = await LLMService.chat('are you okay?', history, {
      roundsLeft: 8,
      affection: 5,
      affectionBoostCount: 1,
      turnsUsed: 3,
      aiState: AI_STATES.watching.type
    })

    expect(turn).toEqual({
      reply: 'she looks at you',
      evaluation: {
        emotion: EMOTIONS.soft.type,
        aiState: AI_STATES.watching.type,
        affectionDelta: 5,
        pressureDelta: 1,
        endingType: null,
        confidence: 0.8
      }
    })
    expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/chat$/), expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }))
    expect(getLastRequestBody()).toEqual({
      history,
      user_message: 'are you okay?',
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

  it('normalizes invalid chat evaluation fields conservatively', async () => {
    mockBackendResponse({
      reply: '...',
      evaluation: {
        emotion: 'angry',
        ai_state: 'bad-state',
        affection_delta: 7,
        pressure_delta: 9,
        ending_type: 'not-an-ending',
        confidence: 2
      }
    })

    const turn = await LLMService.chat('I will not rush you', history, {
      roundsLeft: 6,
      affection: 0,
      affectionBoostCount: 0,
      turnsUsed: 2,
      aiState: AI_STATES.wavering.type
    })

    expect(turn).toEqual({
      reply: '...',
      evaluation: {
        emotion: 'normal',
        aiState: AI_STATES.wavering.type,
        affectionDelta: 5,
        pressureDelta: 2,
        endingType: null,
        confidence: 1
      }
    })
  })

  it('keeps backend fallback reply when chat returns an error payload', async () => {
    mockBackendResponse({
      error: 'LLM failed',
      reply: 'fallback reply',
      evaluation: {
        emotion: 'normal',
        ai_state: AI_STATES.edge.type,
        affection_delta: 0,
        pressure_delta: 0,
        ending_type: null,
        confidence: 0
      }
    })

    const turn = await LLMService.chat('hello', history, {
      roundsLeft: 1,
      affection: 0,
      affectionBoostCount: 0,
      turnsUsed: 9,
      aiState: AI_STATES.edge.type
    })

    expect(turn.reply).toBe('fallback reply')
    expect(turn.evaluation.aiState).toBe(AI_STATES.edge.type)
  })

  it('assembles the ending summary request and maps snake_case response fields', async () => {
    mockBackendResponse({
      turning_line: 'can I sit here?',
      comment: 'she paused here'
    })

    const summary = await LLMService.getEndingSummary(history, {
      endingType: ENDINGS.acquaintance.type,
      roundsUsed: 2,
      affectionBoostCount: 1
    })

    expect(summary).toEqual({
      turningLine: 'can I sit here?',
      comment: 'she paused here'
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

  it('passes true-ending context into the after-story request', async () => {
    mockBackendResponse({ reply: 'I am still thinking about that line.' })

    const afterStoryContext = {
      endingType: ENDINGS.acquaintance.type,
      lastPlayerLine: 'I will sit here first.',
      endingReply: 'she hands over her phone',
      turningLine: 'I will sit here first.',
      endingComment: 'she is willing to keep talking',
      roundsUsed: 9,
      affectionBoostCount: 5,
      affection: 26
    }

    const reply = await LLMService.chatAfterStory('home yet?', history, afterStoryContext)

    expect(reply).toBe('I am still thinking about that line.')
    expect(mockFetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/chat-after$/), expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }))
    expect(getLastRequestBody()).toEqual({
      history,
      user_message: 'home yet?',
      after_story_context: {
        ending_type: ENDINGS.acquaintance.type,
        last_player_line: 'I will sit here first.',
        ending_reply: 'she hands over her phone',
        turning_line: 'I will sit here first.',
        ending_comment: 'she is willing to keep talking',
        rounds_used: 9,
        affection_boost_count: 5,
        affection: 26
      },
      provider: 'openai',
      api_key: 'test-key',
      model: 'gpt-test',
      base_url: 'https://llm.example/v1'
    })
  })

  it('exposes mainstream domestic, GPT, Claude, and custom providers', () => {
    expect(LLM_PROVIDERS.map((provider) => provider.id)).toEqual([
      'qwen',
      'deepseek',
      'doubao',
      'kimi',
      'zhipu',
      'openai',
      'claude',
      'custom'
    ])
    expect(getLLMProvider('claude')).toMatchObject({
      protocol: 'anthropic',
      defaultBaseUrl: 'https://api.anthropic.com/v1'
    })
    expect(getLLMProvider('unknown-provider')).toMatchObject({
      id: 'qwen'
    })
  })

  it('normalizes stale provider values from localStorage', () => {
    localStorage.setItem('damo_llm_provider', 'old-provider')

    expect(loadLLMConfig().provider).toBe('qwen')
  })
})
