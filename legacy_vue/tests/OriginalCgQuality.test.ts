import { expect, it } from 'vitest'
import { OPENING_SEQUENCE_FRAMES, SCENE_BACKGROUNDS } from '../src/domain/gameContract'
import { getOriginalCG } from '../src/domain/originalCgQuality'

it('upgrades both desktop and phone display versions to the original art file', () => {
  const original = '/assets/images/unified_image2_2026-07-31/game_cg/opening/opening_01_1920.webp'
  expect(getOriginalCG(OPENING_SEQUENCE_FRAMES[0].image)).toBe(original)
  expect(getOriginalCG(OPENING_SEQUENCE_FRAMES[0].mobileImage)).toBe(original)
  expect(getOriginalCG(SCENE_BACKGROUNDS.normal)).toBe(
    '/assets/images/unified_image2_2026-07-31/game_cg/state/state_guarded_1600.webp'
  )
  expect(getOriginalCG('/unrelated.webp')).toBe('')
})
