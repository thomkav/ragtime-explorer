import { DEFAULT_WORKER_URL } from '@lawfare/ragtime-client'

export const DEFAULT_APP_URL = 'https://ragtime.lawfaremedia.org'

export type Settings = {
  /** The worker origin; a local `wrangler dev` is `http://127.0.0.1:8787`. */
  workerUrl: string
  /** The public site the deep links open on. */
  appUrl: string
  /** The Explorer demo credential, pasted once; kept for the tab only. */
  password: string
}

const KEY = 'ragtime-explorer.settings'

const defaults: Settings = {
  workerUrl: (import.meta.env.VITE_WORKER_URL as string | undefined) || DEFAULT_WORKER_URL,
  appUrl: (import.meta.env.VITE_APP_URL as string | undefined) || DEFAULT_APP_URL,
  password: '',
}

export function loadSettings(): Settings {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      workerUrl: parsed.workerUrl || defaults.workerUrl,
      appUrl: parsed.appUrl || defaults.appUrl,
      password: parsed.password || '',
    }
  } catch {
    return defaults
  }
}

export function saveSettings(s: Settings): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode; the tab keeps it in memory */
  }
}

/** A deep-link path from the worker or the link grammar, on the public site. */
export function onApp(appUrl: string, path: string): string {
  return appUrl.replace(/\/+$/, '') + path
}
