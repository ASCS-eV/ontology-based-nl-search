/**
 * Input contract for the GraphQL autocomplete module.
 *
 * The module is generic: its only input is a discovered ontology vocabulary
 * (asset domains and their filterable properties), and its output is a
 * `GraphQLSchema` / CodeMirror `Extension[]`. The contract is **single-sourced
 * from `@ontology-search/api-types`** (the `/vocabulary` wire shape) — a pure,
 * zero-dependency, browser-safe type leaf, not app code — so the editor and the
 * API route cannot drift. `EditorVocabulary` is this module's name for that
 * response shape.
 */
import type { VocabularyResponse } from '@ontology-search/api-types'

export type { VocabProperty } from '@ontology-search/api-types'

/** The discovered vocabulary the editor schema is built from (the `/vocabulary` response). */
export type EditorVocabulary = VocabularyResponse
