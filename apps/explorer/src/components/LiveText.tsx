import { useEffect, useLayoutEffect, useRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { linkifyCitations } from '../model/answer-shape.ts'
import { MARK, OVER_CAP, glyphHeight, letterState, lineOrdinals, paragraphEnd } from '../model/reveal.ts'
import { Markdown } from './Markdown.tsx'
import { drawMark, newMarkState, type MarkState } from './markDraw.ts'

type Props = {
  /** Everything streamed so far this turn (or the whole answer, once final). */
  text: string
  /** The stream has ended: show all of it, not just whole paragraphs. */
  final: boolean
  /** Said, with the mark breathing, while no paragraph is ready. */
  status: string
  appUrl: string
  titles: Map<string, string>
  /** The last letter has settled and the mark has finished its ripple. Called once. */
  onSettled(): void
}

type Pos = { l: number; r: number; ord: number }

type Reveal = {
  raw: string // the released text the spans were built from
  chars: HTMLElement[]
  pos: Pos[]
  lineY: number[] // vertical centre of each line, from the top of the root
  op: number[]
  tc: number[]
  done: number // letters before this are fully opaque and in ink
  shown: number // the brush, in letters; fractional
  over: number // px the front has travelled past the last letter
  moving: boolean
  gx: number
  gy: number
  appear: number
  gl: number // ghost length now
  snap: boolean
  settled: boolean
  holdEnd: number // seconds left of the ripple, once settled
  ink: [number, number, number]
  items: { li: HTMLElement; first: number }[] // a list marker is not a letter, so it waits for its item's first one
}

const newReveal = (): Reveal => ({
  raw: '', chars: [], pos: [], lineY: [], op: [], tc: [], done: 0, shown: 0, over: 0, moving: false,
  gx: 0, gy: 0, appear: 0, gl: 0, snap: true, settled: false, holdEnd: -1, ink: [27, 35, 51], items: [],
})

/** Every letter of every text node becomes its own span, so the reveal can set its opacity. Returns them in reading order. */
function wrapLetters(root: HTMLElement): HTMLElement[] {
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/\S/.test(n.nodeValue ?? '')) nodes.push(n as Text)
  const out: HTMLElement[] = []
  for (const node of nodes) {
    const frag = document.createDocumentFragment()
    for (const ch of Array.from(node.data)) {
      const s = document.createElement('span')
      s.textContent = ch
      s.style.opacity = '0'
      frag.append(s)
      out.push(s)
    }
    node.replaceWith(frag)
  }
  return out
}

/** The last word is held together with room for the mark, so the mark never wraps onto a line of its own. */
function holdLastWord(chars: HTMLElement[]): void {
  let e = chars.length - 1
  while (e >= 0 && /\s/.test(chars[e]!.textContent ?? '')) e--
  if (e < 0) return
  let s = e
  while (s > 0 && chars[s - 1]!.parentNode === chars[e]!.parentNode && !/\s/.test(chars[s - 1]!.textContent ?? '')) s--
  const hold = document.createElement('span')
  hold.style.whiteSpace = 'nowrap'
  chars[s]!.before(hold)
  for (let i = s; i <= e; i++) hold.append(chars[i]!)
  const room = document.createElement('span')
  room.style.cssText = `display:inline-block;height:1px;width:${MARK.before + MARK.width}px`
  hold.append(room)
}

const inkOf = (el: Element): [number, number, number] => {
  const m = getComputedStyle(el).color.match(/\d+(\.\d+)?/g)
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [27, 35, 51]
}
const TEAL: [number, number, number] = [1, 3, 5].map((i) => parseInt(MARK.color.slice(i, i + 2), 16)) as [number, number, number]

/**
 * The streamed answer, as the mark writes it. The mark is the cursor: text is held until a
 * whole paragraph has arrived, laid out whole and invisible so nothing reflows, then
 * revealed along one continuous path by a brush that moves left to right at one speed.
 * The mark sits `lead` px ahead of the letters and leaves a ghost behind it.
 *
 * The letters are real DOM from the same `Markdown` the finished answer uses, rendered to
 * static HTML and wrapped by hand. React never owns those spans, so nothing reconciles
 * against them; the reveal's state lives in a ref and the loop runs on requestAnimationFrame.
 */
export function LiveText(props: Props) {
  const root = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const statusEl = useRef<HTMLSpanElement>(null)
  const latest = useRef(props)
  latest.current = props
  const R = useRef<Reveal>(newReveal())
  const thinking = !props.final && paragraphEnd(props.text, false) === 0

  function measure() {
    const r = R.current
    const host = root.current
    const b = body.current
    if (!host || !b) return
    const hr = host.getBoundingClientRect()
    const rects = r.chars.map((c) => c.getBoundingClientRect())
    const centres = rects.map((q) => (q.top + q.bottom) / 2 - hr.top)
    const ords = lineOrdinals(centres)
    r.pos = rects.map((q, i) => ({ l: q.left - hr.left, r: q.right - hr.left, ord: ords[i]! }))
    r.lineY = []
    ords.forEach((o, i) => {
      if (r.lineY[o] === undefined) r.lineY[o] = centres[i]!
    })
    r.ink = inkOf(b)
  }

  // New text: rebuild the letters when the released paragraphs change. Letters already shown keep their state.
  useLayoutEffect(() => {
    const r = R.current
    const b = body.current
    if (!b) return
    const raw = props.text.slice(0, paragraphEnd(props.text, props.final))
    if (raw === r.raw) return
    if (!raw.startsWith(r.raw)) Object.assign(r, { shown: 0, over: 0, done: 0, op: [], tc: [], moving: false, snap: true })
    r.raw = raw
    if (!raw.trim()) {
      b.replaceChildren()
      r.chars = []
      r.pos = []
      return
    }
    b.innerHTML = renderToStaticMarkup(<Markdown text={linkifyCitations(raw, props.titles)} appUrl={props.appUrl} titles={props.titles} />)
    r.chars = wrapLetters(b)
    holdLastWord(r.chars)
    r.items = [...b.querySelectorAll<HTMLElement>('li')].map((li) => ({ li, first: r.chars.findIndex((c) => li.contains(c)) })).filter((x) => x.first >= 0)
    measure()
    r.settled = false
    r.holdEnd = -1
  }, [props.text, props.final]) // eslint-disable-line react-hooks/exhaustive-deps

  // A width change (rotation, a pane opening) or a late font moves every letter.
  useEffect(() => {
    const host = root.current
    if (!host) return
    let width = host.clientWidth
    const ro = new ResizeObserver(() => {
      if (host.clientWidth !== width) {
        width = host.clientWidth
        measure()
      }
    })
    ro.observe(host)
    void document.fonts?.ready.then(measure)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let time = 0
    const st: MarkState = newMarkState()
    const quiet = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      time += dt
      const r = R.current
      const host = root.current
      const b = body.current
      const canvas = cv.current
      if (!host || !b || !canvas) return
      const { final } = latest.current
      const n = r.pos.length
      const W = host.clientWidth

      // The brush: one constant speed in px/s along the text.
      if (quiet) {
        r.shown = n
        r.over = OVER_CAP
        r.moving = false
      } else if (n && r.shown < n - 1e-6) {
        const p = r.pos[Math.min(Math.floor(r.shown), n - 1)]!
        r.shown = Math.min(n, r.shown + (MARK.speed / Math.max(4, p.r - p.l)) * dt)
        r.over = 0
        r.moving = true
      } else {
        r.moving = false
        r.over = Math.min(OVER_CAP, r.over + MARK.speed * dt)
      }

      // The letters: distance behind the mark's text edge sets opacity and teal-to-ink.
      let fx = 0
      let fo = 0
      if (n) {
        const j = Math.min(Math.floor(r.shown), n - 1)
        const pj = r.pos[j]!
        fx = pj.l + Math.min(1, r.shown - j) * (pj.r - pj.l)
        fo = pj.ord
        const front = fo * W + fx + r.over - MARK.lead
        let contiguous = true
        for (let i = r.done; i < n && i <= j + 1; i++) {
          const p = r.pos[i]!
          const s = letterState(front - (p.ord * W + p.l))
          const o = Math.max(r.op[i] ?? 0, s.opacity)
          const t = Math.max(r.tc[i] ?? 0, s.settle)
          r.op[i] = o
          r.tc[i] = t
          const style = r.chars[i]!.style
          style.opacity = String(o)
          style.color = t >= 1 ? '' : `rgb(${[0, 1, 2].map((k) => Math.round(TEAL[k]! + (r.ink[k]! - TEAL[k]!) * t)).join(',')})`
          if (contiguous && o >= 1 && t >= 1) r.done = i + 1
          else contiguous = false
        }
      }

      for (const it of r.items) if ((r.op[it.first] ?? 0) > 0 && !it.li.hasAttribute('data-on')) it.li.setAttribute('data-on', '')

      // The mark's own motion: draws in, breathes while there is nothing to read, ripples once at the end.
      const wait = !final && (n === 0 || !r.moving)
      st.draw = Math.min(1, st.draw + dt / MARK.drawTime)
      st.breath += ((wait && !quiet ? 1 : 0) - st.breath) * Math.min(1, dt * 3)
      if (!r.settled && final && r.shown >= n - 1e-6 && r.over >= OVER_CAP - 1e-6) {
        r.settled = true
        st.pulse = quiet || n === 0 ? -1 : 0
        r.holdEnd = quiet || n === 0 ? 0 : 1.4
      }
      if (st.pulse >= 0) {
        st.pulse += dt / 1.1
        if (st.pulse > 1.3) st.pulse = -1
      }
      if (r.holdEnd > 0) r.holdEnd -= dt
      if (r.settled && r.holdEnd <= 0 && r.holdEnd !== -2) {
        r.holdEnd = -2
        latest.current.onSettled()
      }

      // Where the mark sits: on the status while there is no paragraph, else at the brush. Height depends on the line alone.
      const h = glyphHeight()
      const hr = host.getBoundingClientRect()
      const fs = parseFloat(getComputedStyle(b).fontSize) || 17
      let x: number
      let cy: number
      if (n === 0) {
        const sr = statusEl.current?.getBoundingClientRect()
        if (!sr) return
        x = sr.right - hr.left
        cy = (sr.top + sr.bottom) / 2 - hr.top
      } else {
        x = fx
        cy = r.lineY[fo] ?? 0
      }
      const tx = x + MARK.before
      const ty = cy + 0.348 * fs - MARK.lift - h / 2
      if (r.snap || Math.abs(ty - r.gy) > 6 || tx < r.gx - 8) {
        if (!r.snap) r.appear = 0 // a new line: fade out here, reappear there, no travel in between
        r.snap = false
      }
      r.gx = tx
      r.gy = ty
      r.appear = Math.min(1, r.appear + dt / 0.18)
      const gTarget = r.moving && n > 0 ? Math.min(MARK.trail, Math.max(0, tx)) : 0
      r.gl += (gTarget - r.gl) * (1 - Math.exp(-dt * (gTarget > r.gl ? 10 : 3.5)))
      canvas.style.opacity = String(r.appear)
      canvas.style.transform = `translate(${(tx - MARK.trail).toFixed(2)}px, ${ty.toFixed(2)}px)`

      const dpr = window.devicePixelRatio || 1
      const cw = MARK.width + MARK.trail
      const W2 = Math.round(cw * dpr)
      const H2 = Math.round(h * dpr)
      if (canvas.width !== W2 || canvas.height !== H2) {
        canvas.width = W2
        canvas.height = H2
        canvas.style.width = cw + 'px'
        canvas.style.height = h + 'px'
      }
      const c = canvas.getContext('2d')
      if (!c) return
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      c.clearRect(0, 0, cw, h)
      drawMark(c, h, st, time, MARK.trail, r.gl)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="live" ref={root}>
      {thinking && (
        <span className="live-status" ref={statusEl} aria-live="polite">
          {props.status}
        </span>
      )}
      <div className="livetext" ref={body} />
      <canvas className="live-mark" ref={cv} aria-hidden="true" />
    </div>
  )
}
