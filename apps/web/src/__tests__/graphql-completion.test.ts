/**
 * @vitest-environment jsdom
 */
import { CompletionContext } from '@codemirror/autocomplete'
import { EditorState } from '@uiw/react-codemirror'
import { describe, expect, it } from 'vitest'

import type { VocabProperty } from '../hooks/useVocabulary'
import { buildCompletionSource, shouldAutoOpenAfterChange } from '../lib/graphql-completion'

const properties: VocabProperty[] = [
  { name: 'laneChange', label: 'Lane change', description: '', domain: 'hdmap', type: 'enum', allowedValues: ['left', 'right'] }, // prettier-ignore
  { name: 'numberOfLanes', label: 'Number of lanes', description: '', domain: 'hdmap', type: 'numeric', datatype: 'integer' }, // prettier-ignore
  {
    name: 'country',
    label: 'Country',
    description: '',
    domain: 'hdmap',
    type: 'enum',
    allowedValues: ['Germany'],
  },
  {
    name: 'duration',
    label: 'Duration',
    description: '',
    domain: 'scenario',
    type: 'numeric',
    datatype: 'float',
  },
]
const vocabulary = { domains: ['hdmap', 'scenario'], properties }
const source = buildCompletionSource(vocabulary)

/** Build a CompletionContext with the cursor at the `|` marker in `doc`. */
function contextAt(doc: string, explicit: boolean): CompletionContext {
  const pos = doc.indexOf('|')
  const state = EditorState.create({ doc: doc.replace('|', '') })
  return new CompletionContext(state, pos, explicit)
}

describe('buildCompletionSource', () => {
  it('lists ALL fields of the enclosing domain on a blank line when triggered explicitly', () => {
    const result = source(contextAt('query {\n  hdmap {\n    |\n  }\n}', true))
    const labels = result?.options.map((o) => o.label) ?? []
    expect(labels).toEqual(expect.arrayContaining(['laneChange', 'numberOfLanes', 'country']))
    expect(labels).not.toContain('duration') // belongs to a different domain
  })

  it('does NOT suggest on a blank line when not explicit (no flicker while typing)', () => {
    expect(source(contextAt('query {\n  hdmap {\n    |\n  }\n}', false))).toBeNull()
  })

  it('narrows fields by the typed prefix', () => {
    const result = source(contextAt('query {\n  hdmap {\n    lane|\n  }\n}', false))
    expect(result?.options.map((o) => o.label)).toEqual(['laneChange'])
  })

  it('suggests domain names at the root level', () => {
    const result = source(contextAt('query {\n  |\n}', true))
    expect(result?.options.map((o) => o.label)).toEqual(
      expect.arrayContaining(['hdmap', 'scenario'])
    )
  })

  it('suggests allowed values inside values: ["..."]', () => {
    const result = source(contextAt('query {\n  hdmap {\n    country(values: ["G|\n  }\n}', false))
    expect(result?.options.map((o) => o.label)).toEqual(['Germany'])
  })
})

describe('shouldAutoOpenAfterChange', () => {
  it('returns true after pressing Enter onto a blank line', () => {
    const start = EditorState.create({ doc: 'query {\n  hdmap {' })
    const at = start.doc.length
    const tr = start.update({
      changes: { from: at, insert: '\n    ' },
      selection: { anchor: at + 5 },
    })
    expect(shouldAutoOpenAfterChange(tr.state, tr.changes)).toBe(true)
  })

  it('returns false when typing a non-newline character', () => {
    const start = EditorState.create({ doc: 'query {\n  hdmap {\n    ' })
    const at = start.doc.length
    const tr = start.update({ changes: { from: at, insert: 'l' }, selection: { anchor: at + 1 } })
    expect(shouldAutoOpenAfterChange(tr.state, tr.changes)).toBe(false)
  })

  it('returns false when a newline lands on a non-blank line', () => {
    const start = EditorState.create({ doc: 'query {' })
    const at = start.doc.length
    const tr = start.update({
      changes: { from: at, insert: '\n  hdmap {' },
      selection: { anchor: at + 10 },
    })
    expect(shouldAutoOpenAfterChange(tr.state, tr.changes)).toBe(false)
  })
})
