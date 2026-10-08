import { createReadStream } from 'node:fs'
import { readFile, realpath, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, sep } from 'node:path'
import { referenceTracks } from '../audio/reference-catalog.mjs'

const prefix = '/__local-audio/'
const localHosts = new Set(['127.0.0.1:5178', 'localhost:5178'])

export async function localAudioPlugin(originals) {
  const base = await realpath(originals)
  const files = new Map()
  for (const track of referenceTracks) {
    const path = await realpath(resolve(base, track.file))
    if (!path.startsWith(base + sep)) throw new Error('Audio file escapes its private directory')
    const metadata = await stat(path)
    const digest = createHash('sha256').update(await readFile(path)).digest('hex')
    if (!metadata.isFile() || digest !== track.sha256) {
      throw new Error(`Reference file verification failed: ${track.id}`)
    }
    files.set(`${prefix}${track.id}.mp3`, { path, size: metadata.size })
  }
  const manifest = JSON.stringify({
    defaultTrackId: 'late-night-earl-grey',
    tracks: referenceTracks.map(({ file, sha256, ...track }) => ({
      ...track, url: `${prefix}${track.id}.mp3`,
    })),
  })

  return {
    name: 'private-local-music-audition',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith(prefix)) return next()
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
        response.setHeader('X-Content-Type-Options', 'nosniff')
        response.setHeader('Referrer-Policy', 'no-referrer')
        if (!localHosts.has(request.headers.host) || request.headers['sec-fetch-site'] === 'cross-site') {
          response.writeHead(403).end()
          return
        }
        if (request.headers.origin && !['http://127.0.0.1:5178', 'http://localhost:5178'].includes(request.headers.origin)) {
          response.writeHead(403).end()
          return
        }
        if (!['GET', 'HEAD'].includes(request.method)) {
          response.writeHead(405, { Allow: 'GET, HEAD' }).end()
          return
        }
        const pathname = request.url.split('?')[0]
        if (pathname === `${prefix}manifest.json`) {
          response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(manifest) })
          response.end(request.method === 'HEAD' ? undefined : manifest)
          return
        }
        const file = files.get(pathname)
        if (!file) {
          response.writeHead(404).end()
          return
        }
        let start = 0
        let end = file.size - 1
        let status = 200
        if (request.headers.range) {
          const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range)
          const invalid = () => response.writeHead(416, { 'Content-Range': `bytes */${file.size}` }).end()
          if (!match || (!match[1] && !match[2])) return invalid()
          if (!match[1]) {
            const suffix = Number(match[2])
            if (!Number.isSafeInteger(suffix) || suffix <= 0) return invalid()
            start = Math.max(0, file.size - suffix)
          } else {
            start = Number(match[1])
            end = match[2] ? Math.min(Number(match[2]), end) : end
          }
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= file.size || end < start) return invalid()
          status = 206
          response.setHeader('Content-Range', `bytes ${start}-${end}/${file.size}`)
        }
        response.writeHead(status, { 'Content-Type': 'audio/mpeg', 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' })
        if (request.method === 'HEAD') return response.end()
        const stream = createReadStream(file.path, { start, end })
        response.on('close', () => stream.destroy())
        stream.on('error', () => response.destroy())
        stream.pipe(response)
      })
    },
  }
}
