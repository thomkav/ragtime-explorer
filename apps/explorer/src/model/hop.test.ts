import { test } from 'node:test'
import assert from 'node:assert/strict'

import { ExplorerTurnError, type ExplorerEvent, type ExplorerTurnRequest } from '@lawfare/ragtime-client'
import { hopBody, hopTurn, refusalOf } from './hop.ts'

const MOUNT = '/ragtime/explorer/turn'

const ask: ExplorerTurnRequest = {
  phase: 'orient',
  messages: [{ role: 'user', content: 'Which corpora hold the OLC opinions?' }],
}

/** An SSE reply, framed the way the worker frames one. */
function stream(...frames: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame))
      controller.close()
    },
  })
}

function frame(name: string, data: Record<string, unknown>): string {
  return 'event: ' + name + '\ndata: ' + JSON.stringify(data) + '\n\n'
}

/** A fetch that answers with one response and records what it was asked. */
function recorder(res: Response): { fetch: typeof globalThis.fetch; seen: { url: string; init: RequestInit }[] } {
  const seen: { url: string; init: RequestInit }[] = []
  const fetch = ((url: string, init: RequestInit) => {
    seen.push({ url, init })
    return Promise.resolve(res)
  }) as unknown as typeof globalThis.fetch
  return { fetch, seen }
}

test('hopBody carries the turn and nothing else', () => {
  assert.deepEqual(hopBody(ask), { phase: 'orient', messages: ask.messages })

  const research: ExplorerTurnRequest = {
    phase: 'research',
    messages: ask.messages,
    envelope: 'signed.envelope',
    brief: { goal: 'Count them', corpora: ['olc'], answer_shape: 'a count' },
  }
  const body = hopBody(research)
  assert.equal(body.envelope, 'signed.envelope')
  assert.deepEqual(body.brief, research.brief)
})

test('hopBody has nowhere to put a credential', () => {
  // The mount refuses a body that carries one, so the page must not be able to send one
  // by accident: every field here comes off the request, and a request has no credential.
  const carrying = { ...ask, password: 'nope', user_api_key: 'nope' } as ExplorerTurnRequest
  const body = hopBody(carrying)
  assert.deepEqual(Object.keys(body).sort(), ['messages', 'phase'])
})

test('hopTurn sends the turn to the mount, with no credential and no authorization', async () => {
  const { fetch, seen } = recorder(new Response(stream(frame('done', { stop: 'end_turn' })), { status: 200 }))
  const events: ExplorerEvent[] = []
  for await (const ev of hopTurn(MOUNT, ask, { fetch })) events.push(ev)

  assert.equal(events.length, 1)
  assert.equal(seen.length, 1)
  assert.equal(seen[0]!.url, MOUNT)
  assert.equal(seen[0]!.init.method, 'POST')
  const headers = seen[0]!.init.headers as Record<string, string>
  assert.equal(headers.authorization, undefined)
  assert.equal(headers.accept, 'text/event-stream')
  const sent = JSON.parse(String(seen[0]!.init.body)) as Record<string, unknown>
  assert.equal('password' in sent, false)
  assert.equal('user_api_key' in sent, false)
  assert.equal('provider' in sent, false)
})

test('hopTurn yields the events the mount streamed back', async () => {
  const { fetch } = recorder(
    new Response(
      stream(
        frame('phase', { phase: 'orient' }),
        frame('text', { delta: 'The OLC opinions are ' }),
        frame('text', { delta: 'in one corpus.' }),
        frame('done', { stop: 'end_turn' }),
      ),
      { status: 200 },
    ),
  )
  const events: ExplorerEvent[] = []
  for await (const ev of hopTurn(MOUNT, ask, { fetch })) events.push(ev)

  assert.deepEqual(
    events.map((e) => e.type),
    ['phase', 'text', 'text', 'done'],
  )
})

test('a refusal before the stream is an ExplorerTurnError carrying the code', async () => {
  const { fetch } = recorder(
    new Response(JSON.stringify({ error: { code: 'no_credential', message: 'The Explorer is not configured here.' } }), {
      status: 503,
    }),
  )
  await assert.rejects(
    async () => {
      for await (const event of hopTurn(MOUNT, ask, { fetch })) void event
    },
    (err: unknown) => {
      assert.ok(err instanceof ExplorerTurnError)
      assert.equal(err.status, 503)
      assert.equal(err.code, 'no_credential')
      assert.equal(err.message, 'The Explorer is not configured here.')
      return true
    },
  )
})

test('a refusal that is not JSON keeps its status and its first words', async () => {
  const err = await refusalOf(new Response('upstream is down', { status: 502 }))
  assert.equal(err.status, 502)
  assert.equal(err.code, null)
  assert.equal(err.message, 'upstream is down')
})
