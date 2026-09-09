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

## The first shape, and where each decision lives

The fifteen answers on [ragtime-dev#168](https://github.com/benjaminwittes/ragtime-dev/issues/168)
(2026-09-08) are the shape. Each is one place in the code:

| # | Decision | Where |
|---|---|---|
| 1 | Brief card as a form: goal, corpora chips ordered by drag, answer-shape presets with free text, constraint tags; Accept = Research; JSON underneath | `components/BriefCard.tsx`, `model/brief.ts` |
| 2 | Orient and research narration stays in the conversation, faint | `model/turn.ts` (`narration`), `.narration` in `styles.css` |
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

## Not in the first shape

Sign-in and bring-your-own-key (the client package carries both `AuthArg` modes; the page
uses the demo credential, the beta posture). The distillation panel and the tree view. The
public site does not yet resolve `/corpus/:slug/:id` or the `ids=`/`mode=` parameters, so a
document link lands on the corpus workspace until the deep-link PR there adopts
`links.parse`.
