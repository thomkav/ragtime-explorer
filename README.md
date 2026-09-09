# ragtime-explorer

RAGtime Explorer: a chat-forward second front door to [RAGtime](https://ragtime.lawfaremedia.org)
that shows its work, and the shared client package the RAGtime browser UXs build on.

The brief, the contract and the design questions live on
[benjaminwittes/ragtime-dev#168](https://github.com/benjaminwittes/ragtime-dev/issues/168). The
worker endpoint it talks to, `POST /explorer/turn`, is in `benjaminwittes/ragtime-worker`.

| Path | What | Status |
|---|---|---|
| `packages/client` | `@ragtime/client` — the worker connection, the Explorer turn stream, the registry, the deep-link grammar | lifted from the public frontend; `tsc --strict` and tests green |
| `apps/explorer` | the Explorer page | not started; begins from the mock |

```sh
npm install
npm run check      # every workspace
npm test           # every workspace; no network
```

Node 22.18 or later. The client package's README says how to run its one live test against an
endpoint.

## Why a monorepo, and why the client is a package

Explorer is the second of a family of interfaces over the same worker; the point of this
repo is to make the third one cheap. The client package owns the connection and the link
grammar so the public frontend, Explorer and whatever comes next build URLs and read events
the same way. The app stays framework-bound; the package does not.
