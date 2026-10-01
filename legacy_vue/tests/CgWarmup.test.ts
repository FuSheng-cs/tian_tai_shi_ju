import { expect, it, vi } from 'vitest'
import { warmEntryCGs } from '../src/modules/CgWarmup'
import { OPENING_SEQUENCE_FRAMES, SCENE_BACKGROUNDS, DEATH_ENDING_SEQUENCE_FRAMES } from '../src/domain/gameContract'

it('prepares only entry images once, without pulling later cinematic scenes', () => {
  const requests: string[] = []
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  vi.stubGlobal('Image', class { set src(url: string) { requests.push(url) } })
  warmEntryCGs()
  warmEntryCGs()
  expect(requests).toContain(OPENING_SEQUENCE_FRAMES[0].mobileImage)
  expect(requests.filter(url => url === OPENING_SEQUENCE_FRAMES[0].mobileImage)).toHaveLength(1)
  expect(requests).not.toContain(DEATH_ENDING_SEQUENCE_FRAMES[0].mobileImage)
  expect(requests).not.toContain(SCENE_BACKGROUNDS.nearJump)
  vi.unstubAllGlobals()
})
