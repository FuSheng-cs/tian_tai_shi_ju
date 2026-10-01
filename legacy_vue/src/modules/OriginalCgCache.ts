import { getOriginalCG } from '@/domain/originalCgQuality'

const seen = new Set<string>()
const queue: string[] = []
let active: HTMLImageElement | null = null

const runNext = () => {
  if (active) return
  const url = queue.shift()
  if (!url) return
  const image = new Image()
  active = image
  image.fetchPriority = 'low'
  image.decoding = 'async'
  const finish = () => { active = null; runNext() }
  image.onload = finish
  image.onerror = () => { seen.delete(url); finish() }
  image.src = url
}

export const warmOriginalCG = (displayUrl: string) => {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType || '')) return
  const url = getOriginalCG(displayUrl)
  if (!url || seen.has(url)) return
  seen.add(url)
  queue.push(url)
  runNext()
}
