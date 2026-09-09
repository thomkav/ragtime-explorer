import { useEffect, useRef, useState } from 'react'

import { HOSTED, type Settings as SettingsValue } from '../config.ts'

type Props = {
  open: boolean
  value: SettingsValue
  onSave(next: SettingsValue): void
  onClose(): void
}

/** Where the worker is, where links open, and the Explorer password — pasted once, kept for the tab. */
export function Settings({ open, value, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog ref={dialog} className="settings" onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault()
          onSave({ workerUrl: draft.workerUrl.trim(), appUrl: draft.appUrl.trim(), password: draft.password.trim() })
          onClose()
        }}
      >
        <h3>Settings</h3>
        {HOSTED ? (
          <p className="hint">This Explorer is served behind a sign-in, and the credential is the server's — there is nothing to paste.</p>
        ) : (
          <label className="field">
            <span className="label">Explorer password</span>
            <input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} placeholder="paste once" autoComplete="off" />
            <span className="hint">Kept in this tab only. Sixty model calls a day per network without it.</span>
          </label>
        )}
        <label className="field">
          <span className="label">Worker</span>
          <input value={draft.workerUrl} onChange={(e) => setDraft({ ...draft, workerUrl: e.target.value })} spellCheck={false} />
          <span className="hint">A local wrangler dev is http://127.0.0.1:8787</span>
        </label>
        <label className="field">
          <span className="label">Links open on</span>
          <input value={draft.appUrl} onChange={(e) => setDraft({ ...draft, appUrl: e.target.value })} spellCheck={false} />
        </label>
        <div className="brief-actions">
          <button type="submit" className="primary">
            Save
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
