/**
 * GraphQL autocomplete — the editor's schema-aware completion / validation /
 * hover, built from the discovered ontology vocabulary.
 *
 * Generic and self-contained: input is an {@link EditorVocabulary}, output is a
 * CodeMirror `Extension[]` (or a `GraphQLSchema` for validation). No React, no
 * app state, no network. See `./README.md` for the interface and the numbered
 * requirements (R1–R10) each test guards.
 */
export { buildEditorExtensions } from './extensions'
export { buildGraphQLSchema } from './schema'
export type { EditorVocabulary, VocabProperty } from './types'
