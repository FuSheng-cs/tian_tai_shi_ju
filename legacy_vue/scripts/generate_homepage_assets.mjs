import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const directory = path.join(root, 'public/assets/images/homepage_20261029')
const source = path.join(directory, 'rooftop-source.png')

for (const width of [1672, 960]) {
  const output = path.join(directory, `rooftop-${width}.webp`)
  const result = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6 })
    .toFile(output)
  console.log(`${path.relative(root, output)}: ${result.width}×${result.height}, ${result.size} bytes`)
}

// Keep the reviewed PNG intact; the lossless derivative retains its transparent particle edges.
const titleOutput = path.join(directory, 'title-expanded-v1.webp')
const title = await sharp(path.join(directory, 'title-expanded-v1.png'))
  .webp({ lossless: true, alphaQuality: 100, effort: 6 })
  .toFile(titleOutput)
console.log(`${path.relative(root, titleOutput)}: ${title.width}×${title.height}, ${title.size} bytes`)
