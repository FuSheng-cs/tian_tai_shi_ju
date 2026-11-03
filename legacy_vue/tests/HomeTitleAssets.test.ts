// @vitest-environment node
import path from 'node:path'
import sharp from 'sharp'
import { expect, it } from 'vitest'

const art = path.resolve(import.meta.dirname, '../public/assets/images/homepage_20261029')

it('serves responsive rooftop art and a transparent title with a matching fallback', async () => {
  for (const width of [960, 1672]) {
    const scene = await sharp(path.join(art, `rooftop-${width}.webp`)).metadata()
    expect(scene.width).toBe(width)
    expect(scene.format).toBe('webp')
  }
  for (const format of ['webp', 'png']) {
    const title = await sharp(path.join(art, `title-expanded-v1.${format}`)).metadata()
    expect([title.width, title.height, title.format, title.hasAlpha]).toEqual([2172, 724, format, true])
  }
})
