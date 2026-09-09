import { useEffect, useRef } from 'react'
import type { CorpusRegistry, ExplorerBrief } from '@ragtime/client'

import { phasePill, workingLabel } from '../model/format.ts'
import type { Turn } from '../model/turn.ts'
import { Answer } from './Answer.tsx'
import { BriefCard } from './BriefCard.tsx'
import { Markdown } from './Markdown.tsx'

type Props = {
  turns: Turn[]
  brief: ExplorerBrief | null
  proposed: ExplorerBrief | null
  registry: CorpusRegistry | null
  appUrl: string
  now: number
  busy: boolean
  onAccept(brief: ExplorerBrief): void
}

export function Conversation({ turns, brief, proposed, registry, appUrl, now, busy, onAccept }: Props) {
  const end = useRef<HTMLDivElement>(null)
  const lastLabel = useRef('')
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [turns])

  return (
    <div className="conversation">
      {turns.map((turn, i) => {
        const isLast = i === turns.length - 1
        const label = turn.running ? workingLabel(turn, lastLabel.current) : ''
        if (turn.running) lastLabel.current = label
        return (
          <article key={turn.index} className={'turn turn-' + turn.phase}>
            {turn.promptKind === 'accept' ? (
              <div className="marker">research started with the brief</div>
            ) : (
              <div className={'bubble user' + (turn.promptKind === 'reply' ? ' reply' : '')}>{turn.prompt}</div>
            )}

            {turn.narration.map((n, j) => (
              <Markdown key={j} text={n} appUrl={appUrl} className="narration" />
            ))}

            {turn.question && (
              <div className="question" role="group" aria-label="Clarifying question">
                <div className="question-head">
                  <span className="pill">{phasePill(turn)}</span>
                  <span className="hint">one question before any research spends — reply below</span>
                </div>
                <p>{turn.question}</p>
              </div>
            )}

            {turn.brief && (
              <BriefCard
                brief={isLast && proposed ? proposed : turn.brief}
                registry={registry}
                editable={isLast && !brief}
                accepted={!isLast || brief ? brief : null}
                disabled={busy}
                onAccept={onAccept}
              />
            )}

            {turn.answer && <Answer turn={turn} priorTurns={turns.slice(0, i)} brief={brief} appUrl={appUrl} now={now} />}

            {turn.error && (
              <div className="error">
                <b>{turn.error.code}</b> — {turn.error.message}
                {turn.error.retryable && <span className="hint"> · worth trying again</span>}
              </div>
            )}

            {turn.running && (
              <div className="working" aria-live="polite">
                <span className="dot" />
                {label || (turn.phase === 'orient' ? 'getting oriented…' : 'researching…')}
              </div>
            )}
          </article>
        )
      })}
      <div ref={end} />
    </div>
  )
}
