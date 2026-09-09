/**
 * The brief's answer shape doubles as a rendering hint (design item 11): a
 * list renders as cards titled by the citation, a count as a big number with
 * the workspace handoff, a narrative as prose, a document opens the detail
 * sheet. The presets are the chips on the brief card (item 1); free text
 * falls back to narrative.
 */

import { links } from '@ragtime/client'

export type AnswerShape = 'list' | 'count' | 'narrative' | 'document'

export const ANSWER_SHAPES: readonly { key: AnswerShape; label: string; text: string }[] = [
  { key: 'list', label: 'List', text: 'a list of the documents, each with its date and holding' },
  { key: 'count', label: 'Count', text: 'a count, with how it was reached' },
  { key: 'narrative', label: 'Narrative', text: 'a short narrative with citations' },
  { key: 'document', label: 'Document', text: 'the one document that answers this' },
]

/** Which preset a free-text answer shape means; narrative when unsure. */
export function detectShape(answerShape: string | null | undefined): AnswerShape {
  const s = (answerShape ?? '').toLowerCase()
  if (/\b(count|how many|number of|tally|total)\b/.test(s)) return 'count'
  if (/\b(list|table|enumerat|catalog|inventory|bullet)/.test(s)) return 'list'
  if (/\b(one document|the document|a document|single document|which document|the opinion|the order|the section)\b/.test(s)) return 'document'
  return 'narrative'
}

export type Citation = { title: string; slug: string; id: string; path: string }

const CITATION = /\[([^\]]{1,200})\]\((rt:\/\/[a-z_]+(?::[a-z_]+)?\/[A-Za-z0-9:_.-]{1,80})\)/g

/** Every rt:// citation in the text, in order, duplicates kept. */
export function citationsIn(markdown: string): Citation[] {
  const out: Citation[] = []
  CITATION.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = CITATION.exec(markdown)) !== null) {
    const c = links.parseCitation(m[2]!)
    if (!c) continue
    out.push({ title: m[1]!, slug: c.slug, id: c.id, path: links.fromCitation(m[2]!) })
  }
  return out
}

export function firstCitation(markdown: string): Citation | null {
  return citationsIn(markdown)[0] ?? null
}

/** The first number in the text (commas allowed), for the count renderer. */
export function firstNumber(markdown: string): string | null {
  const m = /(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(?![\w,.]*\d)/.exec(markdown.replace(/rt:\/\/[^)\s]+/g, ''))
  return m ? m[1]! : null
}

export type ListCard = {
  title: string
  /** The citation's document path, when the item carried one. */
  path: string | null
  body: string
}

export type ListAnswer = {
  lead: string
  cards: ListCard[]
  rest: string
}

const ITEM = /^(?:[-*•]|\d{1,3}[.)])\s+/

/**
 * Split a list-shaped answer into a lead paragraph, one card per top-level
 * list item, and whatever follows the list. An item is titled by its first
 * citation (the link is lifted out of the body so it is not shown twice);
 * an item without one is titled by its first bold run or its first words.
 * Fewer than two items means the answer was not really a list: no cards.
 */
export function splitListAnswer(markdown: string): ListAnswer {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const items: string[][] = []
  const lead: string[] = []
  const rest: string[] = []
  let mode: 'lead' | 'items' | 'rest' = 'lead'
  let blankSinceItem = false
  for (const line of lines) {
    const isItem = ITEM.test(line)
    if (mode === 'lead') {
      if (isItem) {
        mode = 'items'
        items.push([line.replace(ITEM, '')])
      } else lead.push(line)
      continue
    }
    if (mode === 'items') {
      if (isItem) {
        items.push([line.replace(ITEM, '')])
        blankSinceItem = false
      } else if (line.trim() === '') {
        blankSinceItem = true
      } else if (/^\s+/.test(line) || !blankSinceItem) {
        items[items.length - 1]!.push(line.trim())
      } else {
        mode = 'rest'
        rest.push(line)
      }
      continue
    }
    rest.push(line)
  }
  if (items.length < 2) return { lead: markdown.trim(), cards: [], rest: '' }
  const cards = items.map((parts) => {
    const text = parts.join('\n').trim()
    const cites = citationsIn(text)
    if (cites.length) {
      const c = cites[0]!
      const body = text.replace(`[${c.title}](rt://${c.slug}/${c.id})`, '').replace(/^\s*[—–:,-]\s*/, '').trim()
      return { title: c.title, path: c.path, body }
    }
    const bold = /\*\*([^*]{1,160})\*\*/.exec(text)
    if (bold) return { title: bold[1]!, path: null, body: text.replace(bold[0], '').replace(/^\s*[—–:,-]\s*/, '').trim() }
    const words = text.split(/\s+/)
    return { title: words.slice(0, 10).join(' ') + (words.length > 10 ? '…' : ''), path: null, body: text }
  })
  return { lead: lead.join('\n').trim(), cards, rest: rest.join('\n').trim() }
}
