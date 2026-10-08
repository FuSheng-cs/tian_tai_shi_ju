// @vitest-environment node
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, expect, it } from 'vitest'

const generator = path.resolve(import.meta.dirname, '../scripts/generate_assets.mjs')
const fixtures: string[] = []

const makeFixture = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'tiantaishiju-assets-'))
  const images = path.join(root, 'public/assets/images')
  mkdirSync(images, { recursive: true })
  fixtures.push(root)
  return { root, images }
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    const resolved = path.resolve(fixture)
    if (
      !resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith('tiantaishiju-assets-')
    ) {
      throw new Error('Refusing to remove an unexpected fixture directory')
    }
    rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
  }
})

it('preserves reviewed art and never recreates retired CGs, even when forcing rain', async () => {
  const { root, images } = makeFixture()
  const reviewed = Buffer.from('reviewed art must stay byte-for-byte unchanged')
  const artNames = ['cg_acquaintance_16_9.webp', 'char_girl_normal.png', 'char_girl_smoke.png']
  for (const name of artNames) writeFileSync(path.join(images, name), reviewed)
  const rainPath = path.join(images, 'vfx_rain_sprite.webp')
  writeFileSync(rainPath, reviewed)

  execFileSync(process.execPath, [generator], { cwd: root })
  expect(readFileSync(rainPath)).toEqual(reviewed)
  execFileSync(process.execPath, [generator, '--force'], { cwd: root })

  for (const name of artNames) expect(readFileSync(path.join(images, name))).toEqual(reviewed)
  expect(readdirSync(images).sort()).toEqual([...artNames, 'vfx_rain_sprite.webp'].sort())
  const metadata = await sharp(readFileSync(rainPath)).metadata()
  expect([metadata.width, metadata.height, metadata.format]).toEqual([512, 512, 'webp'])
})

it('creates the required rain sprite in a fresh asset directory without placeholder art', () => {
  const { root, images } = makeFixture()
  execFileSync(process.execPath, [generator], { cwd: root })
  expect(readdirSync(images)).toEqual(['vfx_rain_sprite.webp'])
})
