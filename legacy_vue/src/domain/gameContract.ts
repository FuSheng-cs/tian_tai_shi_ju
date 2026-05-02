export const GAME_RULES = {
  initialRoundCount: 10,
  initialHintCount: 3,
  saveSlotIds: [1, 2, 3],
  affectionBoostValue: 5,
  criticalPressureRoundCount: 2,
  maxSummaryTextLength: 80
} as const

export const GAME_ENTRY_SESSION_KEY = 'damo_game_entry'
export const ROOFTOP_BGM_SRC = '/assets/audio/bgm_rooftop.mp3'

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

export const GAME_ROLE = {
  gameTitle: '天台十句',
  characterName: '艾',
  assistantSpeakerName: '神秘女孩',
  narratorSpeakerName: '旁白',
  playerSpeakerName: '你',
  openingMessage:
    '夜晚的天台，微风吹过。霓虹灯的色彩在她的头发上跳跃。她坐在围栏上，指间的香烟忽明忽暗。你记得她，那个在夜色中游荡的摄影师。',
  coreDescription:
    '艾是紫色内染发的独立摄影师，长期看见别人却很少被真正看见。她需要的是具体倾听、尊重边界和愿意停留，而不是居高临下的说教。'
} as const

export const WAITING_TEXTS = [
  '她吐了一口烟圈……',
  '风太大了，她没听清……',
  '她在看着你的眼睛发呆……',
  '霓虹灯在她脸上闪烁……',
  '她轻轻弹了弹烟灰……'
] as const

export const SCENE_BACKGROUNDS = {
  smoke: '/assets/images/char_girl_smoke.png',
  normal: '/assets/images/char_girl_normal.png',
  sad: '/assets/images/char_girl_sad.png',
  turnBack: '/assets/images/cg_pressure_turn_back_16_9.webp',
  nearJump: '/assets/images/cg_pressure_near_jump_16_9.webp'
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
    backgroundImage: SCENE_BACKGROUNDS.smoke
  },
  watching: {
    type: 'watching',
    label: '观察',
    tag: '[状态:观察]',
    backgroundImage: SCENE_BACKGROUNDS.normal
  },
  wavering: {
    type: 'wavering',
    label: '动摇',
    tag: '[状态:动摇]',
    backgroundImage: SCENE_BACKGROUNDS.sad
  },
  turnBack: {
    type: 'turnBack',
    label: '回身',
    tag: '[状态:回身]',
    backgroundImage: SCENE_BACKGROUNDS.turnBack
  },
  edge: {
    type: 'edge',
    label: '临界',
    tag: '[状态:临界]',
    backgroundImage: SCENE_BACKGROUNDS.nearJump
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
    backgroundImage: '/assets/images/cg_emotion_sting_16_9.webp'
  },
  surprise: {
    type: 'surprise',
    label: '惊讶',
    tag: '[情绪:惊讶]',
    backgroundImage: '/assets/images/cg_emotion_surprise_16_9.webp'
  },
  soft: {
    type: 'soft',
    label: '柔软',
    tag: '[情绪:柔软]',
    backgroundImage: '/assets/images/cg_emotion_soft_16_9.webp'
  },
  curiosity: {
    type: 'curiosity',
    label: '好奇',
    tag: '[情绪:好奇]',
    backgroundImage: '/assets/images/cg_emotion_curiosity_16_9.webp'
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
    backgroundImage: '/assets/images/cg_end_fall.png'
  },
  disappear: {
    type: 'end_disappear',
    label: '消失',
    tag: '[结局:消失]',
    achievementName: '消失',
    backgroundImage: '/assets/images/cg_end_disappear.png'
  },
  acquaintance: {
    type: 'end_acquaintance',
    label: '相识',
    tag: '[结局:相识]',
    achievementName: '相识',
    backgroundImage: '/assets/images/cg_acquaintance_16_9.webp'
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
  label: string;
  aiStateType: AiStateType | null;
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
  if (explicitState === AI_STATES.turnBack.type) return explicitState
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

  if (effectiveAiState === AI_STATES.edge.type || effectiveAiState === AI_STATES.turnBack.type) {
    return {
      source: 'aiState',
      backgroundImage: aiState.backgroundImage,
      label: aiState.label,
      aiStateType: effectiveAiState
    }
  }

  const emotion = snapshot.emotionType ? EMOTION_BY_TYPE[snapshot.emotionType] : null
  if (emotion) {
    return {
      source: 'emotion',
      backgroundImage: emotion.backgroundImage,
      label: emotion.label,
      aiStateType: effectiveAiState
    }
  }

  return {
    source: 'aiState',
    backgroundImage: aiState.backgroundImage,
    label: aiState.label,
    aiStateType: effectiveAiState
  }
}
