import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `@lawfare/ragtime-client` resolves through its package `exports`: the `development`
// condition (which Vite's dev server asks for) points at the package sources,
// so edits there hot-reload here; `vite build` asks for `production` and reads
// `dist/`, which this app's `build` script emits first.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { port: 8820, strictPort: false },
})
