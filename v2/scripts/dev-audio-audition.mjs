import { createServer } from '../web/node_modules/vite/dist/node/index.js'
import { fileURLToPath } from 'node:url'
import { localAudioPlugin } from './local-audio-plugin.mjs'

const web = fileURLToPath(new URL('../web/', import.meta.url))
const originals = fileURLToPath(new URL('../.run/reference-music/originals/', import.meta.url))
const audio = await localAudioPlugin(originals)
const server = await createServer({
  root: web,
  configFile: `${web}vite.config.ts`,
  plugins: [audio],
  define: { 'import.meta.env.VITE_LOCAL_AUDIO_AUDITION': JSON.stringify('1') },
  server: { host: '127.0.0.1', port: 5178, strictPort: true },
})
await server.listen()
console.log('Private reference music verified. This server is local-only; release builds contain no recordings.')
server.printUrls()
