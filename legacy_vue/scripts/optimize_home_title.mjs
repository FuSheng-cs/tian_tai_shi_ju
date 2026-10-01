import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'public/assets/images/menu_title.png')
const relative = 'assets/images/home_title_20261001'
const folder = path.join(root, 'public', relative)
await fs.mkdir(folder, { recursive: true })
const assets = {}
for (const [key, width] of [['desktop', 900], ['mobile', 600]]) {
  const data = await sharp(source).resize({ width }).webp({ quality: 78, effort: 6 }).toBuffer()
  const digest = createHash('sha256').update(data).digest('hex').slice(0, 12)
  const filename = `title-${width}-${digest}.webp`
  await fs.writeFile(path.join(folder, filename), data)
  assets[key] = `/${relative}/${filename}`
  console.log(`${key}: ${Math.round(data.length / 1024)} KB`)
}
await fs.writeFile(path.join(root, 'src/domain/homeTitle.generated.ts'),
  `// Generated from the existing menu_title.png; no new artwork.\nexport const HOME_TITLE = ${JSON.stringify(assets, null, 2).replaceAll('"', "'")} as const\n`)

const indexPath = path.join(root, 'index.html')
let html = await fs.readFile(indexPath, 'utf8')
const preloads = `<!-- home-title-preloads:start -->
    <script>
      if (location.pathname === '/') {
        const mobile = matchMedia('(max-width: 768px)').matches
        const title = mobile ? '${assets.mobile}' : '${assets.desktop}'
        for (const href of [title, \`/assets/images/menu_home_bg_\${mobile ? '900' : '1600'}.webp\`]) {
          const link = document.createElement('link')
          link.rel = 'preload'
          link.as = 'image'
          link.href = href
          link.fetchPriority = 'high'
          document.head.appendChild(link)
        }
      }
    </script>
    <!-- home-title-preloads:end -->`
if (/<!-- home-title-preloads:start -->[\s\S]*?<script>/.test(html)) {
  html = html.replace(/<!-- home-title-preloads:start -->[\s\S]*?<!-- home-title-preloads:end -->/, preloads)
  // A prior version kept the old background preloader after the marker.
  html = html.replace(/(<!-- home-title-preloads:end -->)\s*<script>[\s\S]*?<\/script>/, '$1')
} else {
  html = html.replace(/<!-- home-title-preloads:start -->[\s\S]*?<!-- home-title-preloads:end -->\s*/, '')
  html = html.replace(/<script>[\s\S]*?<\/script>/, preloads)
}
html = html.replace(/^ +$/gm, '')
await fs.writeFile(indexPath, html)
