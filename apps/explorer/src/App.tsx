import { useEffect, useState } from 'react'

import { HOSTED, loadSettings, saveSettings, type Settings as SettingsValue } from './config.ts'
import { useExplorer } from './hooks/useExplorer.ts'
import { BriefCard } from './components/BriefCard.tsx'
import { Composer } from './components/Composer.tsx'
import { Conversation } from './components/Conversation.tsx'
import { EmptyState } from './components/EmptyState.tsx'
import { Meter } from './components/Meter.tsx'
import { Settings } from './components/Settings.tsx'
import { Trail } from './components/Trail.tsx'

export default function App() {
  const [settings, setSettings] = useState<SettingsValue>(loadSettings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const x = useExplorer(settings)
  // Behind a hop the credential is the mount's, so the page asks for nothing and the
  // composer is never held shut waiting for a password nobody here has to type.
  const needsPassword = !HOSTED && !settings.password

  // A one-second clock for the running turn's elapsed time; idle otherwise.
  useEffect(() => {
    if (!x.busy) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [x.busy])
  useEffect(() => {
    if (!x.busy) setNow(Date.now())
  }, [x.busy, x.turns.length])
  useEffect(() => {
    if (needsPassword) setSettingsOpen(true)
  }, [needsPassword])

  const placeholder = x.awaitingReply
    ? 'Reply to the question'
    : x.phase === 'research'
      ? 'Ask a follow-up — same brief; edit the brief above for a new one'
      : 'What do you want to know? Orient decides how to research it before anything spends.'

  return (
    <div className="app">
      <header className="top">
        <h1>
          RAGtime Explorer <span className="beta">beta</span>
        </h1>
        <span className="pill">{x.phase}</span>
        <span className="grow" />
        {x.refusal && x.refusal.code !== 'cap_cents' && (
          <span className="refusal" role="alert">
            {x.refusal.message}
          </span>
        )}
        <button type="button" className="secondary" onClick={() => setSettingsOpen(true)}>
          Settings{needsPassword && ' · password needed'}
        </button>
        <button type="button" className="secondary" onClick={x.startOver} disabled={!x.turns.length}>
          Start over
        </button>
      </header>

      <main className="main">
        <section className="left">
          {x.brief && (
            <div className="brief-bar">
              <BriefCard brief={x.brief} registry={x.registry} editable={false} accepted={x.brief} disabled={x.busy} onAccept={x.accept} />
            </div>
          )}
          <div className="scroll">
            {x.turns.length === 0 ? (
              <EmptyState registry={x.registry} pinned={x.pinned} disabled={x.busy || needsPassword} onAsk={x.ask} onTogglePin={x.togglePin} />
            ) : (
              <Conversation
                turns={x.turns}
                brief={x.brief}
                proposed={x.proposed}
                registry={x.registry}
                appUrl={settings.appUrl}
                now={now}
                busy={x.busy}
                onAccept={x.accept}
              />
            )}
          </div>
          <Composer
            placeholder={placeholder}
            disabled={x.busy || needsPassword || (x.phase === 'orient' && !!x.proposed && !x.awaitingReply)}
            focusKey={x.turns.filter((t) => t.question).length}
            onSend={x.ask}
          />
        </section>
        <aside className="right">
          <Meter turns={x.turns} phase={x.phase} totalCalls={x.totalCalls} />
          <div className="scroll">
            <Trail turns={x.turns} appUrl={settings.appUrl} />
          </div>
        </aside>
      </main>

      <Settings
        open={settingsOpen}
        value={settings}
        onSave={(next) => {
          setSettings(next)
          saveSettings(next)
        }}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  )
}
