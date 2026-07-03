# graphql-autocomplete

> Schema-aware GraphQL autocomplete / validation / hover for the editor, built
> from the discovered ontology vocabulary.

**Layer:** web-internal module. Depends on `graphql`, `cm6-graphql`,
`@codemirror/autocomplete`, `@uiw/react-codemirror`,
`@ontology-search/core/graphql/enum`, and the `@ontology-search/api-types`
`/vocabulary` type (its input contract). No React, no app state, no network — it
is a pure function of its input vocabulary.

## Purpose

Turns the runtime-discovered vocabulary (the `/vocabulary` API shape) into a
`GraphQLSchema` and the CodeMirror extensions that drive the editor's
autocomplete, lint, and hover. The schema is built from the **same discovery the
SPARQL compiler uses**, so the editor cannot suggest anything the compiler can't
compile (ADR 0001). References are modelled as recursive typed fields (ADR 0002).

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

Each requirement is guarded by a named test. Schema-contract requirements (R1–R6)
and the wiring requirement (R7) are unit tests (`__tests__/`). The live-completion
requirements (R8–R10) can only run in a real browser — under vitest, `graphql@16`
loads as two instances (no `exports` map → CJS + ESM) and
`graphql-language-service`'s `instanceof` checks throw _"from another realm"_, so
they are guarded by the Playwright e2e instead.

| #   | Requirement                                                                              | Guarded by                                 |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------ |
| R1  | Every discovered domain is a top-level `Query` field                                     | `__tests__/schema.test.ts`                 |
| R2  | A categorical property is a `Filter` field whose `values` are a GraphQL enum (`sh:in`)   | `__tests__/schema.test.ts`                 |
| R3  | A numeric property is a `Range` field with `min`/`max` typed by datatype                 | `__tests__/schema.test.ts`                 |
| R4  | References are recursive typed fields (`_Result.references → References → _Result`)      | `__tests__/schema.test.ts`                 |
| R5  | Validation rejects unknown domains/fields, including inside references                   | `__tests__/schema.test.ts`                 |
| R6  | Field names are sanitized to GraphQL Names, mirroring the serializer                     | `__tests__/schema.test.ts`                 |
| R7  | The extensions make schema-aware completion startable (active `autocompletion` source)   | `__tests__/extensions.test.ts`             |
| R8  | Field/domain suggestions appear in the editor                                            | `apps/e2e/.../graphql-editor-autocomplete` |
| R9  | Enum members auto-open **unquoted** in value position (after `:`)                        | `apps/e2e/.../graphql-editor-autocomplete` |
| R10 | References are typed at every depth (suggestions inside `references { <domain> { … } }`) | `apps/e2e/.../graphql-editor-autocomplete` |

**Expects of callers:** the editor must disable basicSetup's default
`autocompletion` (these extensions add their own, with no `override`, so they
collect cm6-graphql's language-data source). `graphql` must resolve to a single
instance (vite `resolve.dedupe: ['graphql']`).

## See also

- [ADR 0001](../../../../../docs/adr/0001-graphql-editor-schema-from-discovery.md) — schema from discovery
- [ADR 0002](../../../../../docs/adr/0002-field-based-recursive-references.md) — recursive reference fields
- `@ontology-search/search` `graphql-serializer`/`graphql-parser` — the slot↔GraphQL codecs this schema must agree with
