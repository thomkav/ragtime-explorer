import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parentPath } from './home.ts'

test('the mount the tenant serves the page from answers where the way back goes', () => {
  // `VITE_BASE=/ragtime/explorer/` is what the tenant's sync task builds with, and its
  // router refuses to serve a bundle built for any other prefix.
  assert.equal(parentPath('/ragtime/explorer/'), '/ragtime')
  assert.equal(parentPath('/ragtime/explorer'), '/ragtime')
})

test('a page mounted one level down goes back to the root', () => {
  assert.equal(parentPath('/explorer/'), '/')
})

test('a page that is the whole site has nowhere to go back to', () => {
  assert.equal(parentPath('/'), '')
  assert.equal(parentPath(''), '')
})

test('a deeper mount keeps everything above the last segment', () => {
  assert.equal(parentPath('/a/b/c/'), '/a/b')
})
