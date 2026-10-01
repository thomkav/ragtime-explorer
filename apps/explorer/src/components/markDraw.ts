import { MARK } from '../model/reveal.ts'

/** The glyph's motion state. `draw` runs 0→1 on arrival, `breath` eases toward 1 while there is no text to read, `pulse` is the one ripple. */
export type MarkState = { draw: number; breath: number; pulse: number }

export const newMarkState = (): MarkState => ({ draw: 0, breath: 0, pulse: -1 })

const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3))

const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
const TEAL = rgb(MARK.color)

/**
 * The five flat-ended lines, with `ghost` px of five faded lines trailing behind them.
 * `ox` is where the glyph starts inside the canvas; `time` is seconds, for the breath and ripple.
 */
export function drawMark(c: CanvasRenderingContext2D, h: number, st: MarkState, time: number, ox: number, ghost: number): void {
  const { lines: n, gap: g, weight: lw, width: w } = MARK
  const k = (Math.PI * 2) / (g * 7)
  const pr = ease(st.draw)
  if (pr <= 0) return
  c.lineWidth = lw
  c.lineCap = 'butt'
  if (ghost > 2) {
    const gr = c.createLinearGradient(ox, 0, ox - ghost, 0)
    for (const [u, a] of [[0, 1], [0.25, 0.55], [0.55, 0.18], [1, 0]] as const) {
      gr.addColorStop(u, `rgba(${TEAL[0]},${TEAL[1]},${TEAL[2]},${(MARK.ghostA * a).toFixed(3)})`)
    }
    c.strokeStyle = gr
    for (let i = 0; i < n; i++) {
      const y = h / 2 + (i - (n - 1) / 2) * g
      c.beginPath()
      c.moveTo(ox, y)
      c.lineTo(ox - ghost, y)
      c.stroke()
    }
  }
  c.save()
  c.translate(ox, 0)
  c.strokeStyle = MARK.color
  for (let i = 0; i < n; i++) {
    const y0 = h / 2 + (i - (n - 1) / 2) * g
    const a = lw / 2
    const b = a + (w - lw) * pr
    c.beginPath()
    for (let x = a; x <= b + 0.1; x += 2) {
      const xx = Math.min(x, b)
      const u = xx / w
      const taper = Math.min(1, Math.min(u, 1 - u) * 12)
      let d = 0
      if (st.breath > 0.01) d += st.breath * 0.9 * MARK.breatheAmp * g * Math.sin(xx * k * 0.6 - time * 2.6 + i * 0.9)
      if (st.pulse >= 0) {
        const q = (u - st.pulse) * 5
        d += 1.4 * MARK.finishAmp * g * Math.exp(-q * q) * Math.sin(xx * k - time * 9 + i * 0.8)
      }
      const y = y0 + d * taper
      if (x === a) c.moveTo(xx, y)
      else c.lineTo(xx, y)
    }
    c.stroke()
  }
  c.restore()
}
