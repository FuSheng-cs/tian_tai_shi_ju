import { expect, it } from 'vitest'
import { OPENING_SEQUENCE_FRAMES, SCENE_BACKGROUNDS } from '../src/domain/gameContract'
import { getOriginalCG } from '../src/domain/originalCgQuality'

it('upgrades both desktop and phone display versions to the original art file', () => {
  const original = '/assets/images/pixel_city_20261104/originals/opening/opening_01.webp'
  expect(getOriginalCG(OPENING_SEQUENCE_FRAMES[0].image)).toBe(original)
  expect(getOriginalCG(OPENING_SEQUENCE_FRAMES[0].mobileImage)).toBe(original)
  expect(getOriginalCG(SCENE_BACKGROUNDS.normal)).toBe(
    '/assets/images/pixel_city_20261104/originals/state/state_guarded.webp'
  )
  expect(getOriginalCG('/unrelated.webp')).toBe('')
})
