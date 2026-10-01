// @vitest-environment node
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

it('serves small WOFF2 UI fonts without requesting the full TTF', () => {
  const root = path.resolve(import.meta.dirname, '..')
  const style = readFileSync(path.join(root, 'src/style.css'), 'utf8')
  expect(style).not.toContain('HYPixel11pxU-2.ttf')
  const css = readFileSync(path.join(root, 'src/fonts.generated.css'), 'utf8')
  const fonts = [...css.matchAll(/url\("([^\"]+)"\)/g)].map((match) => match[1]!)
  expect(fonts).toHaveLength(2)
  const sizes = fonts.map((url) => statSync(path.join(root, 'public', url)).size)
  expect(sizes[0]).toBeLessThan(50 * 1024)
  expect(sizes.reduce((sum, size) => sum + size, 0)).toBeLessThan(500 * 1024)
  expect(css).toContain('font-display: swap')
})
