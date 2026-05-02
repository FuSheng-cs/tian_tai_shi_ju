import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(process.cwd())
const OUT_DIR = path.join(ROOT, 'public', 'assets', 'images')

const ensureDir = async (p) => {
  await fs.mkdir(p, { recursive: true })
}

const writeSvg = async (name, svg) => {
  await ensureDir(OUT_DIR)
  await fs.writeFile(path.join(OUT_DIR, name), svg, 'utf8')
}

const renderSvgTo = async (name, svg, format, opts = {}) => {
  await ensureDir(OUT_DIR)
  const outPath = path.join(OUT_DIR, name)
  const img = sharp(Buffer.from(svg))

  if (format === 'webp') {
    await img.webp({ quality: 82, effort: 6, ...opts }).toFile(outPath)
    return
  }
  if (format === 'png') {
    await img.png({ compressionLevel: 9, adaptiveFiltering: true, ...opts }).toFile(outPath)
    return
  }
  throw new Error(`Unsupported format: ${format}`)
}

const bgRooftop = ({ w, h }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#05020f"/>
      <stop offset="0.55" stop-color="#0b0830"/>
      <stop offset="1" stop-color="#07060a"/>
    </linearGradient>
    <linearGradient id="neon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a855f7" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#22d3ee" stop-opacity="0.75"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${Math.max(2, Math.round(Math.min(w, h) / 300))}" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#sky)"/>

  <g opacity="0.8">
    <circle cx="${Math.round(w * 0.2)}" cy="${Math.round(h * 0.25)}" r="${Math.round(Math.min(w, h) * 0.12)}" fill="#6d28d9" opacity="0.12"/>
    <circle cx="${Math.round(w * 0.85)}" cy="${Math.round(h * 0.28)}" r="${Math.round(Math.min(w, h) * 0.18)}" fill="#0ea5e9" opacity="0.08"/>
  </g>

  <g opacity="0.95">
    <rect x="0" y="${Math.round(h * 0.62)}" width="${w}" height="${Math.round(h * 0.38)}" fill="#04040a"/>
    <g fill="#0b0b16">
      <rect x="${Math.round(w * 0.05)}" y="${Math.round(h * 0.48)}" width="${Math.round(w * 0.12)}" height="${Math.round(h * 0.52)}"/>
      <rect x="${Math.round(w * 0.20)}" y="${Math.round(h * 0.54)}" width="${Math.round(w * 0.10)}" height="${Math.round(h * 0.46)}"/>
      <rect x="${Math.round(w * 0.34)}" y="${Math.round(h * 0.44)}" width="${Math.round(w * 0.16)}" height="${Math.round(h * 0.56)}"/>
      <rect x="${Math.round(w * 0.56)}" y="${Math.round(h * 0.50)}" width="${Math.round(w * 0.11)}" height="${Math.round(h * 0.50)}"/>
      <rect x="${Math.round(w * 0.70)}" y="${Math.round(h * 0.46)}" width="${Math.round(w * 0.18)}" height="${Math.round(h * 0.54)}"/>
    </g>
  </g>

  <g opacity="0.85">
    ${Array.from({ length: 80 })
      .map((_, i) => {
        const x = (i * 997) % w
        const y = Math.round(h * 0.62 + ((i * 673) % Math.round(h * 0.33)))
        const ww = 2 + ((i * 7) % 6)
        const hh = 2 + ((i * 11) % 8)
        const o = 0.08 + ((i * 13) % 60) / 500
        const c = i % 6 === 0 ? '#a855f7' : i % 5 === 0 ? '#22d3ee' : '#f472b6'
        return `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${c}" opacity="${o}" filter="url(#glow)"/>`
      })
      .join('\n    ')}
  </g>

  <g opacity="0.92">
    <rect x="${Math.round(w * 0.12)}" y="${Math.round(h * 0.58)}" width="${Math.round(w * 0.25)}" height="${Math.round(h * 0.015)}" fill="url(#neon)" filter="url(#glow)"/>
    <rect x="${Math.round(w * 0.58)}" y="${Math.round(h * 0.60)}" width="${Math.round(w * 0.20)}" height="${Math.round(h * 0.012)}" fill="url(#neon)" filter="url(#glow)"/>
  </g>

  <g opacity="0.95">
    <rect x="0" y="${Math.round(h * 0.78)}" width="${w}" height="${Math.round(h * 0.22)}" fill="#000" opacity="0.25"/>
  </g>
</svg>`

const bgRainyStreet = ({ w, h }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0b1020"/>
      <stop offset="0.55" stop-color="#090b13"/>
      <stop offset="1" stop-color="#05060a"/>
    </linearGradient>
    <linearGradient id="wet" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#22d3ee" stop-opacity="0.28"/>
      <stop offset="0.5" stop-color="#a855f7" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#fb7185" stop-opacity="0.20"/>
    </linearGradient>
    <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${Math.max(2, Math.round(Math.min(w, h) / 260))}"/>
    </filter>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#sky)"/>

  <g opacity="0.9">
    <rect x="0" y="${Math.round(h * 0.62)}" width="${w}" height="${Math.round(h * 0.38)}" fill="#05060a"/>
    <rect x="0" y="${Math.round(h * 0.68)}" width="${w}" height="${Math.round(h * 0.32)}" fill="url(#wet)" opacity="0.7"/>
  </g>

  <g opacity="0.75" filter="url(#blur)">
    ${Array.from({ length: 16 })
      .map((_, i) => {
        const xx = Math.round((w * (i + 1)) / 18)
        const yy = Math.round(h * (0.18 + ((i * 17) % 25) / 100))
        const ww = Math.round(w * (0.05 + ((i * 29) % 10) / 100))
        const hh = Math.round(h * (0.08 + ((i * 31) % 12) / 100))
        const c = i % 3 === 0 ? '#22d3ee' : i % 3 === 1 ? '#a855f7' : '#fb7185'
        return `<rect x="${xx}" y="${yy}" width="${ww}" height="${hh}" rx="${Math.round(Math.min(24, ww / 6))}" fill="${c}" opacity="0.35"/>`
      })
      .join('\n    ')}
  </g>

  <g opacity="0.35">
    ${Array.from({ length: 220 })
      .map((_, i) => {
        const x = (i * 1499) % w
        const y = (i * 887) % h
        const len = 10 + ((i * 13) % 28)
        const sw = 1 + ((i * 7) % 2)
        return `<line x1="${x}" y1="${y}" x2="${x + Math.round(len * 0.15)}" y2="${y + len}" stroke="#8be9fd" stroke-opacity="${0.12 + ((i * 3) % 40) / 200}" stroke-width="${sw}"/>`
      })
      .join('\n    ')}
  </g>
</svg>`

const cgDeath = ({ w, h }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0a12"/>
      <stop offset="0.7" stop-color="#140517"/>
      <stop offset="1" stop-color="#000000"/>
    </linearGradient>
    <filter id="streak" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${Math.max(2, Math.round(Math.min(w, h) / 220))}"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g opacity="0.9" filter="url(#streak)">
    ${Array.from({ length: 26 })
      .map((_, i) => {
        const x = Math.round(w * 0.15 + ((i * 37) % 70) / 100 * w * 0.7)
        const y = Math.round(h * 0.05 + ((i * 53) % 80) / 100 * h * 0.9)
        const ww = Math.round(w * (0.03 + ((i * 19) % 10) / 200))
        const hh = Math.round(h * (0.12 + ((i * 23) % 30) / 100))
        const c = i % 2 === 0 ? '#ef4444' : '#a855f7'
        return `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${c}" opacity="${0.06 + ((i * 9) % 35) / 200}" transform="rotate(${12 + (i % 7) * 3} ${x} ${y})"/>`
      })
      .join('\n    ')}
  </g>
  <g opacity="0.9">
    <path d="M ${Math.round(w * 0.5)} ${Math.round(h * 0.30)}
             C ${Math.round(w * 0.47)} ${Math.round(h * 0.40)} ${Math.round(w * 0.48)} ${Math.round(h * 0.52)} ${Math.round(w * 0.52)} ${Math.round(h * 0.60)}
             C ${Math.round(w * 0.55)} ${Math.round(h * 0.68)} ${Math.round(w * 0.54)} ${Math.round(h * 0.80)} ${Math.round(w * 0.50)} ${Math.round(h * 0.88)}
             C ${Math.round(w * 0.46)} ${Math.round(h * 0.80)} ${Math.round(w * 0.45)} ${Math.round(h * 0.66)} ${Math.round(w * 0.48)} ${Math.round(h * 0.58)}
             C ${Math.round(w * 0.52)} ${Math.round(h * 0.48)} ${Math.round(w * 0.53)} ${Math.round(h * 0.38)} ${Math.round(w * 0.50)} ${Math.round(h * 0.30)} Z"
          fill="#111827" opacity="0.65"/>
  </g>
</svg>`

const cgAcquaintance = ({ w, h }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="warm" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b1020"/>
      <stop offset="0.45" stop-color="#a855f7" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#fb7185" stop-opacity="0.35"/>
    </linearGradient>
    <filter id="bokeh" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="${Math.max(3, Math.round(Math.min(w, h) / 180))}"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="#070812"/>
  <rect width="${w}" height="${h}" fill="url(#warm)" opacity="0.95"/>
  <g filter="url(#bokeh)" opacity="0.85">
    ${Array.from({ length: 40 })
      .map((_, i) => {
        const x = (i * 911) % w
        const y = (i * 677) % h
        const r = 14 + ((i * 17) % 90)
        const c = i % 4 === 0 ? '#f472b6' : i % 4 === 1 ? '#22d3ee' : i % 4 === 2 ? '#a855f7' : '#fde047'
        const o = 0.10 + ((i * 23) % 70) / 300
        return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`
      })
      .join('\n    ')}
  </g>
  <g opacity="0.55">
    <rect x="${Math.round(w * 0.10)}" y="${Math.round(h * 0.70)}" width="${Math.round(w * 0.80)}" height="${Math.round(h * 0.18)}" fill="#000" opacity="0.25"/>
  </g>
</svg>`

const charGirl = ({ w, h, mood }) => {
  const hair = '#a855f7'
  const body = '#111827'
  const skin = '#e5e7eb'
  const eye = mood === 'sad' ? 'M 0 0 C 10 6 20 6 30 0' : 'M 0 0 C 10 -4 20 -4 30 0'
  const mouth =
    mood === 'sneer'
      ? 'M 460 760 C 490 780 510 780 540 760'
      : mood === 'sad'
        ? 'M 460 780 C 490 760 510 760 540 780'
        : 'M 470 770 L 530 770'
  const cigarette =
    mood === 'smoke'
      ? `<g opacity="0.95">
           <rect x="640" y="760" width="90" height="12" rx="6" fill="#e5e7eb"/>
           <rect x="720" y="760" width="10" height="12" fill="#fb7185"/>
           <path d="M 730 745 C 760 740 770 720 750 700 C 735 685 745 670 770 660" fill="none" stroke="#cbd5e1" stroke-width="6" opacity="0.55"/>
         </g>`
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2"/>
    </filter>
  </defs>

  <g transform="translate(0,0)">
    <path d="M 360 520 C 360 410 440 320 500 320 C 560 320 640 410 640 520
             C 640 620 600 700 560 760 C 540 790 520 820 500 820 C 480 820 460 790 440 760 C 400 700 360 620 360 520 Z"
          fill="${hair}" opacity="0.85" filter="url(#soft)"/>

    <circle cx="500" cy="520" r="130" fill="${skin}" opacity="0.95"/>

    <g transform="translate(435 500)" stroke="#111827" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.9">
      <path d="${eye}"/>
    </g>
    <g transform="translate(535 500)" stroke="#111827" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.9">
      <path d="${eye}"/>
    </g>

    <path d="${mouth}" stroke="#111827" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.9"/>

    <path d="M 320 980 C 340 860 420 820 500 820 C 580 820 660 860 680 980
             C 710 1140 650 1320 500 1380 C 350 1320 290 1140 320 980 Z"
          fill="${body}" opacity="0.95"/>

    <g opacity="0.65">
      <rect x="440" y="900" width="120" height="14" rx="7" fill="#0b1020"/>
      <rect x="430" y="940" width="140" height="10" rx="5" fill="#0b1020"/>
    </g>

    ${cigarette}
  </g>
</svg>`
}

const spriteSheet = ({ frameSize, cols, rows, kind }) => {
  const W = frameSize * cols
  const H = frameSize * rows
  const mkFrame = (i) => {
    const x0 = (i % cols) * frameSize
    const y0 = Math.floor(i / cols) * frameSize
    if (kind === 'snow') {
      return Array.from({ length: 9 })
        .map((_, k) => {
          const cx = x0 + 16 + ((i * 37 + k * 19) % (frameSize - 32))
          const cy = y0 + 16 + ((i * 29 + k * 23) % (frameSize - 32))
          const r = 2 + ((i + k) % 3)
          return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e5e7eb" opacity="${0.25 + ((i + k) % 6) / 20}"/>`
        })
        .join('')
    }
    if (kind === 'rain') {
      return Array.from({ length: 10 })
        .map((_, k) => {
          const x = x0 + 10 + ((i * 41 + k * 13) % (frameSize - 20))
          const y = y0 + 8 + ((i * 17 + k * 29) % (frameSize - 40))
          const len = 16 + ((i + k) % 10)
          return `<line x1="${x}" y1="${y}" x2="${x + 4}" y2="${y + len}" stroke="#8be9fd" stroke-width="2" stroke-opacity="${0.18 + ((i + k) % 7) / 30}"/>`
        })
        .join('')
    }
    return `<g>
      <circle cx="${x0 + frameSize / 2}" cy="${y0 + frameSize / 2}" r="${20 + (i % 6) * 3}" fill="#fb7185" opacity="0.20"/>
      <path d="M ${x0 + 38} ${y0 + 92} C ${x0 + 56} ${y0 + 72} ${x0 + 74} ${y0 + 70} ${x0 + 92} ${y0 + 52}
               C ${x0 + 82} ${y0 + 68} ${x0 + 74} ${y0 + 86} ${x0 + 64} ${y0 + 104}
               C ${x0 + 78} ${y0 + 92} ${x0 + 92} ${y0 + 86} ${x0 + 106} ${y0 + 70}
               C ${x0 + 94} ${y0 + 94} ${x0 + 84} ${y0 + 112} ${x0 + 72} ${y0 + 128}
               C ${x0 + 60} ${y0 + 112} ${x0 + 50} ${y0 + 102} ${x0 + 38} ${y0 + 92} Z"
            fill="#fde047" opacity="${0.15 + (i % 8) / 40}"/>
    </g>`
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="none"/>
  ${Array.from({ length: cols * rows })
    .map((_, i) => mkFrame(i))
    .join('\n  ')}
</svg>`
}

const iconCigarette = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="none"/>
  <rect x="10" y="36" width="38" height="10" rx="5" fill="#e5e7eb"/>
  <rect x="48" y="36" width="6" height="10" fill="#fb7185"/>
  <path d="M 50 26 C 58 24 58 16 52 12 C 48 9 50 6 56 4" fill="none" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
</svg>`

const iconUmbrella = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="none"/>
  <path d="M 10 30 C 16 14 28 8 32 8 C 36 8 48 14 54 30
           C 50 26 44 26 40 30 C 36 26 28 26 24 30 C 20 26 14 26 10 30 Z"
        fill="#a855f7" opacity="0.9"/>
  <path d="M 32 10 V 44" stroke="#e5e7eb" stroke-width="4" stroke-linecap="round"/>
  <path d="M 32 44 C 32 54 38 58 44 54" stroke="#e5e7eb" stroke-width="4" stroke-linecap="round" fill="none"/>
</svg>`

const uiBtnPrimary = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="84" viewBox="0 0 320 84">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a855f7"/>
      <stop offset="1" stop-color="#22d3ee"/>
    </linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect x="8" y="10" width="304" height="64" rx="14" fill="#0b1020" opacity="0.9"/>
  <rect x="10" y="12" width="300" height="60" rx="12" fill="url(#g)" opacity="0.35" filter="url(#glow)"/>
  <rect x="10" y="12" width="300" height="60" rx="12" fill="none" stroke="#a855f7" stroke-opacity="0.55" stroke-width="2"/>
</svg>`

const uiProgressBar = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="28" viewBox="0 0 360 28">
  <rect x="1" y="1" width="358" height="26" rx="13" fill="#0b1020" opacity="0.85" stroke="#6b7280" stroke-opacity="0.6"/>
  <rect x="3" y="3" width="354" height="22" rx="11" fill="#111827" opacity="0.85"/>
  <rect x="3" y="3" width="220" height="22" rx="11" fill="#a855f7" opacity="0.7"/>
</svg>`

const main = async () => {
  await ensureDir(OUT_DIR)

  await renderSvgTo('bg_rooftop_night_1920.webp', bgRooftop({ w: 1920, h: 1080 }), 'webp')
  await renderSvgTo('bg_rooftop_night_750.webp', bgRooftop({ w: 750, h: 1334 }), 'webp')

  await renderSvgTo('bg_rainy_street_1920.webp', bgRainyStreet({ w: 1920, h: 1080 }), 'webp')
  await renderSvgTo('bg_rainy_street_750.webp', bgRainyStreet({ w: 750, h: 1334 }), 'webp')

  await renderSvgTo('cg_death_falling_16_9.webp', cgDeath({ w: 1920, h: 1080 }), 'webp')
  await renderSvgTo('cg_death_falling_9_16.webp', cgDeath({ w: 1080, h: 1920 }), 'webp')

  await renderSvgTo('cg_acquaintance_16_9.webp', cgAcquaintance({ w: 1920, h: 1080 }), 'webp')
  await renderSvgTo('cg_acquaintance_9_16.webp', cgAcquaintance({ w: 1080, h: 1920 }), 'webp')

  await renderSvgTo('char_girl_normal.png', charGirl({ w: 1000, h: 1500, mood: 'neutral' }), 'png')
  await renderSvgTo('char_girl_sneer.png', charGirl({ w: 1000, h: 1500, mood: 'sneer' }), 'png')
  await renderSvgTo('char_girl_sad.png', charGirl({ w: 1000, h: 1500, mood: 'sad' }), 'png')
  await renderSvgTo('char_girl_smoke.png', charGirl({ w: 1000, h: 1500, mood: 'smoke' }), 'png')

  await renderSvgTo('vfx_snow_sprite.webp', spriteSheet({ frameSize: 128, cols: 4, rows: 4, kind: 'snow' }), 'webp', {
    quality: 70
  })
  await renderSvgTo('vfx_rain_sprite.webp', spriteSheet({ frameSize: 128, cols: 4, rows: 4, kind: 'rain' }), 'webp', {
    quality: 70
  })
  await renderSvgTo('vfx_flame_sprite.webp', spriteSheet({ frameSize: 128, cols: 4, rows: 4, kind: 'flame' }), 'webp', {
    quality: 70
  })

  await writeSvg('icon_cigarette.svg', iconCigarette)
  await writeSvg('icon_umbrella.svg', iconUmbrella)
  await writeSvg('ui_btn_primary.svg', uiBtnPrimary)
  await writeSvg('ui_progress_bar.svg', uiProgressBar)
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e)
  process.exit(1)
})
