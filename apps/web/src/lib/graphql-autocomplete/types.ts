/**
 * Input contract for the GraphQL autocomplete module.
 *
 * The module is generic: its only input is a discovered ontology vocabulary
 * (asset domains and their filterable properties), and its output is a
 * `GraphQLSchema` / CodeMirror `Extension[]`. This is the shape of the
 * `/vocabulary` API response, declared here so the module owns the contract it
 * requires and stays independent of how the app fetches it (the `useVocabulary`
 * hook imports these types, not the other way round).
 */

/** A single filterable property discovered from the SHACL vocabulary. */
export interface VocabProperty {
  /** Local name (the field name in the editor, after sanitization). */
  name: string
  /** Human-readable label (`sh:name`), falls back to `name`. */
  label: string
  /** Description (`sh:description`); may be empty. */
  description: string
  /** Owning asset domain. */
  domain: string
  /** `enum` = closed `sh:in` vocabulary; `numeric` = `min`/`max` range. */
  type: 'enum' | 'numeric'
  /** For `enum`: the allowed values (`sh:in`). */
  allowedValues?: string[]
  /** For `numeric`: the bound datatype, so the editor types Int vs Float. */
  datatype?: 'integer' | 'float'
}

/** The discovered vocabulary: asset domains plus their filterable properties. */
export interface EditorVocabulary {
  domains: string[]
  properties: VocabProperty[]
}
