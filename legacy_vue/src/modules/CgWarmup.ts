import { OPENING_SEQUENCE_FRAMES, SCENE_BACKGROUNDS, SCENE_MOBILE_BACKGROUNDS } from '@/domain/gameContract'
import { getCGPreview } from '@/domain/cgAssets.generated'

const requested = new Set<string>()
const images = new Set<HTMLImageElement>()
const requestImage = (url: string) => {
  if (!url || requested.has(url)) return
  requested.add(url)
  const image = new Image()
  images.add(image)
  image.decoding = 'async'
  image.fetchPriority = 'low'
  image.onload = () => images.delete(image)
  image.onerror = () => { images.delete(image); requested.delete(url) }
  image.src = url
}

export const warmEntryCGs = () => {
  const mobile = window.matchMedia?.('(max-width: 768px)')?.matches
  const opening = mobile ? OPENING_SEQUENCE_FRAMES[0].mobileImage : OPENING_SEQUENCE_FRAMES[0].image
  const scene = mobile ? SCENE_MOBILE_BACKGROUNDS.normal : SCENE_BACKGROUNDS.normal
  for (const url of [opening, scene]) requestImage(getCGPreview(url))
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType || '')) return
  requestImage(opening)
  requestImage(scene)
}

export const scheduleEntryCGWarmup = () => {
  if (window.requestIdleCallback) {
    const id = window.requestIdleCallback(warmEntryCGs, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(warmEntryCGs, 1500)
  return () => window.clearTimeout(id)
}
