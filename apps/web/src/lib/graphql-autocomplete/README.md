# graphql-autocomplete

> Schema-aware GraphQL autocomplete / validation / hover for the editor, built
> from the discovered ontology vocabulary.

**Layer:** web-internal CodeMirror adapter. Depends on `cm6-graphql`, CodeMirror,
and the shared `@ontology-search/graphql-ir` query contract. It has no React,
app-state, or network dependency.

## Purpose

Adapts the shared runtime-discovered `GraphQLSchema` to CodeMirror extensions
that drive autocomplete and lint. The pure schema and reversible ontology-name
mapping live in `@ontology-search/graphql-ir`, so the editor, API, and external
LSP server use the same contract (ADR 0001). References are recursive typed
fields (ADR 0002).

## Public interface

Import from the module root (`../lib/graphql-autocomplete`):

| Export                              | Signature                                    | Purpose                                                                                                          |
| ----------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `buildEditorExtensions`             | `(vocab: EditorVocabulary) => Extension[]`   | CodeMirror extensions: schema-aware completion + lint + hover                                                    |
| `buildGraphQLSchema`                | `(vocab: EditorVocabulary) => GraphQLSchema` | The editor's query schema (also used to validate authored queries)                                               |
| `EditorVocabulary`, `VocabProperty` | types                                        | The module's **input contract**, single-sourced from `@ontology-search/api-types` (the `/vocabulary` wire shape) |

```ts
import { buildEditorExtensions } from '../lib/graphql-autocomplete'

const extensions = buildEditorExtensions(vocabulary) // vocabulary: EditorVocabulary
// <CodeMirror extensions={extensions} basicSetup={{ autocompletion: false }} … />
```

The React component (`components/GraphQLEditor.tsx`) and the fetch hook
(`hooks/useVocabulary.ts`) are **consumers** — they live outside this module.

## Requirements & invariants

Each requirement is guarded by a named test. Schema-contract requirements
(R1-R6) live with `@ontology-search/graphql-ir`; the CodeMirror wiring
requirement (R7) remains here. Live completion requirements (R8-R10) are guarded
by Playwright in a real browser.

| #   | Requirement                                                                                | Guarded by                                 |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| R1  | Every discovered domain is a top-level `Query` field                                       | `packages/graphql-ir/.../graphql-schema`   |
| R2  | A categorical property is a `Filter` field whose `values` are a GraphQL enum (`sh:in`)     | `packages/graphql-ir/.../graphql-schema`   |
| R3  | Numeric/string properties expose their standard arguments and types                        | `packages/graphql-ir/.../graphql-schema`   |
| R4  | References are recursive typed fields (`_Result.references -> References -> _Result`)      | `packages/graphql-ir/.../graphql-schema`   |
| R5  | Validation rejects unknown domains/fields, including inside references                     | `packages/graphql-ir/.../graphql-schema`   |
| R6  | Field names are validated, sanitized, and reversibly mapped                                | `packages/graphql-ir/.../graphql-name`     |
| R7  | The extensions make schema-aware completion startable (active `autocompletion` source)     | `__tests__/extensions.test.ts`             |
| R8  | Field/domain suggestions appear in the editor                                              | `apps/e2e/.../graphql-editor-autocomplete` |
| R9  | Enum members auto-open **unquoted** in value position (after `:`)                          | `apps/e2e/.../graphql-editor-autocomplete` |
| R10 | References are typed at every depth (suggestions inside `references { <domain> { ... } }`) | `apps/e2e/.../graphql-editor-autocomplete` |
| R11 | Hover safely shows ontology-derived GraphQL signatures and descriptions                    | `__tests__/extensions` + Playwright e2e    |

**Expects of callers:** the editor must disable basicSetup's default
`autocompletion` (these extensions add their own, with no `override`, so they
collect cm6-graphql's language-data source). `graphql` must resolve to a single
instance (vite `resolve.dedupe: ['graphql']`).

## See also

- [ADR 0001](../../../../../docs/adr/0001-graphql-editor-schema-from-discovery.md) — schema from discovery
- [ADR 0002](../../../../../docs/adr/0002-field-based-recursive-references.md) — recursive reference fields
- [`@ontology-search/graphql-ir`](../../../../../packages/graphql-ir/README.md) - shared schema and slot codec
- [GraphQL Specification, September 2025](https://spec.graphql.org/September2025/) - query language and validation standard
