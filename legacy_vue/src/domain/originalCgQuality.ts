import { CG_ASSETS } from './cgAssets.generated'

const root = '/assets/images/pixel_city_20261104/originals'
const originals: Record<string, string> = Object.fromEntries(
  Object.entries(CG_ASSETS).flatMap(([name, asset]) => {
    const original = `${root}/${name}.webp`
    return [[asset.image, original], [asset.mobileImage, original]]
  })
)

export const getOriginalCG = (url: string) => originals[url] || ''
