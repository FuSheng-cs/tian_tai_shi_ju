import { writeFile } from 'node:fs/promises'

const [wsUrl, url, output, mobile = 'false'] = process.argv.slice(2)
const socket = new WebSocket(wsUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const resources = new Map()
const errors = []
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    const callback = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) callback.reject(new Error(JSON.stringify(message.error)))
    else callback.resolve(message.result)
  }
  const p = message.params
  if (message.method === 'Network.responseReceived' && p.response.url.startsWith(new URL(url).origin)) {
    resources.set(p.requestId, { path: new URL(p.response.url).pathname, type: p.type,
      status: p.response.status, bytes: 0, mime: p.response.mimeType })
  }
  if (message.method === 'Network.dataReceived' && resources.has(p.requestId)) {
    resources.get(p.requestId).bytes += p.encodedDataLength
  }
  if (message.method === 'Network.loadingFinished' && resources.has(p.requestId)) {
    resources.get(p.requestId).bytes = Math.max(resources.get(p.requestId).bytes, p.encodedDataLength)
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(p.exceptionDetails.text)
})
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const requestId = ++id
    pending.set(requestId, { resolve, reject })
    socket.send(JSON.stringify({ id: requestId, method, params, sessionId }))
  })
}
const { targetInfos } = await send('Target.getTargets')
const pages = targetInfos.filter((target) => target.type === 'page')
const blankPages = pages.filter((target) => target.url === 'about:blank')
const page = blankPages.length === 1 ? blankPages[0] : pages.length === 1 ? pages[0] : null
if (!page) throw new Error('Use a dedicated browser session with one about:blank tab')
const { sessionId } = await send('Target.attachToTarget', { targetId: page.targetId, flatten: true })
const cdp = (method, params) => send(method, params, sessionId)
await cdp('Page.enable')
await cdp('Page.bringToFront')
await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
await cdp('Runtime.enable')
await cdp('Network.enable')
await cdp('Network.clearBrowserCache')
await cdp('Storage.clearDataForOrigin', { origin: new URL(url).origin, storageTypes: 'all' })
await cdp('Network.emulateNetworkConditions', { offline: false, latency: 150,
  downloadThroughput: 200000, uploadThroughput: 50000, connectionType: 'cellular4g' })
await cdp('Emulation.setCPUThrottlingRate', { rate: 4 })
await cdp('Emulation.setDeviceMetricsOverride', { width: mobile === 'true' ? 390 : 1280,
  height: mobile === 'true' ? 844 : 720, deviceScaleFactor: 1, mobile: mobile === 'true' })
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__lcp = 0;
  new PerformanceObserver(list => { for (const e of list.getEntries()) window.__lcp = e.startTime; })
    .observe({type:'largest-contentful-paint', buffered:true});
  window.__audios = [];
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function(...args) {
    if (!window.__audios.includes(this)) {
      window.__audios.push(this);
      this.addEventListener('playing', () => { window.__musicStartedAt ??= performance.now(); });
    }
    return nativePlay.apply(this, args);
  };
` })
await cdp('Page.navigate', { url })
let readyMs = null
for (let i = 0; i < 75; i++) {
  await new Promise((resolve) => setTimeout(resolve, 200))
  const value = await cdp('Runtime.evaluate', { expression: `(() => {
    const b = document.querySelector('.menu-button-primary');
    return b && b.getBoundingClientRect().width > 0 ? performance.now() : null;
  })()`, returnByValue: true })
  if (readyMs === null && value.result.value) {
    readyMs = Math.round(value.result.value)
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
    await writeFile(output.replace('.json', '-first.png'), Buffer.from(screenshot.data, 'base64'))
  }
}
const { result } = await cdp('Runtime.evaluate', { expression: `JSON.stringify({
  lcp:Math.round(window.__lcp || 0), musicStartedAt:Math.round(window.__musicStartedAt || 0),
  paint:performance.getEntriesByType('paint').map(e=>({name:e.name, ms:Math.round(e.startTime)})),
  audio:(window.__audios || []).map(a=>({src:a.currentSrc.split('/').pop(),
    paused:a.paused, currentTime:a.currentTime, readyState:a.readyState})),
  fonts:performance.getEntriesByType('resource').filter(e=>/woff|ttf/.test(e.name))
    .map(e=>({file:e.name.split('/').pop(), bytes:e.transferSize, ms:Math.round(e.duration)}))
})`, returnByValue: true })
const data = { url, network: '1.6 Mbps / 150 ms RTT / CPU 4x / cold cache', mobile,
  readyMs, ...JSON.parse(result.value), resources: [...resources.values()], errors }
await writeFile(output, JSON.stringify(data, null, 2))
const screenshot = await cdp('Page.captureScreenshot', { format: 'png' })
await writeFile(output.replace('.json', '-final.png'), Buffer.from(screenshot.data, 'base64'))
console.log(JSON.stringify({ readyMs, lcp:data.lcp, musicStartedAt:data.musicStartedAt,
  fontKB:data.fonts.map(f=>Math.round(f.bytes/1024)), totalKB:Math.round(data.resources.reduce((n,r)=>n+r.bytes,0)/1024),
  errors:data.errors }))
socket.close()
