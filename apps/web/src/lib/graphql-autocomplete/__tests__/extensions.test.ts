/**
 * Requirements-driven test for the autocomplete WIRING (R7).
 *
 * cm6-graphql exposes completion as a *language-data* source that only fires
 * when an `autocompletion()` extension is active; this checks the wiring makes
 * completion startable. It does NOT assert completion *content* — that path runs
 * `graphql-language-service`, which cannot run under vitest (graphql@16 loads as
 * two instances → `instanceof` "another realm"), so content is guarded by the
 * e2e (R8–R10). See `../README.md`.
 */
import { startCompletion } from '@codemirror/autocomplete'
import { EditorState, EditorView } from '@uiw/react-codemirror'
import { graphql } from 'cm6-graphql'
import { describe, expect, it } from 'vitest'

import { buildEditorExtensions } from '../extensions'
import { buildGraphQLSchema } from '../schema'
import type { EditorVocabulary } from '../types'

const VOCAB: EditorVocabulary = {
  domains: ['hdmap'],
  properties: [
    { name: 'numberIntersections', label: 'Intersections', description: '', domain: 'hdmap', type: 'numeric', datatype: 'integer' }, // prettier-ignore
    { name: 'country', label: 'Country', description: '', domain: 'hdmap', type: 'enum', allowedValues: ['Germany'] }, // prettier-ignore
  ],
}

const DOC = 'query {\n  hdmap {\n    \n  }\n}'

describe('R7: the extensions make schema-aware completion startable', () => {
  it('wires an active autocompletion extension so completion can start', () => {
    // Regression: cm6-graphql exposes completion as a language-data source that
    // only fires when an autocompletion() extension is present. Without it,
    // startCompletion() is a no-op (returns false) and the popup never opens.
    const state = EditorState.create({ doc: DOC, extensions: buildEditorExtensions(VOCAB) })
    const view = new EditorView({ state, parent: document.body })
    try {
      expect(startCompletion(view)).toBe(true)
    } finally {
      view.destroy()
    }
  })

  it('control: cm6-graphql alone cannot start completion (proves the regression)', () => {
    // The previous wiring used graphql(schema) without an autocompletion()
    // extension. This control proves that arrangement is exactly what breaks
    // completion, so the assertion above genuinely guards against it.
    const schema = buildGraphQLSchema(VOCAB)
    const state = EditorState.create({ doc: DOC, extensions: [...graphql(schema)] })
    const view = new EditorView({ state, parent: document.body })
    try {
      expect(startCompletion(view)).toBe(false)
    } finally {
      view.destroy()
    }
  })
})
