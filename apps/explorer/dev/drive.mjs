/**
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
const [url, out, width = '1440', height = '980'] = argv.filter((a) => !a.startsWith('--'))

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
  await send('Emulation.setDeviceMetricsOverride', {
    width: Number(width),
    height: Number(height),
    deviceScaleFactor: 2,
    mobile: Number(width) < 700,
  })
  await send('Page.navigate', { url })
  await sleep(1000)
  await until(`!!document.querySelector('.composer textarea')`, 'the composer')

  // React reads its value from its own state, not from the DOM node, so a plain
  // assignment is discarded on the next render: drive the native setter and fire input.
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
  await sleep(500)

  if (!flags.has('--stop-after-brief')) {
    await evaluate(`document.querySelector('.brief button.primary').click(), true`)
    await settled()
    await sleep(1200)
  }

  if (flags.has('--edit-brief')) {
    // Only the pinned bar carries Edit, and only a changed draft enables its button —
    // which is why a second marker always means an edited brief.
    await evaluate(`(() => {
      const card = document.querySelector('.brief-bar details.brief-compact')
      if (card) card.open = true
      return true
    })()`)
    await until(`[...document.querySelectorAll('button.link')].some((b) => /Edit the brief/.test(b.textContent))`, 'the Edit affordance')
    await evaluate(`[...document.querySelectorAll('button.link')].find((b) => /Edit the brief/.test(b.textContent)).click(), true`)
    await until(`!!document.querySelector('.brief input')`, 'the goal field')
    await evaluate(`(() => {
      const box = document.querySelector('.brief input')
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      set.call(box, 'Narrow to section 706 only: what does OLC say the proclamation has to say?')
      box.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await until(
      `[...document.querySelectorAll('button.primary')].some((b) => /edited brief/.test(b.textContent) && !b.disabled)`,
      'the edited-brief button',
    )
    await evaluate(`[...document.querySelectorAll('button.primary')].find((b) => /edited brief/.test(b.textContent)).click(), true`)
    await until(`document.querySelectorAll('.marker').length >= 2`, 'the second marker')
    await settled()
    await sleep(1200)
  }

  if (flags.has('--open-trail')) {
    await evaluate(`document.querySelector('.trail-toggle').click(), true`)
    await until(`!!document.querySelector('aside.right')`, 'the trail rail')
    await sleep(600)
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))

  console.log('viewport      :', width + '×' + height)
  console.log('trail toggle  :', await evaluate(`document.querySelector('.trail-toggle')?.textContent`))
  console.log('aria-expanded :', await evaluate(`document.querySelector('.trail-toggle')?.getAttribute('aria-expanded')`))
  console.log('trail rail    :', await evaluate(`!!document.querySelector('aside.right')`))
  // The measure is the claim worth checking on any layout change: opening the trail is
  // meant to move whitespace, not to re-wrap a line of the answer.
  console.log('measure       :', await px('.conversation'), '· brief bar', await px('.brief-bar .brief'), '· column', await px('.left'))
  console.log('open panels   :', await evaluate(`[...document.querySelectorAll('details')].filter((d) => d.open).map((d) => d.className).join(' | ') || '(none)'`))
  console.log('markers       :', await evaluate(`[...document.querySelectorAll('.marker')].map((m) => m.textContent).join(' || ') || '(none)'`))
  console.log('wrote         :', out)
  bye(0)
} catch (err) {
  console.error('FAILED:', err.message)
  console.error('page said:', await evaluate(`document.body.innerText.slice(0, 800)`).catch(() => '(unreadable)'))
  bye(1)
}
