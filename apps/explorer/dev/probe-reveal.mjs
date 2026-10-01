/**
 * Probes the live reveal (LiveText) through the research turn: reflow, the mark's height,
 *   brush speed, and the swap to the Answer. Same setup as drive.mjs:
 *   node dev/probe-reveal.mjs http://localhost:5199/ /tmp/mid.png 390 844
 * Below is drive.mjs's header.
 *
 * The page, driven, so a change to it can be looked at instead of reasoned about.
 *
 * `dev/hosted-stub.mjs` makes a turn free; this makes the turn happen without a person
 * clicking through it. Together they answer the question the type-checker cannot: what
 * does a member actually see. Every check here is against the stub, so nothing reaches a
 * network, a corpus or a credential, and nothing spends.
 *
 *   node dev/hosted-stub.mjs &
 *   VITE_TURN_URL=http://127.0.0.1:8821/turn npx vite apps/explorer --port 5199 &
 *   node apps/explorer/dev/drive.mjs http://localhost:5199/ /tmp/wide.png 1440 980
 *
 * It orients, accepts the proposed brief, waits for the research turn to settle, and
 * writes a PNG. Flags stop it earlier or take it further:
 *
 *   --stop-after-brief   shoot the proposed brief, before anything is accepted
 *   --open-trail         open the trail first, so the second column is in the shot
 *   --edit-brief         edit the accepted brief from the pinned bar and accept again,
 *                        which is the only way to reach the second research phase
 *
 * It prints what it found as well as shooting it — the toggle's text, `aria-expanded`,
 * whether the rail is in the DOM, the conversation's measure, every marker — so a run
 * is a check even when nobody opens the image. Both viewports are worth driving: a
 * defect that only appears at 390 wide (the trail painting over the composer) is exactly
 * what a desk-sized look misses.
 *
 * Chrome over the DevTools Protocol on Node's global WebSocket, because this repo has no
 * browser-automation dependency and one screenshot does not justify adding one.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROMES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const [url, out, width = '390', height = '844'] = argv.filter((a) => !a.startsWith('--'))

if (!url || !out) {
  console.error('usage: node apps/explorer/dev/drive.mjs <url> <out.png> [width] [height] [--stop-after-brief] [--open-trail] [--edit-brief]')
  process.exit(2)
}
const chromePath = CHROMES.find((p) => existsSync(p))
if (!chromePath) {
  console.error('no Chrome or Chromium found in:\n  ' + CHROMES.join('\n  '))
  process.exit(2)
}

// A fresh profile every run: localStorage carries the page's settings, and a run that
// inherits the last one is not driving the page a first-time member gets.
const profile = mkdtempSync(join(tmpdir(), 'explorer-drive-'))
const port = 9300 + (process.pid % 200)
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const bye = (code) => {
  chrome.kill('SIGTERM')
  process.exit(code)
}

let target = null
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250)
  try {
    const list = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()
    target = list.find((t) => t.type === 'page')
  } catch {
    // Chrome is not listening yet; that is what the loop is for.
  }
}
if (!target) {
  console.error('chrome never opened a debugging port on ' + port)
  bye(1)
}

const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => (ws.onopen = resolve))
let id = 0
const pending = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  const settle = pending.get(m.id)
  if (settle) {
    settle(m)
    pending.delete(m.id)
  }
}
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id
    pending.set(n, (m) => (m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result)))
    ws.send(JSON.stringify({ id: n, method, params }))
  })

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' :: ' + expression)
  return r.result.value
}
/** Poll an expression rather than sleeping a guessed interval; a stream has no fixed pace. */
const until = async (expression, label, ms = 45000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    if (await evaluate(expression)) return
    await sleep(200)
  }
  throw new Error('timed out waiting for ' + label)
}
const settled = () =>
  until(
    `document.querySelector('.composer textarea')?.disabled === false && !document.querySelector('.working')`,
    'the turn to settle',
    60000,
  )
const px = async (selector) =>
  Math.round(await evaluate(`document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect().width || 0`))

try {
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: Number(width), height: Number(height), deviceScaleFactor: 2, mobile: Number(width) < 700 })
  await send('Page.navigate', { url })
  await sleep(1000)
  await until(`!!document.querySelector('.composer textarea')`, 'the composer')
  await evaluate(`(() => {
    const box = document.querySelector('.composer textarea')
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    set.call(box, 'What has OLC said about presidential emergency powers over communications networks?')
    box.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)
  await sleep(150)
  await evaluate(`document.querySelector('.composer button[type=submit]').click(), true`)
  await until(`!!document.querySelector('.brief button.primary')`, 'the proposed brief')
  await sleep(400)
  // Sample inside the page on a real clock, from the click to the swap.
  await evaluate(`document.querySelector('.brief button.primary').click(), true`)
  // One frame from the middle of the reveal, taken while the trace runs.
  setTimeout(async () => {
    const mid = await send('Page.captureScreenshot', { format: 'png' }).catch(() => null)
    if (mid) writeFileSync(out.replace(/\.png$/, '-mid.png'), Buffer.from(mid.data, 'base64'))
  }, 5000)
  const trace = await evaluate(`new Promise((resolve) => {
    const out = [], t0 = performance.now()
    let sawLive = false, shot = false
    const tick = () => {
      const live = document.querySelector('.live'), body = document.querySelector('.livetext'), cvs = document.querySelector('.live-mark')
      const t = Math.round(performance.now() - t0)
      if (live) {
        sawLive = true
        const spans = body ? [...body.querySelectorAll('span')].filter((s) => s.children.length === 0 && s.textContent.length === 1) : []
        const m = cvs && /translate\\(([-\\d.]+)px, ([-\\d.]+)px\\)/.exec(cvs.style.transform)
        out.push({ t, h: body ? Math.round(body.getBoundingClientRect().height) : 0, n: spans.length,
          vis: spans.filter((s) => +s.style.opacity >= 1).length, any: spans.filter((s) => +s.style.opacity > 0).length,
          x: m ? +m[1] : null, y: m ? +m[2] : null, a: cvs ? +cvs.style.opacity : null, status: !!live.querySelector('.live-status'),
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })
      } else if (sawLive) { out.push({ t, swapped: true, answer: !!document.querySelector('.answer:not(.live-answer)') }); if (out.length && out.filter((o) => o.swapped).length > 3) return resolve(out) }
      if (t > 90000) return resolve(out)
      setTimeout(tick, 40)
    }
    tick()
  })`)
  console.log('samples        :', trace.length)
  const live = trace.filter((o) => !o.swapped)
  const first = live[0], lastLive = live[live.length - 1]
  console.log('live lasted    :', lastLive.t - first.t, 'ms   (first at', first.t + ')')
  console.log('status shown   :', live.filter((o) => o.status).length, 'samples')
  // Reflow: the text block's height may change only when more letters are released, never between releases.
  let reflow = 0
  for (let i = 1; i < live.length; i++) if (live[i].n === live[i - 1].n && live[i].h !== live[i - 1].h && live[i].n > 0) reflow++
  console.log('reflow         :', reflow, 'height changes with no new letters')
  console.log('letters        :', [...new Set(live.map((o) => o.n))].join(' → '))
  console.log('page overflow  :', live.some((o) => o.sw > o.cw) ? 'HORIZONTAL OVERFLOW' : 'none')
  // The mark's height depends on the line alone: within a run of samples at one y, y must not vary.
  const ys = [...new Set(live.filter((o) => o.y !== null && o.n > 0).map((o) => o.y))]
  console.log('mark y values  :', ys.length, '→', ys.slice(0, 12).join(', '))
  // Brush speed: x against time within each line (samples where y is constant and x rises).
  const speeds = []
  for (let i = 1; i < live.length; i++) {
    const a = live[i - 1], b = live[i]
    if (a.y === b.y && a.x !== null && b.x > a.x && b.t > a.t) speeds.push(((b.x - a.x) / (b.t - a.t)) * 1000)
  }
  speeds.sort((p, q) => p - q)
  const med = speeds[Math.floor(speeds.length / 2)]
  console.log('brush px/s     : median', Math.round(med || 0), ' p10', Math.round(speeds[Math.floor(speeds.length * 0.1)] || 0), ' p90', Math.round(speeds[Math.floor(speeds.length * 0.9)] || 0), ' (target 530)')
  let back = 0
  for (let i = 1; i < live.length; i++) if (live[i].y === live[i - 1].y && live[i].x < live[i - 1].x - 0.5) back++
  console.log('moved backwards:', back, 'times within a line')
  console.log('swap           :', JSON.stringify(trace[trace.length - 1]))
  const shotNow = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(shotNow.data, 'base64'))
  console.log('wrote          :', out)
  bye(0)
} catch (err) {
  console.error('FAILED:', err.message)
  bye(1)
}
