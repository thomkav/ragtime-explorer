import { test } from 'node:test'
import assert from 'node:assert/strict'

import { MARK, OVER_CAP, glyphHeight, letterState, lineOrdinals, paragraphEnd } from './reveal.ts'

test('a paragraph is held until the next blank line arrives', () => {
  assert.equal(paragraphEnd('First paragraph, still being writ', false), 0)
  assert.equal(paragraphEnd('First paragraph.\n\nSecond, being writ', false), 'First paragraph.'.length)
  assert.equal(paragraphEnd('One.\n\nTwo.\n\nThree, being', false), 'One.\n\nTwo.'.length)
})

test('a final answer is shown whole', () => {
  assert.equal(paragraphEnd('One.\n\nTwo, no trailing break', true), 'One.\n\nTwo, no trailing break'.length)
  assert.equal(paragraphEnd('', true), 0)
})

test('a blank line inside an open code fence is not a paragraph break', () => {
  const t = 'Intro.\n\n```\ncode\n\nmore code'
  assert.equal(paragraphEnd(t, false), 'Intro.'.length)
  assert.equal(paragraphEnd(t + '\n```\n\nAfter', false), (t + '\n```').length)
})

test('a letter appears, then settles, and only forwards in distance', () => {
  assert.deepEqual(letterState(0), { opacity: 0, settle: 0 })
  assert.equal(letterState(MARK.edge).opacity, 1)
  assert.equal(letterState(MARK.edge).settle, 0)
  assert.equal(letterState(MARK.edge + MARK.solid).settle, 1)
  assert.ok(letterState(10).opacity < letterState(20).opacity)
  assert.ok(OVER_CAP > MARK.edge + MARK.solid + MARK.lead)
})

test('the glyph height depends on the config alone', () => {
  assert.equal(glyphHeight(), glyphHeight())
  assert.ok(glyphHeight() > (MARK.lines - 1) * MARK.gap)
})

test('line ordinals follow the vertical centre and ignore small drift', () => {
  assert.deepEqual(lineOrdinals([10, 10.5, 9.4, 33, 33.2, 56]), [0, 0, 0, 1, 1, 2])
  assert.deepEqual(lineOrdinals([]), [])
})
