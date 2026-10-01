import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const relative = 'assets/images/home_pixel_20261001'
const folder = path.join(root, 'public', relative)
const source = path.join(folder, 'background-source.png')
const result = {}
const legacy = path.join(root, 'public/assets/images/menu_home_bg_source.png')
const legacyData = await sharp(legacy).webp({ lossless: true, effort: 6 }).toBuffer()
const legacyName = `existing-original-${createHash('sha256').update(legacyData).digest('hex').slice(0, 12)}.webp`
await fs.writeFile(path.join(folder, legacyName), legacyData)
result.existingOriginal = `/${relative}/${legacyName}`
if (!(await sharp(legacy).ensureAlpha().raw().toBuffer()).equals(
  await sharp(legacyData).ensureAlpha().raw().toBuffer())) {
  throw new Error('Existing background must also retain every source pixel')
}
for (const [name, options] of [
  ['display', { quality: 86, effort: 6 }],
  ['original', { lossless: true, effort: 6 }],
  ['preview', { quality: 70, effort: 6 }]
]) {
  let pipeline = sharp(source)
  if (name === 'preview') pipeline = pipeline.resize({ width: 480, kernel: 'nearest' })
  const data = await pipeline.webp(options).toBuffer()
  const digest = createHash('sha256').update(data).digest('hex').slice(0, 12)
  const file = `${name}-${digest}.webp`
  await fs.writeFile(path.join(folder, file), data)
  result[name] = `/${relative}/${file}`
  console.log(`${name}: ${Math.round(data.length / 1024)} KB`)
  if (name === 'original') {
    const before = await sharp(source).ensureAlpha().raw().toBuffer()
    const after = await sharp(data).ensureAlpha().raw().toBuffer()
    if (!before.equals(after)) throw new Error('Original must retain every source pixel')
  }
}
await fs.writeFile(path.join(root, 'src/domain/pixelHomeCandidate.generated.ts'),
  `// Candidate only; not the default homepage.\nexport const PIXEL_HOME_CANDIDATE = ${JSON.stringify(result, null, 2).replaceAll('"', "'")} as const\n`)

const indexPath = path.join(root, 'index.html')
let html = await fs.readFile(indexPath, 'utf8')
if (html.includes('const background = candidate ?')) {
  html = html.replace(/const background = candidate \? '[^']*'/,
    `const background = candidate ? '${result.display}'`)
} else {
  html = html.replace('const title = mobile ?',
    "const candidate = new URLSearchParams(location.search).get('homeArt') === 'pixel-candidate'\n        const title = mobile ?")
  html = html.replace("for (const href of [title, `/assets/images/menu_home_bg_${mobile ? '900' : '1600'}.webp`])",
    `const background = candidate ? '${result.display}' : \`/assets/images/menu_home_bg_\${mobile ? '900' : '1600'}.webp\`\n        for (const href of [title, background])`)
}
await fs.writeFile(indexPath, html)
