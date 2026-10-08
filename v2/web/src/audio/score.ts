/** Original composition for 天台十句 V2: 《没有关严的门》. */
export type AmbientPhase = 'arrival' | 'listening' | 'threshold' | 'dawn'

export const SCORE_TITLE = '没有关严的门'
export const BELL_PHRASE = [
  369.9944, 277.1826, 329.6276, 246.9417, 493.8833, 369.9944, 329.6276, 277.1826,
] as const
export const BELL_RESTS_MS = [6900, 9300, 7800, 11500, 8400, 10200, 7200, 12800] as const
export const DRONE_DETUNE = [-2.4, 1.8, 2.1, -1.6] as const
export const DRONE_PAN = [-0.24, 0.23, -0.13, 0.15] as const

export const PHASE_SCORE: Record<
  AmbientPhase,
  {
    chord: readonly number[]
    music: number
    rain: number
  }
> = {
  arrival: {
    chord: [123.4708, 184.9972, 246.9417, 277.1826],
    music: 1,
    rain: 1,
  },
  listening: {
    chord: [123.4708, 184.9972, 293.6648, 329.6276],
    music: 0.82,
    rain: 0.9,
  },
  threshold: {
    chord: [146.8324, 220, 277.1826, 329.6276],
    music: 0.94,
    rain: 0.72,
  },
  dawn: {
    chord: [146.8324, 220, 277.1826, 329.6276],
    music: 1.04,
    rain: 0.5,
  },
}
