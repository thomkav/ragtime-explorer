import type { ExplorerBrief } from '@lawfare/ragtime-client'

import { onApp } from '../config.ts'
import { detectShape, firstCitation, firstNumber, linkifyCitations, splitListAnswer } from '../model/answer-shape.ts'
import { costLine, stopBadge } from '../model/format.ts'
import { knownTitles, sourcesOf, workspaceHandoffs } from '../model/sources.ts'
import type { Turn } from '../model/turn.ts'
import { Markdown } from './Markdown.tsx'

type Props = {
  turn: Turn
  priorTurns: readonly Turn[]
  brief: ExplorerBrief | null
  appUrl: string
  now: number
}

/**
 * A research answer, rendered by the brief's answer shape (design item 11):
 * a list as cards titled by the citation, a count as a big number with the
 * workspace handoff, a narrative as prose, a document as a way into the
 * detail sheet. Under it: the badge a capped turn wears (item 7), the
 * per-turn cost line (item 6), and the sources (item 12) with the
 * search-only state said plainly.
 */
export function Answer({ turn, priorTurns, brief, appUrl, now }: Props) {
  const shape = turn.phase === 'research' ? detectShape(brief?.answer_shape) : 'narrative'
  const badge = stopBadge(turn.stop)
  const report = sourcesOf(turn, priorTurns)
  const workspaces = workspaceHandoffs(turn)
  const titles = knownTitles(turn, priorTurns)
  // Every citation form as a link before anything renders; the raw text stays for the count, whose first number must not be an id.
  const answer = linkifyCitations(turn.answer, titles)

  let body: React.ReactNode
  if (shape === 'list') {
    const split = splitListAnswer(answer)
    body = split.cards.length ? (
      <>
        {split.lead && <Markdown text={split.lead} appUrl={appUrl} titles={titles} />}
        <ol className="cards">
          {split.cards.map((c, i) => (
            <li key={i} className="card">
              <div className="card-title">
                {c.path ? (
                  <a href={onApp(appUrl, c.path)} target="_blank" rel="noreferrer noopener">
                    {c.title}
                  </a>
                ) : (
                  c.title
                )}
              </div>
              {c.body && <Markdown text={c.body} appUrl={appUrl} className="card-body" titles={titles} />}
            </li>
          ))}
        </ol>
        {split.rest && <Markdown text={split.rest} appUrl={appUrl} titles={titles} />}
      </>
    ) : (
      <Markdown text={answer} appUrl={appUrl} titles={titles} />
    )
  } else if (shape === 'count') {
    const n = firstNumber(turn.answer)
    const ws = workspaces[0]
    body = (
      <>
        {n && (
          <div className="count">
            <span className="count-number">{n}</span>
            {ws && (
              <a className="count-link" href={onApp(appUrl, ws.url)} target="_blank" rel="noreferrer noopener">
                open in the workspace ↗
              </a>
            )}
          </div>
        )}
        <Markdown text={answer} appUrl={appUrl} titles={titles} />
      </>
    )
  } else if (shape === 'document') {
    const c = firstCitation(answer)
    body = (
      <>
        {c && (
          <a className="document-open" href={onApp(appUrl, c.path)} target="_blank" rel="noreferrer noopener">
            Open {titles.get(c.path) ?? c.title} ↗
          </a>
        )}
        <Markdown text={answer} appUrl={appUrl} titles={titles} />
      </>
    )
  } else {
    body = <Markdown text={answer} appUrl={appUrl} titles={titles} />
  }

  return (
    <div className="answer">
      {body}
      {badge && <div className={'badge badge-' + badge.tone}>{badge.text}</div>}
      <div className="cost-line">{costLine(turn, now)}</div>
      {turn.phase === 'research' && (report.sources.length > 0 || report.readUncited.length > 0 || turn.answer) && (
        <div className="sources">
          <div className="sources-head">Sources</div>
          {report.searchOnly && <div className="sources-state">Answered from search results; no document was read in full.</div>}
          {!report.searchOnly && report.sources.length > 0 && (
            <div className="sources-state">
              {report.readCount} of {report.sources.length} cited {report.sources.length === 1 ? 'document' : 'documents'} read in full
            </div>
          )}
          {report.sources.length > 0 && (
            <ul className="source-list">
              {report.sources.map((s) => (
                <li key={s.slug + '/' + s.id} className={s.read ? 'read' : 'seen'}>
                  <span className={'tag ' + (s.read ? 'tag-read' : 'tag-seen')}>{s.read ? 'read' : 'from search'}</span>
                  <a href={onApp(appUrl, s.path)} target="_blank" rel="noreferrer noopener">
                    {s.title}
                  </a>
                  <span className="source-slug">{s.slug}</span>
                </li>
              ))}
            </ul>
          )}
          {report.readUncited.length > 0 && (
            <div className="sources-extra">
              Also read, not cited:{' '}
              {report.readUncited.map((s, i) => (
                <span key={s.slug + '/' + s.id}>
                  {i > 0 && ', '}
                  <a href={onApp(appUrl, s.path)} target="_blank" rel="noreferrer noopener">
                    {s.title}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
