// @vitest-environment node
import { statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { OPENING_SEQUENCE_FRAMES, SCENE_BACKGROUNDS } from '../src/domain/gameContract'

it('does not make first-time players download megabyte CGs, including on phones', async () => {
  const root = path.resolve(import.meta.dirname, '..', 'public')
  for (const frame of OPENING_SEQUENCE_FRAMES as readonly { image: string; mobileImage?: string }[]) {
    expect(statSync(path.join(root, frame.image)).size).toBeLessThan(260 * 1024)
    expect(frame.mobileImage).toBeTruthy()
    expect(statSync(path.join(root, frame.mobileImage!)).size).toBeLessThan(110 * 1024)
    expect((await sharp(path.join(root, frame.mobileImage!)).metadata()).width).toBeLessThanOrEqual(900)
  }
  expect(statSync(path.join(root, SCENE_BACKGROUNDS.normal)).size).toBeLessThan(230 * 1024)
})
