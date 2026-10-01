/**
 * The reveal's rules that need no DOM. The streamed answer is held until a whole
 * paragraph has arrived, then painted at one constant speed (see `LiveText`).
 * Pure, so they run under `node --test`.
 */

/** The ratified look and motion of the mark. CSS px throughout. */
export const MARK = {
  color: '#2b6872', // sampled by eye from the Lawfare banner; replace with the brand value
  lines: 5,
  width: 16,
  gap: 2.6,
  weight: 1,
  trail: 76,
  ghostA: 0.55,
  before: 4,
  lift: 4,
  drawTime: 0.8,
  breatheAmp: 0.7,
  finishAmp: 1.3,
  speed: 530, // brush, px/s
  edge: 44, // letters appear over this many px, in the mark's teal
  solid: 110, // then settle to the page's ink over this many px
  lead: 27, // the mark leads the text by this many px
} as const

/**
 * How much of the streamed text may be shown. While the answer is still arriving that is
 * everything before the last blank line (a whole paragraph), never a paragraph still being
 * written; a blank line inside an open code fence is not a paragraph break. When the
 * answer is final it is all of it.
 */
export function paragraphEnd(text: string, final: boolean): number {
  if (final) return text.length
  let at = text.lastIndexOf('\n\n')
  while (at > 0) {
    const fences = text.slice(0, at).match(/^ {0,3}(```|~~~)/gm)?.length ?? 0
    if (fences % 2 === 0) return at
    at = text.lastIndexOf('\n\n', at - 1)
  }
  return 0
}

/** The height of the glyph's canvas. It depends on the config alone, so no phase of the stream can shift the layout. */
export function glyphHeight(): number {
  const m = MARK
  return Math.ceil((m.lines - 1) * m.gap + m.weight + 2 * m.gap * 1.6 * Math.max(m.breatheAmp, m.finishAmp) + 2)
}

/** Smoothstep, clamped. */
export const smooth = (x: number): number => {
  const c = Math.max(0, Math.min(1, x))
  return c * c * (3 - 2 * c)
}

/**
 * One letter's look, from its distance `d` behind the mark's text edge: it appears over
 * `edge` px, then settles from teal to ink over `solid` px. Neither ever goes back, so the
 * caller keeps the larger of the old and new values.
 */
export function letterState(d: number): { opacity: number; settle: number } {
  return { opacity: smooth(d / MARK.edge), settle: smooth((d - MARK.edge) / MARK.solid) }
}

/** How far past the end of the text the front must travel before the last letter has settled to ink. */
export const OVER_CAP = MARK.edge + MARK.solid + MARK.lead + 4

/**
 * Line numbers for letters in reading order, from their vertical centres: a new line starts
 * when the centre drops more than `tol` px below the previous letter's. Letters sharing a
 * centre (cells of one table row) stay on one line, so the path across them still runs left
 * to right.
 */
export function lineOrdinals(centres: readonly number[], tol = 3): number[] {
  const out: number[] = []
  let line = 0
  let ref = -Infinity // the first centre of the current line, so a slightly raised letter does not drift it
  for (const c of centres) {
    if (ref === -Infinity) ref = c
    else if (c > ref + tol) {
      line++
      ref = c
    }
    out.push(line)
  }
  return out
}
