import { DEFAULT_WORKER_URL } from '@lawfare/ragtime-client'

import { parentPath } from './model/home.ts'

export const DEFAULT_APP_URL = 'https://ragtime.lawfaremedia.org'

export type Settings = {
  /** The worker origin; a local `wrangler dev` is `http://127.0.0.1:8787`. */
  workerUrl: string
  /** The public site the deep links open on. */
  appUrl: string
  /** The Explorer demo credential, pasted once; kept for the tab only. */
  password: string
}

/**
 * A mount that adds the credential on its own side, named at build time. Empty is the
 * page's own model: a visitor pastes the password and the tab keeps it. Set, the page
 * holds no credential at all and every turn goes here instead of to the worker — which
 * is what a deployment behind a gate that already knows the reader wants (`model/hop.ts`).
 */
export const TURN_URL = ((import.meta.env.VITE_TURN_URL as string | undefined) || '').trim()

/** Whether a hop holds the credential, which is the one thing that decides. */
export const HOSTED = TURN_URL !== ''

/**
 * The daily allowance on model calls for a caller without a paid account:
 * `IP_DAILY_MODEL_CALLS` in the worker's `explorer.js`, counted per address per UTC day.
 *
 * Stated here so the page can say what the limit is before a turn has told it. A `cost`
 * event carrying `ip_cap` supersedes it, and is the number to believe; this one only has
 * to be right on the first screen a member sees. If the worker's constant moves, this
 * follows it.
 */
export const DAILY_MODEL_CALLS = 60

/**
 * Where the link out of the page goes, and what it is called. Empty means the page is the
 * whole site and wears no such link — the default off a mount, and always true of the
 * page's own model. See `model/home.ts` for why the mount's base answers this.
 */
export const HOME_URL =
  ((import.meta.env.VITE_HOME_URL as string | undefined) || '').trim() ||
  (HOSTED ? parentPath((import.meta.env.BASE_URL as string | undefined) || '/') : '')

export const HOME_LABEL = ((import.meta.env.VITE_HOME_LABEL as string | undefined) || '').trim() || 'RAGtime'

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
