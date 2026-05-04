import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'
import {
  AI_STATES,
  DEATH_ENDING_SEQUENCE_FRAMES,
  ENDING_THRESHOLDS,
  EMOTIONS,
  ENDINGS,
  GAME_ROLE,
  GAME_RULES,
  MECHANIC_TAGS,
  OPENING_SEQUENCE_FRAMES,
  ROOFTOP_BGM_SRC,
  ROOFTOP_BGM_SRCS,
  SCENE_BACKGROUNDS,
  SCENE_MOBILE_BACKGROUNDS,
  STAIR_STEP_SFX_SRCS,
  inferEndingTypeFromNarrative,
  resolveFallbackEndingType,
  resolveWaitingBackground,
  resolveWaitingMobileBackground,
  resolveVisualState
} from '../src/domain/gameContract'

const readRepoFile = (relativePath: string) =>
  readFileSync(resolve(cwd(), '..', relativePath), 'utf8')

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

describe('game contract', () => {
  it('keeps docs and backend constants aligned with frontend mechanism tags', () => {
    const promptDoc = readRepoFile('docs/engineering/prompts_and_settings.md')
    const backendContract = readRepoFile('backend/llm/game_contract.go')

    expect(promptDoc).toContain(GAME_ROLE.characterName)
    expect(promptDoc).toContain(`${GAME_RULES.initialRoundCount} 句话`)
    expect(promptDoc).toContain(MECHANIC_TAGS.affectionBoost)
    expect(backendContract).toMatch(new RegExp(`CharacterName\\s*=\\s*"${GAME_ROLE.characterName}"`))
    expect(backendContract).toMatch(new RegExp(`InitialRoundCount\\s*=\\s*${GAME_RULES.initialRoundCount}`))
    expect(backendContract).toMatch(new RegExp(`AffectionBoostTag\\s*=\\s*"${escapeRegExp(MECHANIC_TAGS.affectionBoost)}"`))

    for (const ending of Object.values(ENDINGS)) {
      expect(promptDoc).toContain(ending.tag)
      expect(promptDoc).toContain(ending.type)
      expect(backendContract).toContain(`"${ending.type}"`)
      expect(backendContract).toContain(`"${ending.label}"`)
      expect(backendContract).toContain(`"${ending.tag}"`)
    }

    for (const emotion of Object.values(EMOTIONS)) {
      expect(promptDoc).toContain(emotion.tag)
      expect(backendContract).toContain(`"${emotion.label}"`)
      expect(backendContract).toContain(`"${emotion.tag}"`)
    }

    for (const aiState of Object.values(AI_STATES)) {
      expect(promptDoc).toContain(aiState.tag)
      expect(backendContract).toContain(`"${aiState.label}"`)
      expect(backendContract).toContain(`"${aiState.tag}"`)
    }
  })

  it('keeps current story docs aligned with the seen-not-seen character core', () => {
    const promptDoc = readRepoFile('docs/engineering/prompts_and_settings.md')
    const loreDoc = readRepoFile('docs/product/storyline_and_lore.md')
    const playerGuide = readRepoFile('docs/product/player_guide.md')
    const currentStoryDocs = [promptDoc, loreDoc, playerGuide].join('\n')

    expect(GAME_ROLE.coreDescription).toContain('长期看见别人')
    expect(currentStoryDocs).toContain('被看见悖论')
    expect(currentStoryDocs).toContain('救下但没有建立关系')
    expect(currentStoryDocs).toContain('好感度 >= 20')
    expect(currentStoryDocs).toContain('好感触发次数 >= 4')
    expect(currentStoryDocs).toContain('暂时留下')

    expect(currentStoryDocs).not.toContain('完美的救赎')
    expect(currentStoryDocs).not.toContain('真正的救赎')
    expect(currentStoryDocs).not.toContain('彻底治愈')
    expect(currentStoryDocs).not.toContain('彻底击碎')
    expect(loreDoc).not.toContain('友善但平庸')
  })

  it('maps every emotion to an existing CG asset', () => {
    for (const emotion of Object.values(EMOTIONS)) {
      const assetPath = emotion.backgroundImage.replace('/assets/', 'legacy_vue/public/assets/')
      expect(existsSync(resolve(cwd(), '..', assetPath))).toBe(true)
    }
  })

  it('maps every scene background to an existing asset', () => {
    for (const backgroundImage of [
      ...Object.values(SCENE_BACKGROUNDS),
      ...Object.values(SCENE_MOBILE_BACKGROUNDS)
    ]) {
      const assetPath = backgroundImage.replace('/assets/', 'legacy_vue/public/assets/')
      expect(existsSync(resolve(cwd(), '..', assetPath))).toBe(true)
    }
  })

  it('maps every AI state to an existing CG asset', () => {
    for (const aiState of Object.values(AI_STATES)) {
      const assetPath = aiState.backgroundImage.replace('/assets/', 'legacy_vue/public/assets/')
      expect(existsSync(resolve(cwd(), '..', assetPath))).toBe(true)
      const mobileAssetPath = aiState.mobileBackgroundImage.replace('/assets/', 'legacy_vue/public/assets/')
      expect(existsSync(resolve(cwd(), '..', mobileAssetPath))).toBe(true)
    }
  })

  it('maps the opening sequence frames and step SFX to existing assets', () => {
    expect(OPENING_SEQUENCE_FRAMES).toHaveLength(5)

    for (const frame of OPENING_SEQUENCE_FRAMES) {
      const assetPath = frame.image.replace('/assets/', 'legacy_vue/public/assets/')
      expect(existsSync(resolve(cwd(), '..', assetPath))).toBe(true)
      expect(frame.caption).toMatch(/我/)
    }

    expect(STAIR_STEP_SFX_SRCS).toHaveLength(4)
    for (const sfxSrc of STAIR_STEP_SFX_SRCS) {
      const assetPath = sfxSrc.replace('/assets/', 'legacy_vue/public/assets/')
      expect(existsSync(resolve(cwd(), '..', assetPath))).toBe(true)
    }
  })

  it('maps the death ending cinematic sequence frames to existing desktop and mobile assets', () => {
    expect(DEATH_ENDING_SEQUENCE_FRAMES).toHaveLength(5)
    expect(DEATH_ENDING_SEQUENCE_FRAMES[0].id).toBe('fall-01-silence')

    for (const frame of DEATH_ENDING_SEQUENCE_FRAMES) {
      const desktopAssetPath = frame.image.replace('/assets/', 'legacy_vue/public/assets/')
      const mobileAssetPath = frame.mobileImage.replace('/assets/', 'legacy_vue/public/assets/')
      expect(existsSync(resolve(cwd(), '..', desktopAssetPath))).toBe(true)
      expect(existsSync(resolve(cwd(), '..', mobileAssetPath))).toBe(true)
      expect(frame.caption.length).toBeGreaterThan(0)
    }
  })

  it('maps the rooftop BGM to an existing trimmed asset', () => {
    const assetPath = ROOFTOP_BGM_SRC.replace('/assets/', 'legacy_vue/public/assets/')
    expect(existsSync(resolve(cwd(), '..', assetPath))).toBe(true)
    for (const bgmSrc of ROOFTOP_BGM_SRCS) {
      const fallbackAssetPath = bgmSrc.replace('/assets/', 'legacy_vue/public/assets/')
      expect(existsSync(resolve(cwd(), '..', fallbackAssetPath))).toBe(true)
    }
  })

  it('keeps the opening sequence written as player inner monologue', () => {
    expect(OPENING_SEQUENCE_FRAMES[0]).toMatchObject({
      chapterTitle: '序章',
      chapterMeta: '23:47 / 天台入口'
    })
    expect(OPENING_SEQUENCE_FRAMES[4].caption).toContain('怕再响一点')
    expect(OPENING_SEQUENCE_FRAMES[4].caption).not.toContain('十句话')
  })

  it('resolves CG priority through the visual state machine', () => {
    expect(resolveVisualState({
      roundCount: 8,
      affection: 0,
      isEnding: false,
      endingType: null,
      aiStateType: AI_STATES.guarded.type,
      emotionType: EMOTIONS.curiosity.type
    })).toMatchObject({
      source: 'emotion',
      backgroundImage: EMOTIONS.curiosity.backgroundImage
    })

    expect(resolveVisualState({
      roundCount: 1,
      affection: 0,
      isEnding: false,
      endingType: null,
      aiStateType: AI_STATES.watching.type,
      emotionType: EMOTIONS.soft.type
    })).toMatchObject({
      source: 'aiState',
      backgroundImage: AI_STATES.edge.backgroundImage
    })

    expect(resolveVisualState({
      roundCount: 1,
      affection: 0,
      isEnding: false,
      endingType: null,
      aiStateType: AI_STATES.turnBack.type,
      emotionType: EMOTIONS.soft.type
    })).toMatchObject({
      source: 'emotion',
      backgroundImage: EMOTIONS.soft.backgroundImage
    })

    expect(resolveVisualState({
      roundCount: 1,
      affection: 0,
      isEnding: true,
      endingType: ENDINGS.death.type,
      aiStateType: AI_STATES.edge.type,
      emotionType: EMOTIONS.sting.type
    })).toMatchObject({
      source: 'ending',
      backgroundImage: ENDINGS.death.backgroundImage,
      mobileBackgroundImage: ENDINGS.death.mobileBackgroundImage
    })
  })

  it('keeps waiting CG consistent with dangerous turned-away states', () => {
    const guardedState = resolveVisualState({
      roundCount: 8,
      affection: 0,
      isEnding: false,
      endingType: null,
      aiStateType: AI_STATES.guarded.type,
      emotionType: null
    })
    expect(resolveWaitingBackground(guardedState)).toBe(SCENE_BACKGROUNDS.smoke)
    expect(resolveWaitingMobileBackground(guardedState)).toBe(SCENE_MOBILE_BACKGROUNDS.smoke)

    const turnBackState = resolveVisualState({
      roundCount: 4,
      affection: 15,
      isEnding: false,
      endingType: null,
      aiStateType: AI_STATES.turnBack.type,
      emotionType: EMOTIONS.soft.type
    })
    expect(resolveWaitingBackground(turnBackState)).toBe(AI_STATES.turnBack.backgroundImage)
    expect(resolveWaitingMobileBackground(turnBackState)).toBe(AI_STATES.turnBack.mobileBackgroundImage)

    const edgeState = resolveVisualState({
      roundCount: 1,
      affection: 0,
      isEnding: false,
      endingType: null,
      aiStateType: AI_STATES.watching.type,
      emotionType: EMOTIONS.soft.type
    })
    expect(resolveWaitingBackground(edgeState)).toBe(AI_STATES.edge.backgroundImage)
    expect(resolveWaitingMobileBackground(edgeState)).toBe(AI_STATES.edge.mobileBackgroundImage)
  })

  it('resolves local fallback endings with death as the default failure', () => {
    expect(resolveFallbackEndingType({
      affection: ENDING_THRESHOLDS.disappear.minAffection - 1,
      affectionBoostCount: ENDING_THRESHOLDS.disappear.minAffectionBoostCount,
      turnsUsed: ENDING_THRESHOLDS.disappear.minTurnsUsed
    })).toBe(ENDINGS.death.type)

    expect(resolveFallbackEndingType({
      affection: ENDING_THRESHOLDS.disappear.minAffection,
      affectionBoostCount: ENDING_THRESHOLDS.disappear.minAffectionBoostCount,
      turnsUsed: ENDING_THRESHOLDS.disappear.minTurnsUsed
    })).toBe(ENDINGS.disappear.type)

    expect(resolveFallbackEndingType({
      affection: ENDING_THRESHOLDS.acquaintance.minAffection,
      affectionBoostCount: ENDING_THRESHOLDS.acquaintance.minAffectionBoostCount,
      turnsUsed: ENDING_THRESHOLDS.acquaintance.minTurnsUsed
    })).toBe(ENDINGS.acquaintance.type)
  })

  it('infers ending semantics from untagged final narrative text', () => {
    expect(inferEndingTypeFromNarrative('她把手机递过来，说：存个艾就行。明天九点，别迟到。'))
      .toBe(ENDINGS.acquaintance.type)
    expect(inferEndingTypeFromNarrative('她走进消防通道，没有回头，脚步声逐渐消失。'))
      .toBe(ENDINGS.disappear.type)
    expect(inferEndingTypeFromNarrative('她轻轻呼出最后一缕烟，身体向后倾去。'))
      .toBe(ENDINGS.death.type)
  })

  it('uses narrative ending inference before numeric fallback when tags are missing', () => {
    expect(resolveFallbackEndingType({
      affection: 0,
      affectionBoostCount: 0,
      turnsUsed: GAME_RULES.initialRoundCount,
      lastAssistantText: '她低头看了看自己的脚，说：走吧。明天九点，别迟到。'
    })).toBe(ENDINGS.acquaintance.type)

    expect(resolveFallbackEndingType({
      affection: 0,
      affectionBoostCount: 0,
      turnsUsed: GAME_RULES.initialRoundCount,
      lastAssistantText: '她背靠着栏杆，转身往消防通道走去，没有回头。'
    })).toBe(ENDINGS.disappear.type)
  })
})
