/**
 * One turn of the conversation as the page keeps it: the stream from
 * `POST /explorer/turn` folded into what the renderers need. Pure — no React,
 * no DOM — so it runs under `node --test` and the components stay thin.
 *
 * The design answers on ragtime-dev#168 (2026-09-08) are the shape:
 *   2  narration (text the model wrote before a tool call) stays in the
 *      conversation, faint; the text after the last tool round is the answer
 *   4  the trail is tool calls and workspace handoffs; document handoffs are
 *      sources under the answer, never repeated in the trail
 *   6  a per-turn cost line; per-call cost only in the trail, one line per
 *      round (two parallel results each carry a `cost` event — coalesced here)
 *   7  the stop reason, so the answer can wear a badge
 *   9  the last event, so a working indicator can say what is happening
 */

import type {
  ExplorerBrief,
  ExplorerCostEvent,
  ExplorerErrorEvent,
  ExplorerEvent,
  ExplorerHandoffEvent,
  ExplorerPhase,
  ExplorerStop,
  ExplorerToolResultEvent,
} from '@ragtime/client'

export type PromptKind =
  /** The user asked, in their own words (orient, or a research follow-up). */
  | 'ask'
  /** The user answered a clarifying question. */
  | 'reply'
  /** The user accepted a brief; rendered as a marker, not a bubble. */
  | 'accept'

export type TrailCall = {
  step: number
  id: string
  name: string
  input: Record<string, unknown>
  result: ExplorerToolResultEvent | null
}

/** One tool round: every call the model made in one assistant message. */
export type Round = { step: number; calls: TrailCall[] }

export type Turn = {
  index: number
  phase: ExplorerPhase
  prompt: string
  promptKind: PromptKind
  /** Text segments the model wrote before calling a tool — rendered faint (item 2). */
  narration: string[]
  /** The text after the last tool round: the answer, or an orient turn that ended in prose. */
  answer: string
  question: string | null
  brief: ExplorerBrief | null
  rounds: Round[]
  handoffs: ExplorerHandoffEvent[]
  costs: ExplorerCostEvent[]
  error: ExplorerErrorEvent | null
  stop: ExplorerStop | null
  /** Model calls this turn, from `done`. */
  calls: number
  startedAt: number
  endedAt: number | null
  running: boolean
  lastEvent: ExplorerEvent | null
  /** Text since the last tool call; flushed to narration or the answer. */
  buffer: string
}

export function newTurn(index: number, phase: ExplorerPhase, prompt: string, promptKind: PromptKind, now: number): Turn {
  return {
    index,
    phase,
    prompt,
    promptKind,
    narration: [],
    answer: '',
    question: null,
    brief: null,
    rounds: [],
    handoffs: [],
    costs: [],
    error: null,
    stop: null,
    calls: 0,
    startedAt: now,
    endedAt: null,
    running: true,
    lastEvent: null,
    buffer: '',
  }
}

/** The two tools that end an orient turn; they get no result and no round cost. */
export const TERMINAL_TOOLS: ReadonlySet<string> = new Set(['ask_user', 'propose_brief'])

/** Fold one event in. Returns a new turn; the input is not mutated. */
export function applyEvent(turn: Turn, ev: ExplorerEvent, now: number): Turn {
  const t: Turn = { ...turn, lastEvent: ev }
  switch (ev.type) {
    case 'phase':
      if (ev.outcome === 'question' && ev.question) t.question = ev.question
      if (ev.outcome === 'brief' && ev.brief) t.brief = ev.brief
      return t
    case 'text':
      t.buffer = turn.buffer + ev.delta
      return t
    case 'tool_call': {
      if (turn.buffer.trim()) t.narration = turn.narration.concat(turn.buffer.trim())
      t.buffer = ''
      const call: TrailCall = { step: ev.step, id: ev.id, name: ev.name, input: ev.input ?? {}, result: null }
      const rounds = turn.rounds.slice()
      const i = rounds.findIndex((r) => r.step === ev.step)
      if (i === -1) rounds.push({ step: ev.step, calls: [call] })
      else rounds[i] = { step: ev.step, calls: rounds[i]!.calls.concat(call) }
      t.rounds = rounds
      return t
    }
    case 'tool_result': {
      const rounds = turn.rounds.map((r) => ({
        step: r.step,
        calls: r.calls.map((c) => (c.id === ev.id ? { ...c, result: ev } : c)),
      }))
      if (!rounds.some((r) => r.calls.some((c) => c.id === ev.id))) {
        // A result whose call was never seen (a reconnect, a proxy that dropped a frame): keep it.
        const call: TrailCall = { step: ev.step, id: ev.id, name: ev.name, input: {}, result: ev }
        const i = rounds.findIndex((r) => r.step === ev.step)
        if (i === -1) rounds.push({ step: ev.step, calls: [call] })
        else rounds[i] = { step: ev.step, calls: rounds[i]!.calls.concat(call) }
      }
      t.rounds = rounds
      return t
    }
    case 'handoff':
      t.handoffs = turn.handoffs.concat(ev)
      return t
    case 'cost':
      t.costs = turn.costs.concat(ev)
      return t
    case 'error':
      t.error = ev
      return t
    case 'done': {
      t.stop = ev.stop
      t.calls = ev.calls
      t.endedAt = now
      t.running = false
      if (turn.buffer.trim()) t.answer = turn.buffer.trim()
      t.buffer = ''
      return t
    }
    case 'keepalive':
      return t
    default:
      return t
  }
}

/** The last `cost` event, which carries the turn's total and the conversation's. */
export function lastCost(turn: Turn): ExplorerCostEvent | null {
  return turn.costs.length ? turn.costs[turn.costs.length - 1]! : null
}

/**
 * Cents each round added to the turn (item 6: per-call cost only in the trail,
 * and a round's parallel results coalesce to one line). The `cost` events
 * after a round's results all carry the same `turn_cents`, so a round's cost
 * is that value less the previous round's; the closing model call is what
 * the turn total carries beyond the last round.
 */
export function roundCosts(turn: Turn): Map<number, number> {
  const out = new Map<number, number>()
  let prev = 0
  for (const round of turn.rounds) {
    const ids = new Set(round.calls.map((c) => c.id))
    // The cost event that followed this round: the one after its last result.
    let seen = 0
    let cents: number | null = null
    for (let i = 0; i < turn.costs.length; i++) {
      // Costs are emitted one per tool_result, in order; count results per round.
      seen++
      if (seen === cumulativeResults(turn, round.step)) {
        cents = turn.costs[i]!.turn_cents
        break
      }
    }
    if (cents === null || !ids.size) continue
    out.set(round.step, Math.max(0, round4(cents - prev)))
    prev = cents
  }
  return out
}

function cumulativeResults(turn: Turn, step: number): number {
  let n = 0
  for (const r of turn.rounds) {
    if (r.step > step) break
    n += r.calls.filter((c) => c.result !== null).length
  }
  return n
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Whether the turn's wall clock is known. */
export function elapsedMs(turn: Turn, now: number): number {
  return (turn.endedAt ?? now) - turn.startedAt
}
