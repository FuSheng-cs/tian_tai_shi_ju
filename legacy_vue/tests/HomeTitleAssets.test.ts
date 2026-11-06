// @vitest-environment node
import path from 'node:path'
import sharp from 'sharp'
import { expect, it } from 'vitest'

const art = path.resolve(import.meta.dirname, '../public/assets/images/pixel_city_20261104')

it('serves responsive pixel rooftop art and a matching character avatar', async () => {
  for (const width of [960, 1672]) {
    const scene = await sharp(path.join(art, `home-${width}.webp`)).metadata()
    expect(scene.width).toBe(width)
    expect(scene.format).toBe('webp')
  }
  const avatar = await sharp(path.join(art, 'avatar.webp')).metadata()
  expect([avatar.width, avatar.height, avatar.format]).toEqual([240, 240, 'webp'])
})
