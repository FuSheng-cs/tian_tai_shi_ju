import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  AI_STATES, EMOTIONS, ENDINGS, GAME_ROLE, GAMEPLAY_PRELOAD_IMAGES,
  OPENING_SEQUENCE_FRAMES, ROOFTOP_BGM_SRCS, STAIR_STEP_SFX_SRCS,
  resolveFallbackEndingType, resolveVisualState, resolveWaitingBackground
} from '../src/domain/gameContract'
import { normalizeEndingType } from '../src/domain/gameState'

describe('safety dialogue contract', () => {
  it('keeps all runtime backgrounds, opening frames and audio on disk', () => {
    const assets = [
      ...GAMEPLAY_PRELOAD_IMAGES.desktop,
      ...GAMEPLAY_PRELOAD_IMAGES.mobile,
      ...OPENING_SEQUENCE_FRAMES.map(frame => frame.image),
      ...ROOFTOP_BGM_SRCS, ...STAIR_STEP_SFX_SRCS,
      ...Object.values(ENDINGS).flatMap(ending => [ending.backgroundImage, ending.mobileBackgroundImage])
    ]
    for (const asset of assets) {
      expect(existsSync(resolve('public', asset.slice(1))), asset).toBe(true)
      expect(asset).not.toMatch(/smoke|cigarette|death|fall_/)
    }
  })

  it('shares the two AI ending codes with the backend', () => {
    const backend = readFileSync(resolve('../backend/llm/game_contract.go'), 'utf8')
    expect(Object.values(ENDINGS)).toHaveLength(2)
    for (const ending of Object.values(ENDINGS)) expect(backend).toContain(ending.type)
    expect(GAME_ROLE.tagline).toBe('你不需要说出十句正确的话，只需要陪一个人找到下一个安全的地方。')
  })

  it('does not equate crying or high trust with leaving safely', () => {
    for (const trust of [0, 15, 50]) {
      expect(resolveFallbackEndingType({ trust, lastAiStateType: 'crying' })).toBe(ENDINGS.refusal.type)
    }
  })

  it('uses the AI state even when trust would suggest a different state', () => {
    const state = resolveVisualState({
      roundCount: 1, trust: 50, isEnding: false, endingType: null,
      aiStateType: 'guarded', emotionType: null
    })
    expect(state.aiStateType).toBe('guarded')
    expect(state.backgroundImage).toBe(AI_STATES.guarded.backgroundImage)
    expect(resolveWaitingBackground(state)).toBe(AI_STATES.guarded.backgroundImage)
  })

  it('shows momentary emotions but keeps crying and final ending scenes', () => {
    const base = { roundCount: 5, trust: 0, isEnding: false, endingType: null, aiStateType: 'watching' as const, emotionType: 'soft' as const }
    expect(resolveVisualState(base).backgroundImage).toBe(EMOTIONS.soft.backgroundImage)
    expect(resolveVisualState({ ...base, aiStateType: 'crying' }).aiStateType).toBe('crying')
    expect(resolveVisualState({ ...base, isEnding: true, endingType: 'end_safe_exit' }).backgroundImage).toBe(ENDINGS.safeExit.backgroundImage)
  })

  it('normalizes unknown ending codes conservatively', () => {
    expect(normalizeEndingType('unknown')).toBeNull()
    expect(normalizeEndingType('end_death')).toBeNull()
    expect(normalizeEndingType('end_acquaintance')).toBeNull()
    expect(normalizeEndingType('end_safe_exit')).toBe('end_safe_exit')
    expect(normalizeEndingType('end_refusal')).toBe('end_refusal')
  })
})
