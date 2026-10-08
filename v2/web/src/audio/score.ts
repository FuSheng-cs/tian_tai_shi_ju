/** Original composition for 天台十句 V2: 《没有关严的门》. */
export type AmbientPhase = 'arrival' | 'listening' | 'threshold' | 'dawn'

export const SCORE_TITLE = '没有关严的门'
export const PHRASE_OPENING_SECONDS = 4.8
export const PHRASE_RESTS_SECONDS = [34, 39, 32, 43] as const
export const PHRASE_OFFSETS_SECONDS = [0, 2.8, 6.9] as const
export const PHRASE_VELOCITIES = [0.072, 0.046, 0.058] as const
export const KEY_ATTACK_SECONDS = 0.085
export const KEY_TAIL_SECONDS = 9
export const KEY_PARTIALS = [
  { ratio: 1, level: 1, tail: 9 },
  { ratio: 2, level: 0.19, tail: 4.2 },
  { ratio: 3, level: 0.055, tail: 2.1 },
] as const
export const DRONE_DETUNE = [-1.7, 1.3, 1.8, -1.1] as const
export const DRONE_PAN = [-0.22, 0.2, -0.1, 0.12] as const
export const DRONE_LEVELS = [0.022, 0.01, 0.008, 0.007] as const
export const ROOM_TAPS = [
  { seconds: 0.139, level: 0.13, pan: -0.4 },
  { seconds: 0.227, level: 0.085, pan: 0.36 },
  { seconds: 0.353, level: 0.045, pan: -0.12 },
] as const
export const PHASE_TRANSITION_SECONDS = 9

export interface PhaseScore {
  chord: readonly number[]
  phrases: readonly (readonly number[])[]
  music: number
  rain: number
  rainLowpass: number
}

/** Phases follow dramatic pacing, not a claim that the character has moved. */
export const PHASE_SCORE: Record<AmbientPhase, PhaseScore> = {
  arrival: {
    chord: [123.4708, 184.9972, 246.9417, 277.1826],
    phrases: [
      [369.9944, 277.1826, 246.9417],
      [277.1826, 369.9944, 329.6276],
    ],
    music: 0.8,
    rain: 1,
    rainLowpass: 3900,
  },
  listening: {
    chord: [123.4708, 184.9972, 293.6648, 329.6276],
    phrases: [
      [369.9944, 293.6648, 329.6276],
      [329.6276, 246.9417, 293.6648],
    ],
    music: 0.65,
    rain: 0.92,
    rainLowpass: 3300,
  },
  threshold: {
    chord: [146.8324, 220, 277.1826, 329.6276],
    phrases: [
      [329.6276, 277.1826, 369.9944],
      [277.1826, 220, 329.6276],
    ],
    music: 0.82,
    rain: 0.78,
    rainLowpass: 2600,
  },
  dawn: {
    chord: [146.8324, 220, 277.1826, 329.6276],
    phrases: [
      [369.9944, 329.6276, 277.1826],
      [329.6276, 277.1826, 220],
    ],
    music: 0.88,
    rain: 0.62,
    rainLowpass: 2200,
  },
}

export function phraseFor(phase: AmbientPhase, position: number): readonly number[] {
  const phrases = PHASE_SCORE[phase].phrases
  return phrases[position % phrases.length]!
}

/** Shared by runtime and offline render so timing and phrasing cannot drift. */
export function nextPhraseDelay(position: number): number {
  return PHRASE_RESTS_SECONDS[position % PHRASE_RESTS_SECONDS.length]!
}
