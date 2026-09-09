/**
 * A turn sent through a hop, which adds the credential on its own side.
 *
 * The page's own model is that a visitor pastes the Explorer password and the tab keeps
 * it (`config.ts`). Where the Explorer is served behind a gate that already knows the
 * reader — a member-gated mount on a tenant — pasting a shared password again says
 * nothing the gate did not, so the mount holds the credential and the page holds none.
 * `VITE_TURN_URL` names that mount at build time and is the whole switch: unset, the page
 * behaves exactly as it did.
 *
 * The package's `explorer.turn` builds the credential into the body, so it cannot be the
 * caller here; this module sends the turn itself and reads the reply with the package's
 * own parser. Nothing else differs — the same request fields, the same event stream, and
 * the same `ExplorerTurnError` for a refusal that arrives before the stream, whether the
 * mount refused it or passed the worker's refusal through.
 *
 * The rule the mount enforces on its side is the one this module keeps on ours: a body
 * that carries a credential is refused, so `hopBody` is built from the request's own
 * fields and has nowhere to put one.
 */

import {
  ExplorerTurnError,
  parseExplorerStream,
  type ExplorerEvent,
  type ExplorerTurnOptions,
  type ExplorerTurnRequest,
} from '@lawfare/ragtime-client'

/** The turn as the hop takes it: the request's own fields, and no credential. */
export function hopBody(req: ExplorerTurnRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { phase: req.phase, messages: req.messages }
  if (req.envelope) body.envelope = req.envelope
  if (req.brief) body.brief = req.brief
  return body
}

/**
 * A refusal that arrived instead of a stream, as the error the page shows. The shape is
 * the worker's `{ error: { code, message } }`, which the mount answers in too, so one
 * reading covers both.
 */
export async function refusalOf(res: Response): Promise<ExplorerTurnError> {
  const text = await res.text()
  let message = text.slice(0, 300) || `HTTP ${res.status}`
  let code: string | null = null
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string; code?: string } }
    if (parsed.error?.message) message = parsed.error.message
    if (parsed.error?.code) code = parsed.error.code
  } catch {
    /* not JSON; the status and the first of the body are what there is */
  }
  return new ExplorerTurnError(res.status, message, code)
}

/** Open one turn against the hop and yield its events in order, as `explorer.turn` does. */
export async function* hopTurn(
  url: string,
  req: ExplorerTurnRequest,
  opts: ExplorerTurnOptions = {},
): AsyncGenerator<ExplorerEvent, void, undefined> {
  const doFetch = opts.fetch ?? globalThis.fetch
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
    body: JSON.stringify(hopBody(req)),
    signal: opts.signal,
  })
  if (!res.ok) throw await refusalOf(res)
  if (!res.body) throw new ExplorerTurnError(res.status, 'The mount returned no stream body')
  yield* parseExplorerStream(res.body)
}
