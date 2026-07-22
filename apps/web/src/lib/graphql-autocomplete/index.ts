/**
 * GraphQL autocomplete - the editor's CodeMirror adapter over the shared
 * ontology-derived query schema.
 *
 * Input is an {@link EditorVocabulary}; output is a CodeMirror `Extension[]`.
 * The re-exported schema builder is owned by `@ontology-search/graphql-ir`.
 */
export { buildEditorExtensions } from './extensions'
export type { EditorVocabulary, VocabProperty } from './types'
export { buildGraphQLSchema } from '@ontology-search/graphql-ir'
