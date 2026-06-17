import { autocompletion, completionKeymap, startCompletion } from '@codemirror/autocomplete'
import { EditorView, type Extension, keymap, Prec } from '@uiw/react-codemirror'
import { graphql } from 'cm6-graphql'

import type { Vocabulary } from '../hooks/useVocabulary'
import { buildGraphQLSchema } from './graphql-schema'

/**
 * CodeMirror extensions for the GraphQL editor.
 *
 * cm6-graphql exposes its schema-aware completion as a *language-data*
 * autocomplete source (`graphqlLanguage.data.of({ autocomplete })`). That
 * source only runs when an `@codemirror/autocomplete` `autocompletion()`
 * extension is active in the editor. The editor disables basicSetup's default
 * autocompletion, so it is (re)added here — with no `override`, so it collects
 * cm6-graphql's language-data source. All completion content (fields, enum
 * values, argument names) comes from the GraphQLSchema built from the
 * discovered vocabulary, so the editor cannot drift from the compiler. See
 * `docs/adr/0001-graphql-editor-schema-from-discovery.md`.
 */
export function buildEditorExtensions(vocabulary: Vocabulary): Extension[] {
  const schema = buildGraphQLSchema(vocabulary)

  // Auto-open the completion popup in the positions where the user is about to
  // type a field, an argument name, or a value — a new line inside a block, or
  // just after `(`, `[`, or `,`. cm6-graphql only auto-triggers on word
  // characters, so argument/value positions (e.g. inside `values: [...]`, where
  // enum values are suggested) would otherwise stay empty until the user typed
  // a letter or pressed Ctrl-Space. Dispatching from inside an update listener
  // is illegal, so defer the (explicit) startCompletion to the next microtask.
  const autoOpenInContext = EditorView.updateListener.of((update) => {
    if (!update.docChanged) return
    if (!update.transactions.some((tr) => tr.isUserEvent('input'))) return
    let trigger = false
    update.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
      if (/[([,\n]/.test(inserted.toString())) trigger = true
    })
    if (trigger) queueMicrotask(() => startCompletion(update.view))
  })

  return [
    // basicSetup's completion keymap is disabled, so re-add it: Ctrl-Space
    // opens the list; arrows/Enter navigate and accept. Highest precedence so
    // Enter accepts the highlighted option instead of inserting a newline.
    Prec.highest(keymap.of(completionKeymap)),
    autocompletion({ activateOnTyping: true }),
    ...graphql(schema),
    autoOpenInContext,
  ]
}
