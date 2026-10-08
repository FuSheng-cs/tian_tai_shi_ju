#!/usr/bin/env node
/**
 * Reproducible original-score renderer. Requires Node 24+ and ffmpeg.
 * Run from any directory: node v2/audio/render-score.mjs
 * The browser and this renderer share notes, rests, voicings and scene dynamics.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  DRONE_DETUNE, DRONE_LEVELS, DRONE_PAN, KEY_ATTACK_SECONDS, KEY_PARTIALS,
  KEY_TAIL_SECONDS, nextPhraseDelay, PHASE_SCORE, PHASE_TRANSITION_SECONDS,
  PHRASE_OFFSETS_SECONDS, PHRASE_OPENING_SECONDS, PHRASE_VELOCITIES, phraseFor,
  ROOM_TAPS, SCORE_TITLE,
} from '../web/src/audio/score.ts'

const outputDirectory = dirname(fileURLToPath(import.meta.url))
const sampleRate = 48000
const duration = 192
const frames = sampleRate * duration
const tau = Math.PI * 2
const sections = [
  { phase: 'arrival', start: 0 },
  { phase: 'listening', start: 48 },
  { phase: 'threshold', start: 96 },
  { phase: 'dawn', start: 144 },
]
const ffmpeg = process.env.AUDIO_FFMPEG || 'ffmpeg'

function command(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${executable} failed:\n${result.stderr}`)
  return { stdout: result.stdout, stderr: result.stderr }
}

function biquad(type, frequency, q) {
  const omega = tau * frequency / sampleRate
  const cosine = Math.cos(omega)
  const alpha = Math.sin(omega) / (2 * q)
  const denominator = 1 + alpha
  const direction = type === 'lowpass' ? 1 : -1
  const b0 = (1 - direction * cosine) / (2 * denominator)
  const b1 = direction * 2 * b0
  const b2 = b0
  const a1 = -2 * cosine / denominator
  const a2 = (1 - alpha) / denominator
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  return (input) => {
    const result = b0 * input + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = input; y2 = y1; y1 = result
    return result
  }
}

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

function stereoPosition(pan) {
  const angle = (pan + 1) * Math.PI / 4
  return [Math.cos(angle), Math.sin(angle)]
}

function writeWave(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(36 + samples.length * 2, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(2, 22)
  bytes.writeUInt32LE(sampleRate, 24)
  bytes.writeUInt32LE(sampleRate * 4, 28)
  bytes.writeUInt16LE(4, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(samples.length * 2, 40)
  for (let index = 0; index < samples.length; index += 1) {
    bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[index])) * 32767), 44 + index * 2)
  }
  return bytes
}

function pcmStatistics(samples) {
  let peak = 0, sumSquares = 0, clipped = 0, nonFinite = 0
  for (const sample of samples) {
    if (!Number.isFinite(sample)) nonFinite += 1
    peak = Math.max(peak, Math.abs(sample))
    sumSquares += sample * sample
    if (Math.abs(sample) >= 1) clipped += 1
  }
  return {
    samplePeakDbfs: Number((20 * Math.log10(peak)).toFixed(2)),
    rmsDbfs: Number((10 * Math.log10(sumSquares / samples.length)).toFixed(2)),
    clippedSamples: clipped,
    nonFiniteSamples: nonFinite,
  }
}

function analyzeEncoded(path) {
  const analysis = command(ffmpeg, [
    '-hide_banner', '-nostats', '-i', path,
    '-af', 'astats=metadata=0:reset=0,loudnorm=I=-23:TP=-2:LRA=9:print_format=json',
    '-f', 'null', '-',
  ]).stderr
  const json = analysis.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0]
  const loudness = json ? JSON.parse(json) : null
  const rms = [...analysis.matchAll(/RMS level dB:\s*(-?[\d.]+)/g)].at(-1)?.[1]
  const length = analysis.match(/Duration: (\d+):(\d+):([\d.]+)/)
  const stream = analysis.match(/Audio: (\w+), (\d+) Hz, (stereo|mono)/)
  return {
    durationSeconds: length ? Number(length[1]) * 3600 + Number(length[2]) * 60 + Number(length[3]) : null,
    codec_name: stream?.[1] ?? null,
    sample_rate: stream?.[2] ?? null,
    channels: stream?.[3] === 'stereo' ? 2 : stream?.[3] === 'mono' ? 1 : null,
    integratedLufs: loudness ? Number(loudness.input_i) : null,
    truePeakDbtp: loudness ? Number(loudness.input_tp) : null,
    rmsDbfs: rms ? Number(rms) : null,
  }
}

function masteringFilter(path) {
  const analysis = command(ffmpeg, [
    '-hide_banner', '-nostats', '-i', path,
    '-af', 'loudnorm=I=-23:TP=-2:LRA=11:print_format=json', '-f', 'null', '-',
  ]).stderr
  const json = analysis.match(/\{\s*"input_i"[\s\S]*?\}/)?.[0]
  if (!json) throw new Error('ffmpeg did not return first-pass loudness measurements')
  const measured = JSON.parse(json)
  return 'loudnorm=I=-23:TP=-2:LRA=11:linear=true'
    + `:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}`
    + `:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}`
    + `:offset=${measured.target_offset}`
}

// A fixed seed makes every render repeatable without an external sample library.
const random = seededRandom(0x5449414e)
const noiseFrames = sampleRate * 8
const noise = [new Float32Array(noiseFrames), new Float32Array(noiseFrames)]
for (const channel of noise) {
  let softened = 0
  for (let index = 0; index < channel.length; index += 1) {
    const white = random() * 2 - 1
    softened = softened * 0.96 + white * 0.04
    channel[index] = white * 0.52 + softened * 1.8
  }
}

const keys = []
const phrases = []
for (let position = 0, start = PHRASE_OPENING_SECONDS; start < duration - 16; position += 1) {
  const section = sections.findLast((section) => start >= section.start)
  phrases.push({ start, phase: section.phase, duration: 15.9 })
  phraseFor(section.phase, position).forEach((frequency, index) => {
    keys.push({
      start: start + PHRASE_OFFSETS_SECONDS[index],
      frequency,
      velocity: PHRASE_VELOCITIES[index],
      pan: stereoPosition([-0.16, 0.12, -0.04][index]),
    })
  })
  start += nextPhraseDelay(position)
}

const voices = sections.map((section, sectionIndex) => ({
  ...section,
  end: sections[sectionIndex + 1]?.start ?? duration,
  notes: PHASE_SCORE[section.phase].chord.map((frequency, index) => ({
    frequency: frequency * 2 ** (DRONE_DETUNE[index] / 1200),
    pan: stereoPosition(DRONE_PAN[index]),
    level: DRONE_LEVELS[index],
    breath: 0.018 + index * 0.007,
  })),
}))
const warmth = [biquad('lowpass', 1650, 0.4), biquad('lowpass', 1650, 0.4)]
const rainLow = [biquad('highpass', 460, 0.35), biquad('highpass', 460, 0.35)]
const rainHigh = sections.map((section) => [
  biquad('lowpass', PHASE_SCORE[section.phase].rainLowpass, 0.35),
  biquad('lowpass', PHASE_SCORE[section.phase].rainLowpass, 0.35),
])
const reflections = ROOM_TAPS.map((tap) => ({
  ...tap,
  pan: stereoPosition(tap.pan),
  buffer: new Float32Array(Math.round(sampleRate * tap.seconds)),
  filter: biquad('lowpass', 950, 0.4),
}))
const demo = new Float32Array(frames * 2)
const score = new Float32Array(frames * 2)
const rainTrack = new Float32Array(frames * 2)

for (let frame = 0; frame < frames; frame += 1) {
  const time = frame / sampleRate
  const music = [0, 0]
  const sectionIndex = Math.min(sections.length - 1, Math.floor(time / 48))
  const current = PHASE_SCORE[sections[sectionIndex].phase]
  const previous = PHASE_SCORE[sections[Math.max(0, sectionIndex - 1)].phase]
  const transition = Math.min(1, (time - sections[sectionIndex].start) / PHASE_TRANSITION_SECONDS)
  const musicLevel = 0.4 * (previous.music + (current.music - previous.music) * transition)
  const rainLevel = 0.28 * (previous.rain + (current.rain - previous.rain) * transition)

  for (const section of voices) {
    const elapsed = time - section.start
    if (elapsed < 0 || time > section.end + PHASE_TRANSITION_SECONDS) continue
    const attack = Math.min(1, elapsed / (section.start === 0 ? 1.6 : PHASE_TRANSITION_SECONDS))
    const release = Math.max(0, Math.min(1, (section.end + PHASE_TRANSITION_SECONDS - time) / PHASE_TRANSITION_SECONDS))
    for (const note of section.notes) {
      const envelope = note.level * (1 + Math.sin(tau * note.breath * elapsed) * 0.32)
      const signal = Math.sin(tau * note.frequency * elapsed) * envelope * attack * release
      music[0] += signal * note.pan[0]
      music[1] += signal * note.pan[1]
    }
  }

  for (const key of keys) {
    const elapsed = time - key.start
    if (elapsed < 0 || elapsed > KEY_TAIL_SECONDS) continue
    let signal = 0
    for (const partial of KEY_PARTIALS) {
      if (elapsed > partial.tail) continue
      const peak = key.velocity * partial.level
      const amplitude = elapsed < KEY_ATTACK_SECONDS
        ? 0.00001 * (peak / 0.00001) ** (elapsed / KEY_ATTACK_SECONDS)
        : peak * (0.00001 / peak) ** ((elapsed - KEY_ATTACK_SECONDS) / (partial.tail - KEY_ATTACK_SECONDS))
      signal += Math.sin(tau * key.frequency * partial.ratio * elapsed) * amplitude
    }
    music[0] += signal * key.pan[0]
    music[1] += signal * key.pan[1]
  }

  const master = 0.55 * Math.min(1, time / 1.1) * Math.min(1, (duration - time) / 4)
  const dry = music.map((sample, channel) => warmth[channel](sample * musicLevel))
  const room = [0, 0]
  for (const tap of reflections) {
    const slot = frame % tap.buffer.length
    const sample = tap.filter(tap.buffer[slot]) * tap.level
    tap.buffer[slot] = (dry[0] + dry[1]) * 0.5
    room[0] += sample * tap.pan[0]
    room[1] += sample * tap.pan[1]
  }
  for (let channel = 0; channel < 2; channel += 1) {
    const musicSample = dry[channel] + room[channel]
    const rainInput = rainLow[channel](noise[channel][frame % noiseFrames])
    const rainOutputs = rainHigh.map((filters) => filters[channel](rainInput))
    const previousRain = rainOutputs[Math.max(0, sectionIndex - 1)]
    const rainSample = (previousRain + (rainOutputs[sectionIndex] - previousRain) * transition)
      * (0.18 + Math.sin(tau * 0.031 * time) * 0.025) * rainLevel
    score[frame * 2 + channel] = musicSample * master
    demo[frame * 2 + channel] = (musicSample + rainSample) * master
    rainTrack[frame * 2 + channel] = rainSample * master
  }
}

await mkdir(outputDirectory, { recursive: true })
const temporary = await mkdtemp(join(tmpdir(), 'tiantai-score-'))
const report = {
  title: SCORE_TITLE,
  composition: 'Original authored procedural composition and synthesis; no sampled songs or music-model service.',
  durationSeconds: duration,
  sections,
  phrases,
  motifFreeSeconds: Number((duration - phrases.reduce((sum, phrase) => sum + phrase.duration, 0)).toFixed(1)),
  mastering: 'Two-pass EBU R128 -23 LUFS target, -2 dBTP ceiling; runtime retains quieter reading levels.',
  files: {},
}

try {
  for (const [name, samples] of [['demo', demo], ['music-only', score], ['rain-only', rainTrack]]) {
    const raw = join(temporary, `${name}.wav`)
    const target = join(outputDirectory, `${name}.ogg`)
    const statistics = pcmStatistics(samples)
    if (statistics.clippedSamples || statistics.nonFiniteSamples) {
      throw new Error(`Refusing to encode invalid PCM: ${JSON.stringify(statistics)}`)
    }
    await writeFile(raw, writeWave(samples))
    command(ffmpeg, [
      '-hide_banner', '-loglevel', 'error', '-y', '-i', raw,
      '-af', masteringFilter(raw), '-ar', String(sampleRate),
      '-c:a', 'libvorbis', '-q:a', '5',
      '-metadata', `title=${SCORE_TITLE}${name === 'music-only' ? '（配乐分轨）' : name === 'rain-only' ? '（雨幕分轨）' : '（雨夜）'}`,
      '-metadata', 'artist=天台十句 V2 · Original procedural score',
      '-metadata', 'comment=Original generated score. Rebuild with v2/audio/render-score.mjs.',
      target,
    ])
    report.files[`${name}.ogg`] = {
      raw: statistics,
      encoded: analyzeEncoded(target),
      bytes: (await readFile(target)).length,
    }
  }
  await writeFile(join(outputDirectory, 'analysis.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify(report, null, 2))
} finally {
  // This process created the exact temporary directory above; no project files are removed.
  await rm(temporary, { recursive: true, force: true })
}
