import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(process.cwd())
const IMAGE_ROOT = path.join(ROOT, 'public', 'assets', 'images', 'unified_image2_2026-07-31')
const GAME_CG_ROOT = path.join(IMAGE_ROOT, 'game_cg')
const OUTPUT_WIDTH = 1920
const OUTPUT_HEIGHT = 1080
const DESKTOP_WIDTH = 1600
const DESKTOP_HEIGHT = 900
const MOBILE_WIDTH = 900
const MOBILE_HEIGHT = 506
const WEBP_OPTIONS = {
  quality: 94,
  nearLossless: true,
  smartSubsample: false,
  effort: 6
}

const candidates = [
  {
    label: 'COVER / TITLE',
    raw: 'cover/cover_key_art_background_image2_raw.png',
    output: 'cover/cover_key_art_background_1920x1080.webp'
  },
  {
    label: 'PV 01 / OPENING DOORWAY',
    raw: 'pv/pv_01_opening_doorway_image2_raw.png',
    output: 'pv/pv_01_opening_doorway_1920x1080.webp'
  },
  {
    label: 'PV 02 / GUARDED LISTENING',
    raw: 'pv/pv_02_guarded_listening_image2_raw.png',
    output: 'pv/pv_02_guarded_listening_1920x1080.webp'
  },
  {
    label: 'PV 03 / TURN BACK',
    raw: 'pv/pv_03_turn_back_image2_raw.png',
    output: 'pv/pv_03_turn_back_1920x1080.webp'
  },
  {
    label: 'CG 01 / PRESSURE EDGE',
    raw: 'cg/cg_01_pressure_edge_image2_raw.png',
    output: 'cg/cg_01_pressure_edge_1920x1080.webp'
  },
  {
    label: 'CG 02 / TURN BACK',
    raw: 'cg/cg_02_turn_back_image2_raw.png',
    output: 'cg/cg_02_turn_back_1920x1080.webp'
  },
  {
    label: 'CG 03 / END DISAPPEAR',
    raw: 'cg/cg_03_end_disappear_image2_raw.png',
    output: 'cg/cg_03_end_disappear_1920x1080.webp'
  },
  {
    label: 'CG 04 / END ACQUAINTANCE',
    raw: 'cg/cg_04_end_acquaintance_image2_raw.png',
    output: 'cg/cg_04_end_acquaintance_1920x1080.webp'
  },
  {
    label: 'CG 05 / FAILURE AFTERMATH',
    raw: 'cg/cg_05_end_failure_aftermath_image2_raw.png',
    output: 'cg/cg_05_end_failure_aftermath_1920x1080.webp'
  }
]

const openingSequenceAssets = [
  {
    label: 'OPENING 01 / STAIR DOOR',
    raw: 'game_cg/opening/opening_01_stair_door_image2_raw.png',
    output: 'game_cg/opening/opening_01_1920.webp'
  },
  {
    label: 'OPENING 02 / DOOR AJAR',
    raw: 'game_cg/opening/opening_02_door_ajar_image2_raw.png',
    output: 'game_cg/opening/opening_02_1920.webp'
  },
  {
    label: 'OPENING 03 / ROOFTOP ENTRY',
    raw: 'game_cg/opening/opening_03_rooftop_entry_image2_raw.png',
    output: 'game_cg/opening/opening_03_1920.webp'
  },
  {
    label: 'OPENING 04 / CAUTIOUS APPROACH',
    raw: 'game_cg/opening/opening_04_cautious_approach_image2_raw.png',
    output: 'game_cg/opening/opening_04_1920.webp'
  },
  {
    label: 'OPENING 05 / FIRST WORDS',
    raw: 'game_cg/state/state_guarded_normal_image2_raw.png',
    output: 'game_cg/opening/opening_05_1920.webp'
  }
]

const sceneAssets = [
  {
    label: 'STATE / SMOKE',
    raw: 'game_cg/state/state_smoke_image2_raw.png',
    outputBase: 'game_cg/state/state_smoke'
  },
  {
    label: 'STATE / GUARDED',
    raw: 'game_cg/state/state_guarded_normal_image2_raw.png',
    outputBase: 'game_cg/state/state_guarded'
  },
  {
    label: 'STATE / WAVERING',
    raw: 'game_cg/state/state_wavering_image2_raw.png',
    outputBase: 'game_cg/state/state_wavering'
  },
  {
    label: 'STATE / TURN BACK',
    raw: 'cg/cg_02_turn_back_image2_raw.png',
    outputBase: 'game_cg/state/state_turn_back'
  },
  {
    label: 'STATE / EDGE',
    raw: 'cg/cg_01_pressure_edge_image2_raw.png',
    outputBase: 'game_cg/state/state_edge'
  }
]

const emotionAssets = [
  {
    label: 'EMOTION / STING',
    raw: 'game_cg/emotion/emotion_sting_image2_raw.png',
    outputBase: 'game_cg/emotion/emotion_sting'
  },
  {
    label: 'EMOTION / SURPRISE',
    raw: 'game_cg/emotion/emotion_surprise_image2_raw.png',
    outputBase: 'game_cg/emotion/emotion_surprise'
  },
  {
    label: 'EMOTION / SOFT',
    raw: 'game_cg/emotion/emotion_soft_image2_raw.png',
    outputBase: 'game_cg/emotion/emotion_soft'
  },
  {
    label: 'EMOTION / CURIOSITY',
    raw: 'game_cg/emotion/emotion_curiosity_image2_raw.png',
    outputBase: 'game_cg/emotion/emotion_curiosity'
  }
]

const endingAssets = [
  {
    label: 'ENDING / DEATH 01',
    raw: 'game_cg/ending/death_01_camera_lowered_image2_raw.png',
    outputBase: 'game_cg/ending/death_01'
  },
  {
    label: 'ENDING / DEATH 02',
    raw: 'game_cg/ending/death_02_camera_on_floor_image2_raw.png',
    outputBase: 'game_cg/ending/death_02'
  },
  {
    label: 'ENDING / DEATH 03',
    raw: 'game_cg/ending/death_03_empty_low_image2_raw.png',
    outputBase: 'game_cg/ending/death_03'
  },
  {
    label: 'ENDING / DEATH 04',
    raw: 'game_cg/ending/death_04_empty_wide_image2_raw.png',
    outputBase: 'game_cg/ending/death_04'
  },
  {
    label: 'ENDING / DEATH 05',
    raw: 'cg/cg_05_end_failure_aftermath_image2_raw.png',
    outputBase: 'game_cg/ending/death_05'
  },
  {
    label: 'ENDING / DISAPPEAR',
    raw: 'cg/cg_03_end_disappear_image2_raw.png',
    outputBase: 'game_cg/ending/end_disappear'
  },
  {
    label: 'ENDING / ACQUAINTANCE',
    raw: 'cg/cg_04_end_acquaintance_image2_raw.png',
    outputBase: 'game_cg/ending/end_acquaintance'
  }
]

const responsiveAssets = [...sceneAssets, ...emotionAssets, ...endingAssets]

const escapeXml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const standardize = (inputPath, width = OUTPUT_WIDTH, height = OUTPUT_HEIGHT) =>
  sharp(inputPath).resize(width, height, {
    fit: 'cover',
    position: 'centre',
    kernel: sharp.kernel.nearest
  })

const buildStandardizedCandidates = async () => {
  for (const candidate of candidates) {
    const inputPath = path.join(IMAGE_ROOT, candidate.raw)
    const outputPath = path.join(IMAGE_ROOT, candidate.output)

    await standardize(inputPath).webp(WEBP_OPTIONS).toFile(outputPath)
  }
}

const buildTitleCover = async () => {
  const backgroundPath = path.join(IMAGE_ROOT, candidates[0].raw)
  const titlePath = path.join(ROOT, 'public', 'assets', 'images', 'menu_title.png')
  const titleBuffer = await sharp(titlePath)
    .resize({
      width: 900,
      kernel: sharp.kernel.nearest,
      withoutEnlargement: true
    })
    .png()
    .toBuffer()
  const backgroundBuffer = await standardize(backgroundPath).png().toBuffer()
  const compositeBuffer = await sharp(backgroundBuffer)
    .composite([
      {
        input: titleBuffer,
        left: 330,
        top: 130
      }
    ])
    .png()
    .toBuffer()
  const pngPath = path.join(IMAGE_ROOT, 'cover', 'cover_key_art_title_1920x1080.png')
  const webpPath = path.join(IMAGE_ROOT, 'cover', 'cover_key_art_title_1920x1080.webp')

  await sharp(compositeBuffer).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(pngPath)
  await sharp(compositeBuffer).webp(WEBP_OPTIONS).toFile(webpPath)
}

const buildOpeningSequence = async () => {
  for (const asset of openingSequenceAssets) {
    const inputPath = path.join(IMAGE_ROOT, asset.raw)
    const outputPath = path.join(IMAGE_ROOT, asset.output)

    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await standardize(inputPath).webp(WEBP_OPTIONS).toFile(outputPath)
  }
}

const buildResponsiveAssets = async () => {
  for (const asset of responsiveAssets) {
    const inputPath = path.join(IMAGE_ROOT, asset.raw)
    const desktopPath = path.join(IMAGE_ROOT, `${asset.outputBase}_1600.webp`)
    const mobilePath = path.join(IMAGE_ROOT, `${asset.outputBase}_900.webp`)

    await fs.mkdir(path.dirname(desktopPath), { recursive: true })
    await standardize(inputPath, DESKTOP_WIDTH, DESKTOP_HEIGHT)
      .webp(WEBP_OPTIONS)
      .toFile(desktopPath)
    await standardize(inputPath, MOBILE_WIDTH, MOBILE_HEIGHT).webp(WEBP_OPTIONS).toFile(mobilePath)
  }
}

const buildAvatar = async () => {
  const inputPath = path.join(IMAGE_ROOT, 'game_cg/state/state_guarded_normal_image2_raw.png')
  const outputPath = path.join(GAME_CG_ROOT, 'state', 'avatar_guarded_480.webp')

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await sharp(inputPath)
    .extract({ left: 820, top: 70, width: 760, height: 760 })
    .resize(480, 480, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.nearest
    })
    .webp(WEBP_OPTIONS)
    .toFile(outputPath)
}

const buildContactSheet = async () => {
  const columns = 3
  const rows = 3
  const gap = 24
  const cellWidth = 600
  const imageWidth = 560
  const imageHeight = 315
  const labelHeight = 48
  const cellHeight = imageHeight + labelHeight
  const canvasWidth = columns * cellWidth + (columns + 1) * gap
  const canvasHeight = rows * cellHeight + (rows + 1) * gap
  const composite = []

  for (const [index, candidate] of candidates.entries()) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const left = gap + column * (cellWidth + gap) + Math.floor((cellWidth - imageWidth) / 2)
    const top = gap + row * (cellHeight + gap)
    const sourcePath =
      index === 0
        ? path.join(IMAGE_ROOT, 'cover', 'cover_key_art_title_1920x1080.png')
        : path.join(IMAGE_ROOT, candidate.output)
    const imageBuffer = await sharp(sourcePath)
      .resize(imageWidth, imageHeight, {
        fit: 'cover',
        position: 'centre',
        kernel: sharp.kernel.nearest
      })
      .png()
      .toBuffer()
    const labelSvg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${labelHeight}">
        <rect width="${imageWidth}" height="${labelHeight}" fill="#17191d"/>
        <text
          x="16"
          y="31"
          fill="#d7d9df"
          font-family="Segoe UI, Arial, sans-serif"
          font-size="18"
          font-weight="600"
          letter-spacing="0.4"
        >${escapeXml(candidate.label)}</text>
      </svg>
    `)

    composite.push({ input: imageBuffer, left, top })
    composite.push({ input: labelSvg, left, top: top + imageHeight })
  }

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: '#0d0f12'
    }
  })
    .composite(composite)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(IMAGE_ROOT, 'review_contact_sheet.png'))
}

const buildLabeledContactSheet = async ({ items, columns, outputPath }) => {
  const rows = Math.ceil(items.length / columns)
  const gap = 20
  const cellWidth = 480
  const imageWidth = 450
  const imageHeight = 253
  const labelHeight = 44
  const cellHeight = imageHeight + labelHeight
  const canvasWidth = columns * cellWidth + (columns + 1) * gap
  const canvasHeight = rows * cellHeight + (rows + 1) * gap
  const composite = []

  for (const [index, item] of items.entries()) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const left = gap + column * (cellWidth + gap) + Math.floor((cellWidth - imageWidth) / 2)
    const top = gap + row * (cellHeight + gap)
    const imageBuffer = await sharp(path.join(IMAGE_ROOT, item.source))
      .resize(imageWidth, imageHeight, {
        fit: 'cover',
        position: 'centre',
        kernel: sharp.kernel.nearest
      })
      .png()
      .toBuffer()
    const labelSvg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${labelHeight}">
        <rect width="${imageWidth}" height="${labelHeight}" fill="#17191d"/>
        <text
          x="14"
          y="29"
          fill="#d7d9df"
          font-family="Segoe UI, Arial, sans-serif"
          font-size="16"
          font-weight="600"
          letter-spacing="0.35"
        >${escapeXml(item.label)}</text>
      </svg>
    `)

    composite.push({ input: imageBuffer, left, top })
    composite.push({ input: labelSvg, left, top: top + imageHeight })
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: '#0d0f12'
    }
  })
    .composite(composite)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outputPath)
}

const buildProductionContactSheets = async () => {
  const gameplayPath = path.join(GAME_CG_ROOT, 'review_gameplay_states.png')
  const cinematicsPath = path.join(GAME_CG_ROOT, 'review_cinematics.png')
  const docsRoot = path.resolve(ROOT, '..', 'docs', 'art_review_2026-07-31')
  const gameplayItems = [...sceneAssets, ...emotionAssets].map((asset) => ({
    label: asset.label,
    source: `${asset.outputBase}_1600.webp`
  }))
  const cinematicItems = [
    ...openingSequenceAssets.map((asset) => ({
      label: asset.label,
      source: asset.output
    })),
    ...endingAssets.map((asset) => ({
      label: asset.label,
      source: `${asset.outputBase}_1600.webp`
    }))
  ]

  await buildLabeledContactSheet({
    items: gameplayItems,
    columns: 3,
    outputPath: gameplayPath
  })
  await buildLabeledContactSheet({
    items: cinematicItems,
    columns: 4,
    outputPath: cinematicsPath
  })
  await fs.mkdir(docsRoot, { recursive: true })
  await fs.copyFile(gameplayPath, path.join(docsRoot, 'contact_unified_gameplay_cg.png'))
  await fs.copyFile(cinematicsPath, path.join(docsRoot, 'contact_unified_cinematics.png'))
}

const measureColor = async (sourcePath) => {
  const { data, info } = await sharp(sourcePath)
    .resize(480, 270, {
      fit: 'cover',
      position: 'centre',
      kernel: sharp.kernel.nearest
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let colored = 0
  let stronglyColored = 0
  const total = info.width * info.height

  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset]
    const green = data[offset + 1]
    const blue = data[offset + 2]
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue)

    if (spread >= 8) colored += 1
    if (spread >= 24) stronglyColored += 1
  }

  return {
    coloredPixelRatio: Number((colored / total).toFixed(4)),
    strongColoredPixelRatio: Number((stronglyColored / total).toFixed(4))
  }
}

const writeMetrics = async () => {
  const metrics = []

  for (const [index, candidate] of candidates.entries()) {
    const sourcePath =
      index === 0
        ? path.join(IMAGE_ROOT, 'cover', 'cover_key_art_title_1920x1080.png')
        : path.join(IMAGE_ROOT, candidate.output)
    const metadata = await sharp(sourcePath).metadata()
    const color = await measureColor(sourcePath)

    metrics.push({
      filename: index === 0 ? 'cover/cover_key_art_title_1920x1080.png' : candidate.output,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      aspectRatio: Number((metadata.width / metadata.height).toFixed(4)),
      ...color
    })
  }

  await fs.writeFile(
    path.join(IMAGE_ROOT, 'asset_metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8'
  )
}

const writeProductionMetrics = async () => {
  const filenames = [
    ...openingSequenceAssets.map((asset) => asset.output),
    ...responsiveAssets.flatMap((asset) => [
      `${asset.outputBase}_1600.webp`,
      `${asset.outputBase}_900.webp`
    ]),
    'game_cg/state/avatar_guarded_480.webp'
  ]
  const metrics = []

  for (const filename of filenames) {
    const sourcePath = path.join(IMAGE_ROOT, filename)
    const metadata = await sharp(sourcePath).metadata()
    const color = await measureColor(sourcePath)

    metrics.push({
      filename,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      aspectRatio: Number((metadata.width / metadata.height).toFixed(4)),
      ...color
    })
  }

  await fs.writeFile(
    path.join(GAME_CG_ROOT, 'asset_metrics.json'),
    `${JSON.stringify(metrics, null, 2)}\n`,
    'utf8'
  )
}

const main = async () => {
  await buildStandardizedCandidates()
  await buildTitleCover()
  await buildContactSheet()
  await writeMetrics()
  await buildOpeningSequence()
  await buildResponsiveAssets()
  await buildAvatar()
  await buildProductionContactSheets()
  await writeProductionMetrics()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
