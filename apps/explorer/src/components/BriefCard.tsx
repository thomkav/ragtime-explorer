import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { CorpusRegistry, ExplorerBrief } from '@ragtime/client'

import { ANSWER_SHAPES, detectShape } from '../model/answer-shape.ts'
import { briefJson, moveCorpus, normalizeBrief, sameBrief } from '../model/brief.ts'

type Props = {
  brief: ExplorerBrief
  registry: CorpusRegistry | null
  /** Editable and awaiting acceptance; otherwise the accepted brief, compact, with an Edit affordance. */
  editable: boolean
  /** The accepted brief, when this card shows a proposal that was accepted (possibly edited). */
  accepted?: ExplorerBrief | null
  disabled?: boolean
  onAccept(brief: ExplorerBrief): void
}

/**
 * The brief as a form (design item 1): goal as one line, corpora as
 * removable chips ordered by drag, answer shape as preset chips with a
 * free-text option, constraints as tags. Accept = "Research". The JSON stays
 * underneath: it is what the worker hashes into the envelope. Item 8: an
 * accepted brief shows compact; editing it and accepting again starts a new
 * research phase with the edited brief.
 */
export function BriefCard({ brief, registry, editable, accepted, disabled, onAccept }: Props) {
  const [draft, setDraft] = useState<ExplorerBrief>(brief)
  const [editing, setEditing] = useState(editable)
  const [constraint, setConstraint] = useState('')
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  useEffect(() => {
    setDraft(brief)
    setEditing(editable)
  }, [brief, editable])

  const known = registry?.corpora ?? []
  const nameOf = (slug: string) => known.find((c) => c.slug === slug)?.name ?? slug
  const remaining = known.filter((c) => !draft.corpora.includes(c.slug))
  const shape = detectShape(draft.answer_shape)
  const changed = !sameBrief(normalizeBrief(draft), accepted ?? brief)

  const set = (patch: Partial<ExplorerBrief>) => setDraft((d) => ({ ...d, ...patch }))
  const removeCorpus = (slug: string) => set({ corpora: draft.corpora.filter((c) => c !== slug) })
  const addConstraint = () => {
    const c = constraint.trim()
    if (!c) return
    set({ constraints: (draft.constraints ?? []).concat(c) })
    setConstraint('')
  }
  const onConstraintKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addConstraint()
    }
  }
  const onDrop = (e: DragEvent<HTMLElement>, to: number) => {
    e.preventDefault()
    if (dragFrom === null) return
    set({ corpora: moveCorpus(draft.corpora, dragFrom, to) })
    setDragFrom(null)
  }
  const canResearch = draft.goal.trim() !== '' && draft.corpora.length > 0 && !disabled

  if (!editing) {
    const shown = accepted && !editable ? accepted : brief
    return (
      <section className="brief brief-compact" aria-label="Research brief">
        <div className="brief-head">
          <span className="brief-title">{accepted ? 'Brief' : 'Proposed brief'}</span>
          {accepted && (
            <button type="button" className="link" onClick={() => setEditing(true)} disabled={disabled}>
              Edit
            </button>
          )}
        </div>
        <p className="brief-goal">{shown.goal}</p>
        <div className="chips">
          {shown.corpora.map((c) => (
            <span key={c} className="chip chip-static" title={c}>
              {nameOf(c)}
            </span>
          ))}
          <span className="chip chip-shape">{shown.answer_shape}</span>
          {(shown.constraints ?? []).map((k) => (
            <span key={k} className="chip chip-tag">
              {k}
            </span>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section className="brief" aria-label="Research brief">
      <div className="brief-head">
        <span className="brief-title">{accepted ? 'Edit the brief' : 'Research brief'}</span>
        <span className="hint">{accepted ? 'a changed brief starts a new research phase' : 'edit if you like, then run it'}</span>
      </div>

      <label className="field">
        <span className="label">Goal</span>
        <input value={draft.goal} onChange={(e) => set({ goal: e.target.value })} disabled={disabled} maxLength={1000} />
      </label>

      <div className="field">
        <span className="label">Corpora, in order of promise</span>
        <div className="chips">
          {draft.corpora.map((c, i) => (
            <span
              key={c}
              className={'chip chip-drag' + (dragFrom === i ? ' dragging' : '')}
              draggable={!disabled}
              onDragStart={() => setDragFrom(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, i)}
              onDragEnd={() => setDragFrom(null)}
              title={c}
            >
              <span className="chip-order">{i + 1}</span>
              {nameOf(c)}
              <button type="button" className="chip-x" aria-label={'Remove ' + c} onClick={() => removeCorpus(c)} disabled={disabled}>
                ×
              </button>
            </span>
          ))}
          {remaining.length > 0 && (
            <select
              className="chip-add"
              value=""
              onChange={(e) => e.target.value && set({ corpora: draft.corpora.concat(e.target.value) })}
              disabled={disabled}
              aria-label="Add a corpus"
            >
              <option value="">+ add</option>
              {remaining.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {draft.corpora.length === 0 && <span className="hint warn">name at least one corpus</span>}
      </div>

      <div className="field">
        <span className="label">Answer shape</span>
        <div className="chips">
          {ANSWER_SHAPES.map((s) => (
            <button
              type="button"
              key={s.key}
              className={'chip chip-choice' + (draft.answer_shape === s.text || (shape === s.key && draft.answer_shape.trim() === '') ? ' on' : '')}
              onClick={() => set({ answer_shape: s.text })}
              disabled={disabled}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          value={draft.answer_shape}
          onChange={(e) => set({ answer_shape: e.target.value })}
          placeholder="or say what would count as an answer"
          disabled={disabled}
          maxLength={500}
        />
      </div>

      <div className="field">
        <span className="label">Constraints</span>
        <div className="chips">
          {(draft.constraints ?? []).map((k, i) => (
            <span key={k + i} className="chip chip-tag">
              {k}
              <button
                type="button"
                className="chip-x"
                aria-label={'Remove ' + k}
                onClick={() => set({ constraints: (draft.constraints ?? []).filter((_, j) => j !== i) })}
                disabled={disabled}
              >
                ×
              </button>
            </span>
          ))}
          <input
            className="chip-input"
            value={constraint}
            onChange={(e) => setConstraint(e.target.value)}
            onKeyDown={onConstraintKey}
            onBlur={addConstraint}
            placeholder="dates, jurisdictions, parties — Enter adds"
            disabled={disabled}
            maxLength={300}
          />
        </div>
      </div>

      <div className="brief-actions">
        <button type="button" className="primary" onClick={() => onAccept(normalizeBrief(draft))} disabled={!canResearch || (!!accepted && !changed)}>
          {accepted ? 'Research with the edited brief' : 'Research'}
        </button>
        {accepted && (
          <button type="button" className="secondary" onClick={() => setEditing(false)} disabled={disabled}>
            Cancel
          </button>
        )}
      </div>

      <details className="brief-json">
        <summary>JSON — what research runs against</summary>
        <pre>{briefJson(draft)}</pre>
      </details>
    </section>
  )
}
