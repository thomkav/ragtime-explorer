/**
 * The hosted mount, faked, so the hosted page can be driven for nothing.
 *
 * `VITE_TURN_URL` is the one switch that decides what the page is (`src/config.ts`):
 * unset, `npm run dev` serves the password path — a Settings dialog that opens by
 * itself and a composer held shut until a credential is pasted. No member of a gated
 * mount ever sees that screen. Set, the page holds no credential and posts every turn
 * to the named mount. So looking at what a member sees means having a mount to name,
 * and naming the real one spends real money on every look.
 *
 * This is that mount with the model taken out: the same `text/event-stream` in the same
 * order the contract guarantees (phase first, cost after every tool result, done last),
 * carrying a transcript shaped like a turn measured on 2026-09-09. Nothing here reaches
 * a network, a corpus or a credential.
 *
 *   node apps/explorer/dev/hosted-stub.mjs &
 *   VITE_TURN_URL=http://127.0.0.1:8821/turn npm run dev -w ragtime-explorer-app
 *
 * `--refuse <code>` answers every turn with a refusal instead, which is the only way to
 * see the quota and cap surfaces without waiting for a real allowance to run out:
 * `ip_quota`, `demo_quota`, `cap_cents`. `--stale` drops the allowance fields from the
 * `cost` event, which is what a worker deployed before ragtime-worker#118 sends.
 */

import { createServer } from 'node:http'

const args = process.argv.slice(2)

function readArg(name) {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}

const port = Number(readArg('--port') ?? 8821)
const refuse = readArg('--refuse')
const pace = Number(readArg('--pace') ?? 25)
/**
 * The day's allowance on the `cost` event (ragtime-worker#118). `--stale` leaves both
 * fields off, which is what a worker deployed before that PR sends and what the page has
 * to keep reading — the allowance panel then states the pool and claims no count.
 */
const stale = args.includes('--stale')
const allowanceStart = Number(readArg('--spent') ?? 22)

const REFUSALS = {
  ip_quota: [429, 'Daily Explorer allowance for this network reached (60 model calls). Sign in to continue, or try again tomorrow.'],
  demo_quota: [429, 'This credential has used its daily allowance. Try again tomorrow.'],
  cap_cents: [402, 'This conversation has reached its spend cap (25 cents). Start a new one.'],
}

const BRIEF = {
  goal: 'Find what the Office of Legal Counsel has said about presidential emergency powers over communications networks.',
  corpora: ['olc', 'usc', 'cfr'],
  answer_shape: 'list',
  constraints: ['Executive branch legal opinions', 'Emergency and wartime authorities'],
}

const ANSWER = `The Office of Legal Counsel has addressed presidential authority over communications networks in emergencies several times, most substantially around section 706 of the Communications Act.

- [Presidential Authority Over Communications Facilities in Wartime](rt://olc/112) — 1978 — reads section 706 as reaching wire and radio facilities on a presidential proclamation of a state of war or threat of war.
- [Emergency Control of Radio Stations](rt://olc/1425) — 1982 — treats the proclamation, not the emergency itself, as the operative trigger.
- [Use of the National Emergencies Act](rt://olc/908) — 1995 — separates the Act's procedural machinery from any substantive grant of authority.
- [Authority to Seize Telecommunications Assets](rt://olc/1866) — 2001 — declines to read a seizure power into the statute without an appropriation.

The opinions agree on the trigger and divide on scope: the 1978 and 1982 opinions read section 706 broadly, the 2001 opinion narrowly.`

const ORIENT = [
  ['phase', { phase: 'orient' }],
  ['text', { delta: 'Reading the question for what would count as an answer. ' }],
  ['tool_call', { step: 1, id: 't1', name: 'search_keyword', input: { query: 'presidential emergency communications', corpora: ['olc'] } }],
  ['tool_result', {
    step: 1, id: 't1', name: 'search_keyword', ok: true, cost_cents: 0, ms: 412,
    summary: 'olc 34 hits',
    detail: { kind: 'search', total: 34, hits: [{ corpus: 'olc', count: 34, top: [
      { id: 112, title: 'Presidential Authority Over Communications Facilities in Wartime' },
      { id: 1425, title: 'Emergency Control of Radio Stations' },
      { id: 908, title: 'Use of the National Emergencies Act' },
    ] }] },
  }],
  ['cost', { turn_cents: 0.61, conversation_cents: 1, conversation_spend: 0.61, cap_cents: 25, steps: 1, step_cap: 6 }],
  ['text', { delta: 'The Office of Legal Counsel opinions are the right place, with the statute and the regulations behind them. ' }],
  ['tool_call', { step: 2, id: 't2', name: 'propose_brief', input: { brief: BRIEF } }],
  ['tool_result', { step: 2, id: 't2', name: 'propose_brief', ok: true, cost_cents: 0, ms: 3, summary: 'brief proposed', detail: { kind: 'text', chars: 284 } }],
  ['phase', { phase: 'orient', outcome: 'brief', brief: BRIEF }],
  ['cost', { turn_cents: 0.9, conversation_cents: 1, conversation_spend: 0.9, cap_cents: 25, steps: 2, step_cap: 6 }],
  ['done', { envelope: 'stub.envelope.orient', stop: 'end_turn', history: [], calls: 3 }],
]

const RESEARCH = [
  ['phase', { phase: 'research' }],
  ['tool_call', { step: 1, id: 'r1', name: 'search_semantic', input: { query: 'emergency control of wire and radio facilities', corpora: ['olc', 'usc'] } }],
  ['tool_call', { step: 1, id: 'r2', name: 'search_keyword', input: { query: 'section 706 Communications Act', corpora: ['olc'] } }],
  ['tool_result', {
    step: 1, id: 'r1', name: 'search_semantic', ok: true, cost_cents: 0, ms: 806,
    summary: 'olc 12 hits · usc 3 hits',
    detail: { kind: 'search', total: 15, hits: [
      { corpus: 'olc', count: 12, top: [
        { id: 112, title: 'Presidential Authority Over Communications Facilities in Wartime' },
        { id: 1866, title: 'Authority to Seize Telecommunications Assets' },
      ] },
      { corpus: 'usc', count: 3, top: [{ id: '47-606', title: '47 U.S.C. 606 — War powers of the President' }] },
    ] },
  }],
  ['tool_result', {
    step: 1, id: 'r2', name: 'search_keyword', ok: true, cost_cents: 0, ms: 291,
    summary: 'olc 8 hits',
    detail: { kind: 'search', total: 8, hits: [{ corpus: 'olc', count: 8, top: [
      { id: 1425, title: 'Emergency Control of Radio Stations' },
      { id: 908, title: 'Use of the National Emergencies Act' },
    ] }] },
  }],
  ['cost', { turn_cents: 2.1, conversation_cents: 3, conversation_spend: 3.0, cap_cents: 25, steps: 1, step_cap: 8 }],
  ['tool_call', { step: 2, id: 'r3', name: 'fetch_documents', input: { corpus: 'olc', ids: [112, 1425], mode: 'full' } }],
  ['tool_result', {
    step: 2, id: 'r3', name: 'fetch_documents', ok: true, cost_cents: 0, ms: 1204,
    summary: 'olc 2 documents, 48,210 characters',
    detail: { kind: 'documents', corpus: 'olc', mode: 'full', count: 2, documents: [
      { id: 112, title: 'Presidential Authority Over Communications Facilities in Wartime', chars: 31204 },
      { id: 1425, title: 'Emergency Control of Radio Stations', chars: 17006 },
    ] },
  }],
  ['cost', { turn_cents: 4.4, conversation_cents: 6, conversation_spend: 5.3, cap_cents: 25, steps: 2, step_cap: 8 }],
  ...ANSWER.match(/[\s\S]{1,90}/g).map((delta) => ['text', { delta }]),
  ['handoff', { kind: 'document', url: '/corpus/olc/112', label: 'Presidential Authority Over Communications Facilities in Wartime' }],
  ['handoff', { kind: 'document', url: '/corpus/olc/1425', label: 'Emergency Control of Radio Stations' }],
  ['handoff', { kind: 'workspace', url: '/?q=section%20706%20emergency&corpus=olc', label: 'This search in the OLC workspace' }],
  ['cost', { turn_cents: 6.4, conversation_cents: 8, conversation_spend: 7.3, cap_cents: 25, steps: 3, step_cap: 8 }],
  ['done', { envelope: 'stub.envelope.research', stop: 'end_turn', history: [], calls: 3 }],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The day's model calls so far, across every turn this process serves. */
let spent = allowanceStart

const server = createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type, accept')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  if (!req.url.startsWith('/turn')) return res.writeHead(404).end('not the mount')

  let body = ''
  for await (const chunk of req) body += chunk
  const parsed = body ? JSON.parse(body) : {}

  if (refuse) {
    const [status, message] = REFUSALS[refuse] ?? [429, 'Refused.']
    res.writeHead(status, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ error: { code: refuse, message } }))
  }

  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
  const script = parsed.phase === 'research' ? RESEARCH : ORIENT
  for (const [name, data] of script) {
    // The allowance is the day's, not the conversation's, so it keeps counting across
    // turns the way the worker's own per-address counter does.
    const payload = name === 'cost' && !stale ? { ...data, ip_calls: (spent += 1), ip_cap: 60 } : data
    res.write('event: ' + name + '\ndata: ' + JSON.stringify(payload) + '\n\n')
    await sleep(name === 'text' ? Math.max(4, pace / 3) : pace)
  }
  res.end()
})

server.listen(port, '127.0.0.1', () => {
  console.log('hosted stub on http://127.0.0.1:' + port + '/turn' + (refuse ? ' — refusing every turn with ' + refuse : ''))
})
