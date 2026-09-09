# apps/explorer

The Explorer page: a conversation that orients before it spends, a trail that shows the work,
and handoffs into the workspaces on the public site. React + Vite, on `@lawfare/ragtime-client`; the
package owns the worker connection and the link grammar, the app owns what is on the screen.

```sh
npm install                             # at the repo root
npm run dev -w ragtime-explorer-app     # http://localhost:8820 — hot-reloads the client package too
npm run check -w ragtime-explorer-app   # tsc, app and vite config
npm test -w ragtime-explorer-app        # node --test over src/model; no DOM, no network
npm run build -w ragtime-explorer-app   # builds @lawfare/ragtime-client to dist/, then the page
```

Open Settings first and paste the Explorer password; it stays in the tab. The worker
defaults to production and the links to https://ragtime.lawfaremedia.org; a local
`wrangler dev` is http://127.0.0.1:8787. `VITE_WORKER_URL` and `VITE_APP_URL` set the
defaults at build time.

## Served behind a gate, where the credential is the server's

`VITE_TURN_URL` names a mount that adds the credential on its own side. Set it and the
page holds none: the Settings dialog offers no password field, nothing is kept in the
tab, and every turn goes to that mount instead of to the worker. Unset — the default —
nothing changes and a visitor pastes the password as before.

```sh
VITE_BASE=/ragtime/explorer/ VITE_TURN_URL=/ragtime/explorer/turn \
  npm run build -w ragtime-explorer-app
```

It is for a deployment already behind a sign-in, where asking a member to paste a shared
password says nothing the sign-in did not. What the mount owes in return is the rule this
side keeps: it refuses a body that carries a credential, resolves its own, and streams the
worker's reply back unchanged. Anyone the gate admits then spends the shared demo
allowance, which is the trade the gate is making.

`model/hop.ts` is the whole of it on this side. The package's `explorer.turn` builds the
credential into the body, so it cannot be the caller; the hop sends the turn itself and
reads the reply with the package's own parser.

### Driving that page without spending anything

`npm run dev` with no `VITE_TURN_URL` serves the **other** page: it opens Settings by
itself, asks for a password, and holds the composer shut until one is pasted. No member of
a gated mount ever sees that screen, so tuning it is tuning the wrong thing — and naming
the real mount instead spends real money on every look.

`dev/hosted-stub.mjs` is the mount with the model taken out: the same event stream in the
order the contract guarantees, carrying a fixed transcript. Two terminals:

```sh
npm run dev:stub   -w ragtime-explorer-app   # the mount, on :8821
npm run dev:hosted -w ragtime-explorer-app   # the page, pointed at it
```

`--refuse ip_quota|demo_quota|cap_cents` makes it refuse every turn instead, which is the
only way to see the quota and cap surfaces without waiting for a real allowance to run out.
`--pace <ms>` slows the stream down to watch the working indicator.

## The first shape, and where each decision lives

The fifteen answers on [ragtime-dev#168](https://github.com/benjaminwittes/ragtime-dev/issues/168)
(2026-09-08) are the shape. Each is one place in the code:

| # | Decision | Where |
|---|---|---|
| 1 | Brief card as a form: goal, corpora chips ordered by drag, answer-shape presets with free text, constraint tags; Accept = Research; JSON underneath | `components/BriefCard.tsx`, `model/brief.ts` |
| 2 | Orient and research narration stays in the conversation, faint — and folded, see below | `model/turn.ts` (`narration`), `components/Conversation.tsx`, `.narration` in `styles.css` |
| 3 | A clarifying question is a distinct block, composer focused, pill reads `orient · asked` | `components/Conversation.tsx`, `model/format.ts` (`phasePill`) |
| 4 | Trail = tool calls + workspace handoffs; document handoffs are sources under the answer | `components/Trail.tsx`, `model/sources.ts` |
| 5 | Structured per-tool summaries, typed | `ExplorerToolDetail` in `@lawfare/ragtime-client`; rendered in `Trail.tsx` |
| 6 | Meter stays; per-turn cost line; per-call cost only in the trail, one line per round | `components/Meter.tsx`, `model/format.ts` (`costLine`, `cents`), `model/turn.ts` (`roundCosts`) |
| 7 | A badge when the round limit or the budget stopped the turn | `model/format.ts` (`stopBadge`), `components/Answer.tsx` |
| 8 | Follow-ups keep the brief; an edited brief starts a new research phase; explicit start over; no auto re-orient | `hooks/useExplorer.ts` |
| 9 | Working indicator from the last event; no thinking display | `model/format.ts` (`workingLabel`) |
| 10 | Empty state: three example questions and registry corpus chips that pin corpora to the brief | `components/EmptyState.tsx`, `model/examples.ts` |
| 11 | Answer shape presets map to renderers: cards, a big number with the workspace handoff, prose, open the document | `model/answer-shape.ts`, `components/Answer.tsx` |
| 12 | Documents read in full shown apart from those only seen in search | `model/sources.ts`, `components/Answer.tsx` |
| — | Search-only answers rendered as a state: "answered from search results; no document was read in full" | `model/sources.ts` (`searchOnly`) |

The pure logic is in `src/model/` and runs under `node --test`; the components are thin over
it. Citations resolve only through `links.fromCitation` (`components/Markdown.tsx`).

## What the mount changed, and what it took to say so

The first shape was designed for the page's own model, where the reader holds the
credential. Behind a mount that holds it instead, four of its answers stopped being true —
found by reading the code and then by looking at the screen on a phone.

| What was wrong | Where it is answered now |
|---|---|
| Settings rendered an editable **Worker** field that reaches nothing when a mount holds the credential: the hop is the only caller, so a member could type in it, press Save, and change nothing | `components/Settings.tsx` — the field is the page's own model only |
| Nothing said the daily allowance is **shared**. The Meter reports this conversation's spend against its 25¢ cap; the pool the worker counts per address per day was invisible, and behind a mount that address is the mount's — so everyone the gate admits draws on one pool and the first signal was a refusal | `model/allowance.ts`, `components/Allowance.tsx`; the Meter's line now names the conversation |
| A quota refusal told a signed-in member to *sign in to continue* — the worker's words for a visitor on the public site, and advice that would change nothing here | `model/allowance.ts` (`explainRefusal`), rewritten once in `hooks/useExplorer.ts` so the header and the turn's error block agree |
| No way back: a full-page app inside a tenant, with the browser's Back button as the only exit | `model/home.ts`, `HOME_URL` in `config.ts` — the mount's own `VITE_BASE` says where the page was linked from; `VITE_HOME_URL` overrides |
| One breakpoint, and under it a 390×844 phone got about **65px** of scrollable answer: the aside was pinned at 40vh and the accepted brief hangs above the conversation rather than scrolling with it | the `@media` block at the end of `styles.css` (last, deliberately); the aside now takes the height its content needs, and the panels that cost the answer its room start closed — everywhere, see below |

## What starts closed, and why it is everywhere rather than on a phone

The first shape opened everything it had. That is the right instinct for a page whose
argument for itself is that it shows its work, and the wrong default for the screen: on a
wide viewport an answer arrived flanked by a trail of every tool call, under a brief the
reader had already accepted, below several paragraphs of the model narrating what it was
about to do. The work was in front of the answer that was asked for.

So four things fold, and all four are one tap from open:

| Folded | Summary reads | Where |
|---|---|---|
| The trail | `Trail — 5 tool calls`, the count from `toolCalls` | `App.tsx`, `model/turn.ts` |
| The narration of a turn | `2 steps` | `components/Conversation.tsx` |
| The source list under an answer | `Sources` beside `2 of 4 cited documents read in full` | `components/Answer.tsx` |
| The accepted brief, pinned and in the transcript | `Brief` beside the goal | `App.tsx`, `components/Conversation.tsx` |

Two rules held while folding. **A summary has to say enough to be worth the tap** — a
closed panel labelled only `Trail` says nothing about whether there is anything in it, so
it carries the count. And **the claim the page makes about its own work does not fold**:
the line that says how many cited documents were actually read, or that none were, is the
summary of the sources rather than something behind it, so it reads whether or not anyone
opens the list. What folds is the list; what stays is the claim.

A **proposed** brief does not fold. It is the one card the reader has to act on, so it
stays open until it is accepted, and folds afterwards — settled state.

Because the answer is now closed on every viewport, nothing outside `styles.css` reads the
breakpoint. `hooks/useNarrow.ts` existed only to decide these `open` attributes on a phone
and is gone; the `@media` block keeps the layout half of the narrow fix.

## Not in the first shape

Sign-in and bring-your-own-key (the client package carries both `AuthArg` modes; the page
uses the demo credential, the beta posture). The distillation panel and the tree view. The
public site resolves `/corpus/:slug/:id` since benjaminwittes/ragtime#166, so a document
link opens its sheet; the `ids=`/`mode=` parameters are still unread there, so a
workspace handoff carrying them lands on the corpus workspace unfiltered.

The allowance panel shows a live count only when the worker sends one (`ip_calls` and
`ip_cap` on the `cost` event, `ExplorerCostEvent` in the client package). Until that
deploys it states the pool and what this conversation spent, and claims nothing about what
other members have used — see ragtime-worker#118.
