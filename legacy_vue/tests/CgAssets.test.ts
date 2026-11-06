// @vitest-environment node
import { statSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { CG_ASSETS } from '../src/domain/cgAssets.generated'
import { getOriginalCG } from '../src/domain/originalCgQuality'
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

it('provides each scene with the new desktop, mobile, preview, and original images', () => {
  const root = path.resolve(import.meta.dirname, '..', 'public')
  for (const asset of Object.values(CG_ASSETS)) {
    for (const url of [asset.image, asset.mobileImage, asset.preview, getOriginalCG(asset.image)]) {
      expect(url).toMatch(/^\/assets\/images\/pixel_city_20261104\//)
      expect(statSync(path.join(root, url)).size).toBeGreaterThan(0)
    }
    expect(getOriginalCG(asset.mobileImage)).toBe(getOriginalCG(asset.image))
  }
})
