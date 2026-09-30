export const GAME_RULES = {
  initialRoundCount: 10,
  initialHintCount: 3,
  saveSlotIds: [1, 2, 3],
  trustBoostValue: 5,
  maxTrust: 15,
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

export const GAME_ENTRY_TYPES = {
  newGame: 'new',
  load: 'load'
} as const

const UNIFIED_GAME_CG_ROOT = '/assets/images/unified_image2_2026-07-31/game_cg'
const SAFE_EXIT_CG_ROOT = '/assets/images/safe_exit_20260918'

export const SAFE_EXIT_SEQUENCE_FRAMES = [
  {
    id: 'crying',
    image: `${SAFE_EXIT_CG_ROOT}/01-crying-1600.webp`,
    mobileImage: `${SAFE_EXIT_CG_ROOT}/01-crying-900.webp`,
    caption: '艾终于哭了。眼泪顺着脸颊落下，你安静地陪在她身旁。'
  },
  {
    id: 'wipe-tears',
    image: `${SAFE_EXIT_CG_ROOT}/02-wipe-tears-1600.webp`,
    mobileImage: `${SAFE_EXIT_CG_ROOT}/02-wipe-tears-900.webp`,
    caption: '她抬起手，抹了一下眼泪，慢慢缓过一口气。'
  },
  {
    id: 'leave-together',
    image: `${SAFE_EXIT_CG_ROOT}/03-leave-ai-only-1600.webp`,
    mobileImage: `${SAFE_EXIT_CG_ROOT}/03-leave-ai-only-900.webp`,
    caption: '然后，她和你一起离开天台，走进亮着灯的楼梯间。此刻，你们先到了安全的地方。'
  }
] as const

export const OPENING_SEQUENCE_FRAMES = [
  {
    id: 'stair-door',
    image: `${UNIFIED_GAME_CG_ROOT}/opening/opening_01_1920.webp`,
    caption: '我只是想上来透口气，可门后的风声像是在提醒我：别出声。',
    chapterTitle: '序章',
    chapterMeta: '23:47 / 天台入口'
  },
  {
    id: 'door-open',
    image: `${UNIFIED_GAME_CG_ROOT}/opening/opening_02_1920.webp`,
    caption: '我推开门，雨和城市的冷光一起涌进来。'
  },
  {
    id: 'rooftop-entry',
    image: `${UNIFIED_GAME_CG_ROOT}/opening/opening_03_1920.webp`,
    caption: '栏杆边的背影让我停住了脚步。是艾。'
  },
  {
    id: 'approach',
    image: `${UNIFIED_GAME_CG_ROOT}/opening/opening_04_1920.webp`,
    caption: '她没有回头，我忽然不知道第一句话该怎么说。'
  },
  {
    id: 'first-words',
    image: `${UNIFIED_GAME_CG_ROOT}/opening/opening_05_1920.webp`,
    caption: '她把手机攥在手里，屏幕上反复亮起未读消息。我站在离她几步远的地方。'
  }
] as const

export const GAME_ROLE = {
  gameTitle: '天台十句',
  tagline: '你不需要说出十句正确的话，只需要陪一个人找到下一个安全的地方。',
  characterName: '艾',
  assistantSpeakerName: '艾',
  narratorSpeakerName: '旁白',
  playerSpeakerName: '你',
  openingMessage:
    '夜晚的天台，雨刚停。艾坐在远离门口的地面上，手机屏幕一遍遍亮起又熄灭。她没有看你，只说：“别过来。”',
  coreDescription:
    '艾是一名大学生，正在承受学业压力、网络欺凌、家庭冲突和长期孤独。她需要的是被听见、被尊重，以及有人陪她走向下一个安全的地方。'
} as const

export const WAITING_TEXTS = [
  '她低头看着手机，沉默了一会儿……',
  '风把远处的声音带上来，她像是在斟酌下一句话……',
  '她把目光从城市收回来，又很快移开……',
  '天台门后的灯闪了一下……',
  '她深吸了一口气，似乎终于愿意听你说完……'
] as const

export const SCENE_BACKGROUNDS = {
  guarded: `${UNIFIED_GAME_CG_ROOT}/state/state_guarded_1600.webp`,
  watching: `${UNIFIED_GAME_CG_ROOT}/state/state_guarded_1600.webp`,
  wavering: `${UNIFIED_GAME_CG_ROOT}/state/state_wavering_1600.webp`,
  crying: SAFE_EXIT_SEQUENCE_FRAMES[0].image,
  leaving: `${UNIFIED_GAME_CG_ROOT}/state/state_turn_back_1600.webp`
} as const

export const SCENE_MOBILE_BACKGROUNDS = {
  guarded: `${UNIFIED_GAME_CG_ROOT}/state/state_guarded_900.webp`,
  watching: `${UNIFIED_GAME_CG_ROOT}/state/state_guarded_900.webp`,
  wavering: `${UNIFIED_GAME_CG_ROOT}/state/state_wavering_900.webp`,
  crying: SAFE_EXIT_SEQUENCE_FRAMES[0].mobileImage,
  leaving: `${UNIFIED_GAME_CG_ROOT}/state/state_turn_back_900.webp`
} as const

export const CHAT_AVATAR_IMAGE = `${UNIFIED_GAME_CG_ROOT}/state/avatar_guarded_480.webp`

export const MOBILE_BACKGROUND_MEDIA_QUERY = '(max-width: 768px)'

export const GAMEPLAY_PRELOAD_IMAGES = {
  desktop: [
    SCENE_BACKGROUNDS.guarded,
    SCENE_BACKGROUNDS.wavering,
    SCENE_BACKGROUNDS.crying,
    SCENE_BACKGROUNDS.leaving,
    ...SAFE_EXIT_SEQUENCE_FRAMES.map((frame) => frame.image)
  ],
  mobile: [
    SCENE_MOBILE_BACKGROUNDS.guarded,
    SCENE_MOBILE_BACKGROUNDS.wavering,
    SCENE_MOBILE_BACKGROUNDS.crying,
    SCENE_MOBILE_BACKGROUNDS.leaving,
    ...SAFE_EXIT_SEQUENCE_FRAMES.map((frame) => frame.mobileImage)
  ]
} as const

export const MECHANIC_TAGS = {
  trustBoost: `[信任度+${GAME_RULES.trustBoostValue}]`,
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
    backgroundImage: SCENE_BACKGROUNDS.guarded,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.guarded
  },
  watching: {
    type: 'watching',
    label: '观察',
    tag: '[状态:观察]',
    backgroundImage: SCENE_BACKGROUNDS.watching,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.watching
  },
  wavering: {
    type: 'wavering',
    label: '动摇',
    tag: '[状态:动摇]',
    backgroundImage: SCENE_BACKGROUNDS.wavering,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.wavering
  },
  crying: {
    type: 'crying',
    label: '哭泣',
    tag: '[状态:哭泣]',
    backgroundImage: SCENE_BACKGROUNDS.crying,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.crying
  },
  leaving: {
    type: 'leaving',
    label: '离开',
    tag: '[状态:离开]',
    backgroundImage: SCENE_BACKGROUNDS.leaving,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.leaving
  }
} as const

export type AiStateDefinition = (typeof AI_STATES)[keyof typeof AI_STATES]
export type AiStateType = AiStateDefinition['type']

export const EMOTIONS = {
  sting: {
    type: 'sting',
    label: '刺痛',
    tag: '[情绪:刺痛]',
    backgroundImage: `${UNIFIED_GAME_CG_ROOT}/emotion/emotion_sting_1600.webp`,
    mobileBackgroundImage: `${UNIFIED_GAME_CG_ROOT}/emotion/emotion_sting_900.webp`
  },
  surprise: {
    type: 'surprise',
    label: '惊讶',
    tag: '[情绪:惊讶]',
    backgroundImage: `${UNIFIED_GAME_CG_ROOT}/emotion/emotion_surprise_1600.webp`,
    mobileBackgroundImage: `${UNIFIED_GAME_CG_ROOT}/emotion/emotion_surprise_900.webp`
  },
  soft: {
    type: 'soft',
    label: '柔软',
    tag: '[情绪:柔软]',
    backgroundImage: `${UNIFIED_GAME_CG_ROOT}/emotion/emotion_soft_1600.webp`,
    mobileBackgroundImage: `${UNIFIED_GAME_CG_ROOT}/emotion/emotion_soft_900.webp`
  },
  curiosity: {
    type: 'curiosity',
    label: '好奇',
    tag: '[情绪:好奇]',
    backgroundImage: `${UNIFIED_GAME_CG_ROOT}/emotion/emotion_curiosity_1600.webp`,
    mobileBackgroundImage: `${UNIFIED_GAME_CG_ROOT}/emotion/emotion_curiosity_900.webp`
  }
} as const

export type EmotionDefinition = (typeof EMOTIONS)[keyof typeof EMOTIONS]
export type EmotionType = EmotionDefinition['type']

export const ENDINGS = {
  safeExit: {
    type: 'end_safe_exit',
    label: '安全离开',
    tag: '[结局:安全离开]',
    achievementName: '哭过以后',
    description: '艾哭了。她抹了一下眼泪，然后和你一起离开了天台。',
    backgroundImage: SAFE_EXIT_SEQUENCE_FRAMES[2].image,
    mobileBackgroundImage: SAFE_EXIT_SEQUENCE_FRAMES[2].mobileImage
  },
  refusal: {
    type: 'end_refusal',
    label: '拒绝离开',
    tag: '[结局:拒绝离开]',
    achievementName: '仍在天台',
    description: '艾不再搭理你，拒绝离开天台。',
    backgroundImage: SCENE_BACKGROUNDS.wavering,
    mobileBackgroundImage: SCENE_MOBILE_BACKGROUNDS.wavering
  }
} as const

export type EndingDefinition = (typeof ENDINGS)[keyof typeof ENDINGS]
export type EndingType = EndingDefinition['type']

export interface EndingResolutionSnapshot {
  trust: number
  lastAssistantText?: string
  lastAiStateType?: AiStateType | null
}

// 缺少 AI 结局判定时不能把信任分数或哭泣推断为已经安全离开。
export const resolveFallbackEndingType = (_snapshot: EndingResolutionSnapshot): EndingType =>
  ENDINGS.refusal.type

export const ENDING_BY_TYPE = Object.fromEntries(
  Object.values(ENDINGS).map((ending) => [ending.type, ending])
) as Record<EndingType, EndingDefinition>

export const AI_STATE_BY_TYPE = Object.fromEntries(
  Object.values(AI_STATES).map((aiState) => [aiState.type, aiState])
) as Record<AiStateType, AiStateDefinition>

export const EMOTION_BY_TYPE = Object.fromEntries(
  Object.values(EMOTIONS).map((emotion) => [emotion.type, emotion])
) as Record<EmotionType, EmotionDefinition>

export type VisualStateSource = 'ending' | 'aiState' | 'emotion'

export interface VisualStateSnapshot {
  roundCount: number
  trust: number
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
  return aiState?.backgroundImage ?? SCENE_BACKGROUNDS.guarded
}

export const resolveWaitingMobileBackground = (visualState: ResolvedVisualState): string => {
  const aiState = visualState.aiStateType ? AI_STATE_BY_TYPE[visualState.aiStateType] : null
  return aiState?.mobileBackgroundImage ?? SCENE_MOBILE_BACKGROUNDS.guarded
}

export const deriveAiStateType = (
  snapshot: Pick<VisualStateSnapshot, 'roundCount' | 'trust'>
): AiStateType => {
  if (snapshot.trust >= GAME_RULES.maxTrust) return AI_STATES.crying.type
  if (snapshot.trust >= 10) return AI_STATES.wavering.type
  if (snapshot.trust >= 5) return AI_STATES.watching.type
  return AI_STATES.guarded.type
}

const chooseEffectiveAiState = (
  explicitState: AiStateType | null,
  derivedState: AiStateType
): AiStateType => {
  if (!explicitState) return derivedState
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
  const emotion = snapshot.emotionType ? EMOTION_BY_TYPE[snapshot.emotionType] : null

  if (
    emotion &&
    effectiveAiState !== AI_STATES.crying.type &&
    effectiveAiState !== AI_STATES.leaving.type
  ) {
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
    label: aiState.label,
    aiStateType: effectiveAiState
  }
}
