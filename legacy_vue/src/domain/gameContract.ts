export const GAME_RULES = {
  initialRoundCount: 10,
  initialHintCount: 3,
  saveSlotIds: [1, 2, 3],
  affectionBoostValue: 5,
  criticalPressureRoundCount: 2,
  maxSummaryTextLength: 80
} as const

export const GAME_ENTRY_SESSION_KEY = 'damo_game_entry'
export const CHAT_AFTER_SAVE_SLOT_SESSION_KEY = 'damo_chat_after_save_slot'
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

export const OPENING_SEQUENCE_FRAMES = [
  {
    id: 'stair-door',
    image: '/assets/images/cg_opening_stair_01_16_9.webp',
    caption: '我只是想上来透口气，可门后的风声像是在提醒我：别出声。',
    chapterTitle: '序章',
    chapterMeta: '23:47 / 天台入口'
  },
  {
    id: 'door-open',
    image: '/assets/images/cg_opening_stair_02_16_9.webp',
    caption: '我推开门，雨和城市的冷光一起涌进来。'
  },
  {
    id: 'rooftop-entry',
    image: '/assets/images/cg_opening_stair_03_16_9.webp',
    caption: '栏杆边那个背影让我停住了脚步。是艾。'
  },
  {
    id: 'approach',
    image: '/assets/images/cg_opening_stair_04_16_9.webp',
    caption: '她没有回头。烟头亮了一下，我忽然不知道第一句话该怎么说。'
  },
  {
    id: 'first-words',
    image: '/assets/images/cg_opening_stair_05_16_9.webp',
    caption: '她坐在雨里，像城市忘了关掉的一盏冷灯。我把呼吸压低，怕再响一点，她就会被风带走。'
  }
] as const

export const DEATH_ENDING_SEQUENCE_FRAMES = [
  {
    id: 'fall-01-silence',
    image: '/assets/images/cg_end_fall_seq_01_1600.webp',
    mobileImage: '/assets/images/cg_end_fall_seq_01_900.webp',
    caption: '她的手从栏杆上松开，烟先一步落进雨里。',
    chapterTitle: '结局',
    chapterMeta: '坠落'
  },
  {
    id: 'fall-02-step-back',
    image: '/assets/images/cg_end_fall_seq_02_1600.webp',
    mobileImage: '/assets/images/cg_end_fall_seq_02_900.webp',
    caption: '栏杆湿得发亮，她的重心越过了最后一点边界。'
  },
  {
    id: 'fall-03-drop',
    image: '/assets/images/cg_end_fall_seq_03_1600.webp',
    mobileImage: '/assets/images/cg_end_fall_seq_03_900.webp',
    caption: '风把她的外套和头发一起托起，城市忽然远得没有尽头。'
  },
  {
    id: 'fall-04-falling-wide',
    image: '/assets/images/cg_end_fall_seq_04_1600.webp',
    mobileImage: '/assets/images/cg_end_fall_seq_04_900.webp',
    caption: '高楼的灯一层层掠过去，她变成雨夜里无法抓住的一点。'
  },
  {
    id: 'fall-05-empty-rooftop',
    image: '/assets/images/cg_end_fall_seq_05_1600.webp',
    mobileImage: '/assets/images/cg_end_fall_seq_05_900.webp',
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
  smoke: '/assets/images/char_girl_smoke_1600.webp',
  normal: '/assets/images/char_girl_normal_1600.webp',
  sad: '/assets/images/char_girl_sad_1600.webp',
  turnBack: '/assets/images/cg_pressure_turn_back_16_9.webp',
  nearJump: '/assets/images/cg_pressure_near_jump_16_9.webp'
} as const

export const SCENE_MOBILE_BACKGROUNDS = {
  smoke: '/assets/images/char_girl_smoke_900.webp',
  normal: '/assets/images/char_girl_normal_900.webp',
  sad: '/assets/images/char_girl_sad_900.webp',
  turnBack: SCENE_BACKGROUNDS.turnBack,
  nearJump: SCENE_BACKGROUNDS.nearJump
} as const

export const CHAT_AVATAR_IMAGE = '/assets/images/char_girl_sneer_480.webp'

export const GAMEPLAY_PRELOAD_IMAGES = [
  SCENE_BACKGROUNDS.smoke,
  SCENE_MOBILE_BACKGROUNDS.smoke,
  SCENE_BACKGROUNDS.normal,
  SCENE_MOBILE_BACKGROUNDS.normal,
  SCENE_BACKGROUNDS.sad,
  SCENE_MOBILE_BACKGROUNDS.sad,
  SCENE_BACKGROUNDS.turnBack,
  SCENE_BACKGROUNDS.nearJump,
  ...DEATH_ENDING_SEQUENCE_FRAMES.flatMap((frame) => [frame.image, frame.mobileImage])
] as const

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
export type AiStateLabel = AiStateDefinition['label']

export const EMOTIONS = {
  sting: {
    type: 'sting',
    label: '刺痛',
    tag: '[情绪:刺痛]',
    backgroundImage: '/assets/images/cg_emotion_sting_16_9.webp',
    mobileBackgroundImage: '/assets/images/cg_emotion_sting_16_9.webp'
  },
  surprise: {
    type: 'surprise',
    label: '惊讶',
    tag: '[情绪:惊讶]',
    backgroundImage: '/assets/images/cg_emotion_surprise_16_9.webp',
    mobileBackgroundImage: '/assets/images/cg_emotion_surprise_16_9.webp'
  },
  soft: {
    type: 'soft',
    label: '柔软',
    tag: '[情绪:柔软]',
    backgroundImage: '/assets/images/cg_emotion_soft_16_9.webp',
    mobileBackgroundImage: '/assets/images/cg_emotion_soft_16_9.webp'
  },
  curiosity: {
    type: 'curiosity',
    label: '好奇',
    tag: '[情绪:好奇]',
    backgroundImage: '/assets/images/cg_emotion_curiosity_16_9.webp',
    mobileBackgroundImage: '/assets/images/cg_emotion_curiosity_16_9.webp'
  }
} as const

export type EmotionDefinition = (typeof EMOTIONS)[keyof typeof EMOTIONS]
export type EmotionType = EmotionDefinition['type']
export type EmotionLabel = EmotionDefinition['label']

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
    backgroundImage: '/assets/images/cg_end_disappear_1600.webp',
    mobileBackgroundImage: '/assets/images/cg_end_disappear_900.webp'
  },
  acquaintance: {
    type: 'end_acquaintance',
    label: '相识',
    tag: '[结局:相识]',
    achievementName: '相识',
    backgroundImage: '/assets/images/cg_acquaintance_16_9.webp',
    mobileBackgroundImage: '/assets/images/cg_acquaintance_16_9.webp'
  }
} as const

export type EndingDefinition = (typeof ENDINGS)[keyof typeof ENDINGS]
export type EndingType = EndingDefinition['type']
export type EndingLabel = EndingDefinition['label']

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
  affection: number;
  affectionBoostCount: number;
  turnsUsed: number;
  lastAssistantText?: string;
}

const countPatternMatches = (text: string, patterns: RegExp[]) =>
  patterns.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0)

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
  const narrativeEnding = inferEndingTypeFromNarrative(snapshot.lastAssistantText ?? '')
  if (narrativeEnding) {
    return narrativeEnding
  }

  if (meetsEndingThreshold(snapshot, ENDING_THRESHOLDS.acquaintance)) {
    return ENDINGS.acquaintance.type
  }

  if (meetsEndingThreshold(snapshot, ENDING_THRESHOLDS.disappear)) {
    return ENDINGS.disappear.type
  }

  return ENDINGS.death.type
}

export const ENDING_BY_LABEL = Object.fromEntries(
  Object.values(ENDINGS).map((ending) => [ending.label, ending])
) as Record<EndingLabel, EndingDefinition>

export const ENDING_BY_TYPE = Object.fromEntries(
  Object.values(ENDINGS).map((ending) => [ending.type, ending])
) as Record<EndingType, EndingDefinition>

export const AI_STATE_BY_LABEL = Object.fromEntries(
  Object.values(AI_STATES).map((aiState) => [aiState.label, aiState])
) as Record<AiStateLabel, AiStateDefinition>

export const AI_STATE_BY_TYPE = Object.fromEntries(
  Object.values(AI_STATES).map((aiState) => [aiState.type, aiState])
) as Record<AiStateType, AiStateDefinition>

export const EMOTION_BY_LABEL = Object.fromEntries(
  Object.values(EMOTIONS).map((emotion) => [emotion.label, emotion])
) as Record<EmotionLabel, EmotionDefinition>

export const EMOTION_BY_TYPE = Object.fromEntries(
  Object.values(EMOTIONS).map((emotion) => [emotion.type, emotion])
) as Record<EmotionType, EmotionDefinition>

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const endingLabelPattern = Object.values(ENDINGS)
  .map((ending) => escapeRegExp(ending.label))
  .join('|')

const aiStateLabelPattern = Object.values(AI_STATES)
  .map((aiState) => escapeRegExp(aiState.label))
  .join('|')

const emotionLabelPattern = Object.values(EMOTIONS)
  .map((emotion) => escapeRegExp(emotion.label))
  .join('|')

export const AFFECTION_BOOST_TAG_REGEX = new RegExp(escapeRegExp(MECHANIC_TAGS.affectionBoost), 'g')
export const AI_STATE_TAG_REGEX = new RegExp(
  `${escapeRegExp(MECHANIC_TAGS.aiStatePrefix)}(${aiStateLabelPattern})${escapeRegExp(MECHANIC_TAGS.endingSuffix)}`
)
export const ANY_AI_STATE_TAG_REGEX = /\[状态:.*?\]/g
export const EMOTION_TAG_REGEX = new RegExp(
  `${escapeRegExp(MECHANIC_TAGS.emotionPrefix)}(${emotionLabelPattern})${escapeRegExp(MECHANIC_TAGS.endingSuffix)}`
)
export const ANY_EMOTION_TAG_REGEX = /\[情绪:.*?\]/g
export const ENDING_TAG_REGEX = new RegExp(
  `${escapeRegExp(MECHANIC_TAGS.endingPrefix)}(${endingLabelPattern})${escapeRegExp(MECHANIC_TAGS.endingSuffix)}`
)
export const ANY_ENDING_TAG_REGEX = /\[结局:.*?\]/

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
  roundCount: number;
  affection: number;
  isEnding: boolean;
  endingType: EndingType | null;
  aiStateType: AiStateType | null;
  emotionType: EmotionType | null;
}

export interface ResolvedVisualState {
  source: VisualStateSource;
  backgroundImage: string;
  mobileBackgroundImage: string;
  label: string;
  aiStateType: AiStateType | null;
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

export const deriveAiStateType = (snapshot: Pick<VisualStateSnapshot, 'roundCount' | 'affection'>): AiStateType => {
  if (snapshot.roundCount <= 1) return AI_STATES.edge.type
  if (snapshot.roundCount <= GAME_RULES.criticalPressureRoundCount && snapshot.affection < 20) return AI_STATES.edge.type
  if (snapshot.affection >= 15) return AI_STATES.wavering.type
  if (snapshot.affection >= 5) return AI_STATES.watching.type
  return AI_STATES.guarded.type
}

const chooseEffectiveAiState = (explicitState: AiStateType | null, derivedState: AiStateType): AiStateType => {
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
  const explicitAiState = snapshot.aiStateType && AI_STATE_BY_TYPE[snapshot.aiStateType]
    ? snapshot.aiStateType
    : null
  const effectiveAiState = chooseEffectiveAiState(explicitAiState, derivedAiState)
  const aiState = AI_STATE_BY_TYPE[effectiveAiState]
  const aiStateLabel = effectiveAiState === AI_STATES.turnBack.type ? AI_STATES.edge.label : aiState.label

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

  if (isCriticalAiStateType(effectiveAiState)) {
    return {
      source: 'aiState',
      backgroundImage: aiState.backgroundImage,
      mobileBackgroundImage: aiState.mobileBackgroundImage,
      label: aiStateLabel,
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
