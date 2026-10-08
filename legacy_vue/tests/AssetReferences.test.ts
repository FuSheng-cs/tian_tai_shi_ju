// @vitest-environment node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import * as gameContract from '../src/domain/gameContract'
import { CG_ASSETS } from '../src/domain/cgAssets.generated'
import { getOriginalCG } from '../src/domain/originalCgQuality'

const root = path.resolve(import.meta.dirname, '..')
const publicRoot = path.join(root, 'public')

const collectAssetUrls = (value: unknown, urls: Set<string>) => {
  if (typeof value === 'string' && value.startsWith('/assets/images/')) {
    urls.add(value)
  } else if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) collectAssetUrls(nested, urls)
  }
}

const collectSourceUrls = (directory: string, urls: Set<string>) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      collectSourceUrls(file, urls)
    } else if (/\.(vue|ts|css|html)$/.test(entry.name)) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(
        /['"`](\/assets\/images\/[^'"`\s]+\.(?:png|webp|svg))['"`]/g
      )) urls.add(match[1]!)
    }
  }
}

it('keeps every game, homepage and original-quality asset available after cleanup', () => {
  const urls = new Set<string>()
  collectAssetUrls(gameContract, urls)
  collectAssetUrls(CG_ASSETS, urls)
  collectSourceUrls(path.join(root, 'src'), urls)
  for (const asset of Object.values(CG_ASSETS)) {
    const original = getOriginalCG(asset.image)
    expect(original).not.toBe('')
    urls.add(original)
  }
  for (const url of urls) {
    expect(statSync(path.join(publicRoot, url)).isFile(), url).toBe(true)
  }
})

it('preserves the source art used by the homepage and unified CG build scripts', () => {
  expect(statSync(path.join(publicRoot, 'assets/images/menu_home_bg_source.png')).isFile())
    .toBe(true)
  const generator = readFileSync(path.join(root, 'scripts/build_unified_image2_candidates.mjs'),
    'utf8')
  for (const match of generator.matchAll(/raw:\s*'([^']+)'/g)) {
    const source = path.join(publicRoot, 'assets/images/unified_image2_2026-07-31', match[1]!)
    expect(statSync(source).isFile(), source).toBe(true)
  }
})
