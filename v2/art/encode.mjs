import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

// This script only encodes generated originals; all visual edits use image generation.
const require = createRequire(import.meta.url)
let sharp
try {
  sharp = require('sharp')
} catch {
  sharp = require('../../legacy_vue/node_modules/sharp')
}

const here = dirname(fileURLToPath(import.meta.url))
for (const name of ['rooftop', 'listening', 'dawn', 'threshold', 'details/camera', 'details/receipt', 'details/door', 'details/rain']) {
  const source = resolve(here, 'originals', `${name}.png`)
  const target = resolve(here, '../web/public/art', `${name}.webp`)
  const metadata = await sharp(source).metadata()
  const output = await sharp(source).webp({ quality: 90, effort: 6 }).toFile(target)
  console.log(`${name}: ${metadata.width}×${metadata.height}; ${output.size} bytes`)
}
