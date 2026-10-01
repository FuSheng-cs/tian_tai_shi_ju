import { expect, it, vi } from 'vitest'
import { warmOriginalCG } from '../src/modules/OriginalCgCache'
import { OPENING_SEQUENCE_FRAMES } from '../src/domain/gameContract'

it('warms original frames one at a time instead of flooding the connection', () => {
  const requests: string[] = []
  const images: Array<{ onload: () => void }> = []
  vi.stubGlobal('Image', class {
    onload = () => {}
    constructor() { images.push(this) }
    set src(url: string) { requests.push(url) }
  })
  warmOriginalCG(OPENING_SEQUENCE_FRAMES[0].image)
  warmOriginalCG(OPENING_SEQUENCE_FRAMES[1].image)
  warmOriginalCG(OPENING_SEQUENCE_FRAMES[1].image)
  expect(requests).toHaveLength(1)
  images[0]!.onload()
  expect(requests).toHaveLength(2)
  expect(requests[1]).toMatch(/opening_02_1920\.webp$/)
  images[1]!.onload()
  expect(requests).toHaveLength(2)
  vi.unstubAllGlobals()
})
