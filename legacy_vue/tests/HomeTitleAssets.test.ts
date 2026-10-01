// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { expect, it } from 'vitest'
import { HOME_TITLE } from '../src/domain/homeTitle.generated'

it('keeps the existing pixel wordmark transparent and reduces first-load image bytes', async () => {
  const root = path.resolve(import.meta.dirname, '..')
  for (const [key, url] of Object.entries(HOME_TITLE)) {
    const file = path.join(root, 'public', url)
    expect(fs.statSync(file).size).toBeLessThan(key === 'mobile' ? 50 * 1024 : 95 * 1024)
    const metadata = await sharp(file).metadata()
    expect(metadata.format).toBe('webp')
    expect(metadata.hasAlpha).toBe(true)
  }
})
