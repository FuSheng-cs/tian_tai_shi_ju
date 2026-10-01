import { writeFile } from 'node:fs/promises'

const [wsUrl, url, output, mobile = 'false', mode = 'direct'] = process.argv.slice(2)
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

const startUrl = mode === 'home' ? url : new URL('/game?entry=new', url).href
await cdp('Page.navigate', { url: startUrl })
let from = 0
if (mode === 'home') {
  let button
  for (let i = 0; i < 120; i++) {
    const { result } = await cdp('Runtime.evaluate', { expression: `(() => {
      const b=document.querySelector('.menu-button-primary'); if(!b) return null;
      const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,t:performance.now()};
    })()`, returnByValue:true })
    if(result.value) {button=result.value;break}
    await new Promise(resolve=>setTimeout(resolve,100))
  }
  if(!button) throw new Error('Home start button missing')
  from=button.t
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:button.x,y:button.y,button:'left',clickCount:1})
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:button.x,y:button.y,button:'left',clickCount:1})
}
let firstVisibleMs = null
let fullReadyMs = null
let finalState = {}
for (let i=0;i<200;i++) {
  const { result }=await cdp('Runtime.evaluate',{expression:`(() => {
    const f=document.querySelector('.opening-sequence .cinematic-frame-active');
    if(!f) return {t:performance.now()};
    const p=f.querySelector('.cg-preview img');
    const full=f.querySelector('.cg-full img') || f.querySelector('img');
    const pv=!!(p?.complete && p.naturalWidth>0);
    const fv=!!(full?.complete && full.naturalWidth>0 &&
      (!f.querySelector('.cg-full') || f.querySelector('.cg-full').classList.contains('cg-ready')));
    return {t:performance.now(),visible:pv||fv,full:fv,preview:p?.currentSrc,src:full?.currentSrc};
  })()`,returnByValue:true})
  finalState=result.value || {}
  if(firstVisibleMs===null && finalState.visible) {
    firstVisibleMs=Math.round(finalState.t-from)
    const shot=await cdp('Page.captureScreenshot',{format:'png'})
    await writeFile(output.replace('.json','-first.png'),Buffer.from(shot.data,'base64'))
  }
  if(fullReadyMs===null && finalState.full) {fullReadyMs=Math.round(finalState.t-from);break}
  await new Promise(resolve=>setTimeout(resolve,150))
}
const data={url,mode,mobile,firstVisibleMs,fullReadyMs,finalState,
  network:'1.6 Mbps / 150 ms RTT / CPU 4x / cold cache',resources:[...resources.values()],errors}
await writeFile(output,JSON.stringify(data,null,2))
const shot=await cdp('Page.captureScreenshot',{format:'png'})
await writeFile(output.replace('.json','-full.png'),Buffer.from(shot.data,'base64'))
console.log(JSON.stringify({firstVisibleMs,fullReadyMs,errors}))
socket.close()
