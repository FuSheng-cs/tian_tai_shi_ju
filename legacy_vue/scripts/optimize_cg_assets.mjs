import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const relative = 'assets/images/unified_image2_2026-07-31/game_cg'
const sourceRoot = path.join(root, 'public', relative)
const out = path.join(sourceRoot, 'web_20261001')
await fs.mkdir(out, { recursive: true })
const assets = {}
for (const category of ['opening', 'state', 'emotion', 'ending']) {
  for (const file of (await fs.readdir(path.join(sourceRoot, category))).sort()) {
    if (!/_(1920|1600)\.webp$/.test(file)) continue
    const stem = file.replace(/_(1920|1600)\.webp$/, '')
    const input = path.join(sourceRoot, category, file)
    const metadata = await sharp(input).metadata()
    const item = {}
    for (const [key, width, quality] of [
      ['image', metadata.width, 82],
      ['mobileImage', 900, 80],
      ['preview', 320, 60]
    ]) {
      const data = await sharp(input).resize({ width, withoutEnlargement: true, kernel: 'nearest' })
        .webp({ quality, effort: 6 }).toBuffer()
      const hash = createHash('sha256').update(data).digest('hex').slice(0, 12)
      const name = `${category}-${stem}-${key}-${hash}.webp`
      await fs.writeFile(path.join(out, name), data)
      item[key] = `/${relative}/web_20261001/${name}`
      console.log(`${category}/${stem} ${key}: ${Math.round(data.length / 1024)} KB`)
    }
    assets[`${category}/${stem}`] = item
  }
}
const code = `// Derived from existing CGs by scripts/optimize_cg_assets.mjs.\nexport const CG_ASSETS = ${JSON.stringify(assets, null, 2).replaceAll('"', "'")} as const

export const CG_PREVIEW_BY_IMAGE: Record<string, string> = Object.fromEntries(
  Object.values(CG_ASSETS).flatMap(asset => [
    [asset.image, asset.preview], [asset.mobileImage, asset.preview]
  ])
)

export const getCGPreview = (url: string) => CG_PREVIEW_BY_IMAGE[url] || ''
`
await fs.writeFile(path.join(root, 'src/domain/cgAssets.generated.ts'), code)
