import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `@lawfare/ragtime-client` is resolved two ways on purpose. A build reads the package's
// `exports`, which point at `dist/` — what a consumer installing from npm gets, and what
// this app's `build` script emits first. The dev server reads the package sources instead,
// through the alias below, so an edit there hot-reloads here.
//
// The alias is not a convenience: until the package was cut to npm it declared a
// `development` export condition pointing at its own sources, and Vite asked for that
// condition. A published tarball ships `dist` alone, so a `development` condition naming
// `src/` would fail for every consumer — it was rightly dropped, and this monorepo lost
// its source resolution with it. An alias keeps the loss inside this repo.
const CLIENT_SRC = fileURLToPath(new URL('../../packages/client/src/index.ts', import.meta.url))

export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  resolve: command === 'serve' ? { alias: { '@lawfare/ragtime-client': CLIENT_SRC } } : {},
  server: { port: 8820, strictPort: false },
}))
