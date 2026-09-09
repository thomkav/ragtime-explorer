import { useEffect, useState } from 'react'

import { DAILY_MODEL_CALLS, HOME_LABEL, HOME_URL, HOSTED, loadSettings, saveSettings, type Settings as SettingsValue } from './config.ts'
import { useExplorer } from './hooks/useExplorer.ts'
import { QUOTA_CODES, allowance } from './model/allowance.ts'
import { plural } from './model/format.ts'
import { conversationCost, toolCalls } from './model/turn.ts'
import { Allowance } from './components/Allowance.tsx'
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
  // Behind a mount that holds the credential the worker counts the day's model calls
  // against the mount's address, so the allowance is one pool shared by everyone the gate
  // admits (`model/allowance.ts`). On the page's own model it is the visitor's network.
  const pool = allowance({
    cost: conversationCost(x.turns),
    fallbackCap: DAILY_MODEL_CALLS,
    shared: HOSTED,
    refusalCode: x.refusal?.code ?? null,
  })
  const calls = toolCalls(x.turns)
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
        {/* A full-page app inside a tenant needs a door back to the page that linked to
            it; without one the browser's Back button is the only exit (`model/home.ts`).
            Empty off a mount, where the Explorer is the whole site. */}
        {HOME_URL && (
          <a className="home" href={HOME_URL}>
            ← {HOME_LABEL}
          </a>
        )}
        <h1>
          RAGtime Explorer <span className="beta">beta</span>
        </h1>
        <span className="pill">{x.phase}</span>
        <span className="grow" />
        {/* A refusal the page already renders somewhere it is being looked at is not worth
            a third copy in the header: the conversation cap wears a badge on the answer,
            and an exhausted allowance turns the Allowance panel red and stops the turn
            with its own error block. What is left — no credential, a bad envelope, a
            network that dropped — has nowhere else to appear. */}
        {x.refusal && x.refusal.code !== 'cap_cents' && !QUOTA_CODES.has(x.refusal.code ?? '') && (
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
              <BriefCard
                brief={x.brief}
                registry={x.registry}
                editable={false}
                accepted={x.brief}
                disabled={x.busy}
                startOpen={false}
                onAccept={x.accept}
              />
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
          <Allowance value={pool} conversationCalls={x.totalCalls} />
          <div className="scroll">
            {/* The meter and the allowance are what a member must not have to go looking
                for. The trail is the page's argument that it shows its work, which is not
                the same as the work being the first thing on the screen: opened by default
                it is a wall of tool calls beside an answer nobody has read yet. So it
                starts closed everywhere and says in its summary how much is behind it —
                the count is what makes a closed panel worth a tap. */}
            <details className="trail-panel">
              <summary className="trail-summary">
                Trail{calls > 0 ? ' — ' + plural(calls, 'tool call') : ' — every tool call and what it cost'}
              </summary>
              <Trail turns={x.turns} appUrl={settings.appUrl} />
            </details>
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
