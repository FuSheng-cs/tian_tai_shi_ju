import { CG_ASSETS } from './cgAssets.generated'

const root = '/assets/images/unified_image2_2026-07-31/game_cg'
const originals: Record<string, string> = Object.fromEntries(
  Object.entries(CG_ASSETS).flatMap(([name, asset]) => {
    const original = `${root}/${name}_${name.startsWith('opening/') ? '1920' : '1600'}.webp`
    return [[asset.image, original], [asset.mobileImage, original]]
  })
)

export const getOriginalCG = (url: string) => originals[url] || ''
