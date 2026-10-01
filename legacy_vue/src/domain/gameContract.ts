import { CG_ASSETS } from './cgAssets.generated'

export const GAME_RULES = {
  initialRoundCount: 10,
  initialHintCount: 3,
  saveSlotIds: [1, 2, 3],
  affectionBoostValue: 5,
  criticalPressureRoundCount: 2,
  maxSummaryTextLength: 80
} as const

export const GAME_ENTRY_QUERY_KEY = 'entry'
export const CHAT_AFTER_SLOT_QUERY_KEY = 'slot'

export const parseChatAfterSlotId = (value: unknown): number | null => {
  if (typeof value !== 'string' || value === '') return null
  const slotId = Number(value)
  return Number.isInteger(slotId) ? slotId : null
}
export const ROOFTOP_BGM_SRCS = [
  '/assets/audio/bgm_rooftop_96k.ogg',
  '/assets/audio/bgm_rooftop_96k.mp3'
] as const
export const ROOFTOP_BGM_SRC = ROOFTOP_BGM_SRCS[0]
export const STAIR_STEP_SFX_SRCS = [
  '/assets/audio/sfx_stair_step.mp3',
  '/assets/audio/sfx_stair_step_02.mp3',
  '/assets/audio/sfx_stair_step_03.mp3',
  '/assets/audio/sfx_stair_step_04.mp3'
] as const
export const FALL_IMPACT_SFX_SRC = '/assets/audio/sfx_fall_impact.wav'

export const GAME_ENTRY_TYPES = {
  newGame: 'new',
  load: 'load'
} as const

const UNIFIED_GAME_CG_ROOT = '/assets/images/unified_image2_2026-07-31/game_cg'

export const OPENING_SEQUENCE_FRAMES = [
  {
    id: 'stair-door',
    image: CG_ASSETS['opening/opening_01'].image,
    mobileImage: CG_ASSETS['opening/opening_01'].mobileImage,
    caption: '我只是想上来透口气，可门后的风声像是在提醒我：别出声。',
    chapterTitle: '序章',
    chapterMeta: '23:47 / 天台入口'
  },
  {
    id: 'door-open',
    image: CG_ASSETS['opening/opening_02'].image,
    mobileImage: CG_ASSETS['opening/opening_02'].mobileImage,
    caption: '我推开门，雨和城市的冷光一起涌进来。'
  },
  {
    id: 'rooftop-entry',
    image: CG_ASSETS['opening/opening_03'].image,
    mobileImage: CG_ASSETS['opening/opening_03'].mobileImage,
    caption: '栏杆边那个背影让我停住了脚步。是艾。'
  },
  {
    id: 'approach',
    image: CG_ASSETS['opening/opening_04'].image,
    mobileImage: CG_ASSETS['opening/opening_04'].mobileImage,
    caption: '她没有回头。烟头亮了一下，我忽然不知道第一句话该怎么说。'
  },
  {
    id: 'first-words',
    image: CG_ASSETS['opening/opening_05'].image,
    mobileImage: CG_ASSETS['opening/opening_05'].mobileImage,
    caption: '她坐在雨里，像城市忘了关掉的一盏冷灯。我把呼吸压低，怕再响一点，她就会被风带走。'
  }
] as const

export const DEATH_ENDING_SEQUENCE_FRAMES = [
  {
    id: 'fall-01-silence',
    image: CG_ASSETS['ending/death_01'].image,
    mobileImage: CG_ASSETS['ending/death_01'].mobileImage,
    caption: '她的手从栏杆上松开，烟先一步落进雨里。',
    chapterTitle: '结局',
    chapterMeta: '坠落'
  },
  {
    id: 'fall-02-step-back',
    image: CG_ASSETS['ending/death_02'].image,
    mobileImage: CG_ASSETS['ending/death_02'].mobileImage,
    caption: '栏杆湿得发亮，她的重心越过了最后一点边界。'
  },
  {
    id: 'fall-03-drop',
    image: CG_ASSETS['ending/death_03'].image,
    mobileImage: CG_ASSETS['ending/death_03'].mobileImage,
    caption: '风把她的外套和头发一起托起，城市忽然远得没有尽头。'
  },
  {
    id: 'fall-04-falling-wide',
    image: CG_ASSETS['ending/death_04'].image,
    mobileImage: CG_ASSETS['ending/death_04'].mobileImage,
    caption: '高楼的灯一层层掠过去，她变成雨夜里无法抓住的一点。'
  },
  {
    id: 'fall-05-empty-rooftop',
    image: CG_ASSETS['ending/death_05'].image,
    mobileImage: CG_ASSETS['ending/death_05'].mobileImage,
    caption: '天台又安静下来，只剩栏杆、雨和没有人接住的烟。'
  }
] as const

export const GAME_ROLE = {
  gameTitle: '天台十句',
  characterName: '艾',
  assistantSpeakerName: '艾',
  narratorSpeakerName: '旁白',
  playerSpeakerName: '你',
  openingMessage:
    '夜晚的天台，微风吹过。霓虹灯的色彩在她的头发上跳跃。她坐在围栏上，指间的香烟忽明忽暗。你记得她，那个在夜色中游荡的摄影师。',
  coreDescription:
    '艾是紫色内染发的独立摄影师，长期看见别人却很少被真正看见。她需要的是具体倾听、尊重边界和愿意停留，而不是居高临下的说教。'
} as const

export const WAITING_TEXTS = [
  '她吐了一口烟圈……',
  '她把烟灰弹进夜色里，沉默了一会儿……',
  '她在看着你的眼睛发呆……',
  '霓虹灯在她脸上闪烁……',
  '她轻轻弹了弹烟灰……'
] as const

export const SCENE_BACKGROUNDS = {
  smoke: CG_ASSETS['state/state_smoke'].image,
  normal: CG_ASSETS['state/state_guarded'].image,
  sad: CG_ASSETS['state/state_wavering'].image,
  turnBack: CG_ASSETS['state/state_turn_back'].image,
  nearJump: CG_ASSETS['state/state_edge'].image
} as const

export const SCENE_MOBILE_BACKGROUNDS = {
  smoke: CG_ASSETS['state/state_smoke'].mobileImage,
  normal: CG_ASSETS['state/state_guarded'].mobileImage,
  sad: CG_ASSETS['state/state_wavering'].mobileImage,
  turnBack: CG_ASSETS['state/state_turn_back'].mobileImage,
  nearJump: CG_ASSETS['state/state_edge'].mobileImage
} as const

export const CHAT_AVATAR_IMAGE = `${UNIFIED_GAME_CG_ROOT}/state/avatar_guarded_480.webp`

export const MOBILE_BACKGROUND_MEDIA_QUERY = '(max-width: 768px)'

export const GAMEPLAY_PRELOAD_IMAGES = {
  desktop: [
    SCENE_BACKGROUNDS.smoke,
    SCENE_BACKGROUNDS.normal,
    SCENE_BACKGROUNDS.sad,
    SCENE_BACKGROUNDS.turnBack,
    SCENE_BACKGROUNDS.nearJump,
    ...DEATH_ENDING_SEQUENCE_FRAMES.map((frame) => frame.image)
  ],
  mobile: [
    SCENE_MOBILE_BACKGROUNDS.smoke,
    SCENE_MOBILE_BACKGROUNDS.normal,
    SCENE_MOBILE_BACKGROUNDS.sad,
    SCENE_MOBILE_BACKGROUNDS.turnBack,
    SCENE_MOBILE_BACKGROUNDS.nearJump,
    ...DEATH_ENDING_SEQUENCE_FRAMES.map((frame) => frame.mobileImage)
  ]
} as const

export const MECHANIC_TAGS = {
  affectionBoost: `[好感度+${GAME_RULES.affectionBoostValue}]`,
  endingPrefix: '[结局:',
  endingSuffix: ']',
  emotionPrefix: '[情绪:',
  aiStatePrefix: '[状态:'
} as const

export const AI_STATES = {
  guarded: {
    type: 'guarded',
    label: '戒备',
    tag: '[状态:戒备]',
    backgroundImage: SCENE_BACKGROUNDS.normal,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.normal
  },
  watching: {
    type: 'watching',
    label: '观察',
    tag: '[状态:观察]',
    backgroundImage: SCENE_BACKGROUNDS.normal,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.normal
  },
  wavering: {
    type: 'wavering',
    label: '动摇',
    tag: '[状态:动摇]',
    backgroundImage: SCENE_BACKGROUNDS.sad,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.sad
  },
  turnBack: {
    type: 'turnBack',
    label: '回身',
    tag: '[状态:回身]',
    backgroundImage: SCENE_BACKGROUNDS.turnBack,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.turnBack
  },
  edge: {
    type: 'edge',
    label: '临界',
    tag: '[状态:临界]',
    backgroundImage: SCENE_BACKGROUNDS.nearJump,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.nearJump
  }
} as const

export type AiStateDefinition = (typeof AI_STATES)[keyof typeof AI_STATES]
export type AiStateType = AiStateDefinition['type']

export const EMOTIONS = {
  sting: {
    type: 'sting',
    label: '刺痛',
    tag: '[情绪:刺痛]',
    backgroundImage: CG_ASSETS['emotion/emotion_sting'].image,
    mobileBackgroundImage: CG_ASSETS['emotion/emotion_sting'].mobileImage
  },
  surprise: {
    type: 'surprise',
    label: '惊讶',
    tag: '[情绪:惊讶]',
    backgroundImage: CG_ASSETS['emotion/emotion_surprise'].image,
    mobileBackgroundImage: CG_ASSETS['emotion/emotion_surprise'].mobileImage
  },
  soft: {
    type: 'soft',
    label: '柔软',
    tag: '[情绪:柔软]',
    backgroundImage: CG_ASSETS['emotion/emotion_soft'].image,
    mobileBackgroundImage: CG_ASSETS['emotion/emotion_soft'].mobileImage
  },
  curiosity: {
    type: 'curiosity',
    label: '好奇',
    tag: '[情绪:好奇]',
    backgroundImage: CG_ASSETS['emotion/emotion_curiosity'].image,
    mobileBackgroundImage: CG_ASSETS['emotion/emotion_curiosity'].mobileImage
  }
} as const

export type EmotionDefinition = (typeof EMOTIONS)[keyof typeof EMOTIONS]
export type EmotionType = EmotionDefinition['type']

export const ENDINGS = {
  death: {
    type: 'end_death',
    label: '死亡',
    tag: '[结局:死亡]',
    achievementName: '坠落',
    backgroundImage: DEATH_ENDING_SEQUENCE_FRAMES[4].image,
    mobileBackgroundImage: DEATH_ENDING_SEQUENCE_FRAMES[4].mobileImage
  },
  disappear: {
    type: 'end_disappear',
    label: '消失',
    tag: '[结局:消失]',
    achievementName: '消失',
    backgroundImage: CG_ASSETS['ending/end_disappear'].image,
    mobileBackgroundImage: CG_ASSETS['ending/end_disappear'].mobileImage
  },
  acquaintance: {
    type: 'end_acquaintance',
    label: '相识',
    tag: '[结局:相识]',
    achievementName: '相识',
    backgroundImage: CG_ASSETS['ending/end_acquaintance'].image,
    mobileBackgroundImage: CG_ASSETS['ending/end_acquaintance'].mobileImage
  }
} as const

export type EndingDefinition = (typeof ENDINGS)[keyof typeof ENDINGS]
export type EndingType = EndingDefinition['type']

// 结局数值门槛与后端 backend/llm/game_contract.go 的 EndingDisappearMin*/EndingAcquaintanceMin*
// 常量逐项对应，改动必须两侧同步；一致性由 tests/gameContract.test.ts 与
// backend/llm/game_contract_test.go 各自断言。
export const ENDING_THRESHOLDS = {
  disappear: {
    minAffection: 20,
    minAffectionBoostCount: 4,
    minTurnsUsed: 7
  },
  acquaintance: {
    minAffection: 25,
    minAffectionBoostCount: 5,
    minTurnsUsed: 7
  }
} as const

export interface EndingResolutionSnapshot {
  affection: number
  affectionBoostCount: number
  turnsUsed: number
  lastAssistantText?: string
}

// 否定语义处理与 backend/llm/service.go 的 hasNegationBeforeMatch/hasNonNegatedMatch 保持同构：
// 命中位置前 4 个字符窗口内出现否定词即视为该次命中被否定，全部命中被否定则整个词条不算命中，
// 覆盖“我不会跳下去”“没有滑落”等常见否定形式。
const NEGATION_MARKERS = ['没', '不', '别'] as const
const NEGATION_WINDOW_SIZE = 4

const hasNegationBeforeMatch = (text: string, matchStart: number) => {
  const windowText = text.slice(Math.max(0, matchStart - NEGATION_WINDOW_SIZE), matchStart)
  return NEGATION_MARKERS.some((marker) => windowText.includes(marker))
}

const hasNonNegatedMatch = (text: string, pattern: RegExp) => {
  const globalPattern = new RegExp(pattern.source, 'g')
  let match = globalPattern.exec(text)
  while (match) {
    if (!hasNegationBeforeMatch(text, match.index)) return true
    if (globalPattern.lastIndex === match.index) globalPattern.lastIndex += 1
    match = globalPattern.exec(text)
  }
  return false
}

const countPatternMatches = (text: string, patterns: RegExp[]) =>
  patterns.reduce((count, pattern) => count + (hasNonNegatedMatch(text, pattern) ? 1 : 0), 0)

export const inferEndingTypeFromNarrative = (text: string): EndingType | null => {
  const normalized = text.replace(/\s+/g, '')
  if (!normalized) return null

  const deathScore = countPatternMatches(normalized, [
    /身体向后倾/,
    /向后倒/,
    /滑落/,
    /坠落/,
    /跳下/,
    /楼下.*空白/,
    /最后一缕烟/
  ])
  if (deathScore >= 1) return ENDINGS.death.type

  const acquaintanceScore = countPatternMatches(normalized, [
    /手机.*递/,
    /递.*手机/,
    /联系方式/,
    /存个?['"“]?艾/,
    /别打备注/,
    /明天.*(九点|见|别迟到|继续|底片|饭团|冲洗|洗出来)/,
    /(九点|明天).*(别迟到|冲洗店|洗.*底片)/,
    /愿意.*继续.*(说话|联系)/,
    /交换.*联系方式/
  ])

  const disappearScore = countPatternMatches(normalized, [
    /消防通道.*(离开|走|阴影)/,
    /楼梯间.*(离开|阴影|脚步声)/,
    /没有回头/,
    /脚步声.*(消失|远去|吞掉)/,
    /栏杆.*空/,
    /不交换.*联系方式/,
    /不用回头/,
    /今晚这口气.*留着/
  ])

  if (acquaintanceScore >= 2 && acquaintanceScore >= disappearScore) {
    return ENDINGS.acquaintance.type
  }

  if (disappearScore >= 2) {
    return ENDINGS.disappear.type
  }

  return null
}

const meetsEndingThreshold = (
  snapshot: EndingResolutionSnapshot,
  threshold: (typeof ENDING_THRESHOLDS)[keyof typeof ENDING_THRESHOLDS]
) =>
  snapshot.affection >= threshold.minAffection &&
  snapshot.affectionBoostCount >= threshold.minAffectionBoostCount &&
  snapshot.turnsUsed >= threshold.minTurnsUsed

export const resolveFallbackEndingType = (snapshot: EndingResolutionSnapshot): EndingType => {
  if (meetsEndingThreshold(snapshot, ENDING_THRESHOLDS.acquaintance)) {
    return ENDINGS.acquaintance.type
  }

  if (meetsEndingThreshold(snapshot, ENDING_THRESHOLDS.disappear)) {
    return ENDINGS.disappear.type
  }

  return inferEndingTypeFromNarrative(snapshot.lastAssistantText ?? '') ?? ENDINGS.death.type
}

export const ENDING_BY_TYPE = Object.fromEntries(
  Object.values(ENDINGS).map((ending) => [ending.type, ending])
) as Record<EndingType, EndingDefinition>

export const AI_STATE_BY_TYPE = Object.fromEntries(
  Object.values(AI_STATES).map((aiState) => [aiState.type, aiState])
) as Record<AiStateType, AiStateDefinition>

export const EMOTION_BY_TYPE = Object.fromEntries(
  Object.values(EMOTIONS).map((emotion) => [emotion.type, emotion])
) as Record<EmotionType, EmotionDefinition>

const AI_STATE_ORDER: Record<AiStateType, number> = {
  guarded: 0,
  watching: 1,
  wavering: 2,
  turnBack: 3,
  edge: 4
}

const isCriticalAiStateType = (aiStateType: AiStateType) =>
  aiStateType === AI_STATES.edge.type || aiStateType === AI_STATES.turnBack.type

export type VisualStateSource = 'ending' | 'aiState' | 'emotion'

export interface VisualStateSnapshot {
  roundCount: number
  affection: number
  isEnding: boolean
  endingType: EndingType | null
  aiStateType: AiStateType | null
  emotionType: EmotionType | null
}

export interface ResolvedVisualState {
  source: VisualStateSource
  backgroundImage: string
  mobileBackgroundImage: string
  label: string
  aiStateType: AiStateType | null
}

export const resolveWaitingBackground = (visualState: ResolvedVisualState): string => {
  const aiState = visualState.aiStateType ? AI_STATE_BY_TYPE[visualState.aiStateType] : null

  if (aiState?.type === AI_STATES.edge.type || aiState?.type === AI_STATES.turnBack.type) {
    return aiState.backgroundImage
  }

  return SCENE_BACKGROUNDS.smoke
}

export const resolveWaitingMobileBackground = (visualState: ResolvedVisualState): string => {
  const aiState = visualState.aiStateType ? AI_STATE_BY_TYPE[visualState.aiStateType] : null

  if (aiState?.type === AI_STATES.edge.type || aiState?.type === AI_STATES.turnBack.type) {
    return aiState.mobileBackgroundImage
  }

  return SCENE_MOBILE_BACKGROUNDS.smoke
}

export const deriveAiStateType = (
  snapshot: Pick<VisualStateSnapshot, 'roundCount' | 'affection'>
): AiStateType => {
  if (snapshot.roundCount <= 1) return AI_STATES.edge.type
  if (snapshot.roundCount <= GAME_RULES.criticalPressureRoundCount && snapshot.affection < 20) {
    return AI_STATES.edge.type
  }
  if (snapshot.affection >= 15) return AI_STATES.wavering.type
  if (snapshot.affection >= 5) return AI_STATES.watching.type
  return AI_STATES.guarded.type
}

const chooseEffectiveAiState = (
  explicitState: AiStateType | null,
  derivedState: AiStateType
): AiStateType => {
  if (!explicitState) return derivedState
  if (explicitState === AI_STATES.turnBack.type) {
    return derivedState === AI_STATES.edge.type ? explicitState : derivedState
  }
  if (AI_STATE_ORDER[derivedState] >= AI_STATE_ORDER[AI_STATES.edge.type]) return derivedState
  return explicitState
}

export const resolveVisualState = (snapshot: VisualStateSnapshot): ResolvedVisualState => {
  if (snapshot.isEnding && snapshot.endingType) {
    const ending = ENDING_BY_TYPE[snapshot.endingType]
    if (ending) {
      return {
        source: 'ending',
        backgroundImage: ending.backgroundImage,
        mobileBackgroundImage: ending.mobileBackgroundImage,
        label: ending.label,
        aiStateType: snapshot.aiStateType
      }
    }
  }

  const derivedAiState = deriveAiStateType(snapshot)
  const explicitAiState =
    snapshot.aiStateType && AI_STATE_BY_TYPE[snapshot.aiStateType] ? snapshot.aiStateType : null
  const effectiveAiState = chooseEffectiveAiState(explicitAiState, derivedAiState)
  const aiState = AI_STATE_BY_TYPE[effectiveAiState]
  const aiStateLabel =
    effectiveAiState === AI_STATES.turnBack.type ? AI_STATES.edge.label : aiState.label

  const emotion = snapshot.emotionType ? EMOTION_BY_TYPE[snapshot.emotionType] : null
  if (emotion && !isCriticalAiStateType(effectiveAiState)) {
    return {
      source: 'emotion',
      backgroundImage: emotion.backgroundImage,
      mobileBackgroundImage: emotion.mobileBackgroundImage,
      label: emotion.label,
      aiStateType: effectiveAiState
    }
  }

  return {
    source: 'aiState',
    backgroundImage: aiState.backgroundImage,
    mobileBackgroundImage: aiState.mobileBackgroundImage,
    label: aiStateLabel,
    aiStateType: effectiveAiState
  }
}
