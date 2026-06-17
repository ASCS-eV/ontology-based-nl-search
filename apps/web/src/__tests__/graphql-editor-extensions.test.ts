import { startCompletion } from '@codemirror/autocomplete'
import { EditorState, EditorView } from '@uiw/react-codemirror'
import { graphql } from 'cm6-graphql'
import { describe, expect, it } from 'vitest'

import type { Vocabulary } from '../hooks/useVocabulary'
import { buildEditorExtensions } from '../lib/graphql-editor-extensions'
import { buildGraphQLSchema } from '../lib/graphql-schema'

const VOCAB: Vocabulary = {
  domains: ['hdmap'],
  properties: [
    { name: 'numberIntersections', label: 'Intersections', description: '', domain: 'hdmap', type: 'numeric', datatype: 'integer' }, // prettier-ignore
    { name: 'country', label: 'Country', description: '', domain: 'hdmap', type: 'enum', allowedValues: ['Germany'] }, // prettier-ignore
  ],
}

const DOC = 'query {\n  hdmap {\n    \n  }\n}'

describe('buildEditorExtensions', () => {
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
