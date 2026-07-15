# @ontology-search/graphql-ir

> The shared ontology-derived GraphQL query contract and slot codec.

**Layer:** rank 2. Depends only on `@ontology-search/api-types` (the discovered
vocabulary), `@ontology-search/slots` (the IR), `@ontology-search/core` (the
shared GraphQL-enum helper), and `graphql` (graphql-js). It does **not** touch
Oxigraph, SHACL, HTTP, CodeMirror, or the compiler, so clients can reuse it
without an application runtime. See ADR
[0003](../../docs/adr/0003-decompose-search-package.md).

## Purpose

This package owns the single query contract consumed by the API, web editor,
and language-server adapter:

- `buildGraphQLSchema(vocabulary)` - build the validated, recursive query schema.
- `buildGraphQLNameMap(vocabulary)` - map generated GraphQL names back to raw ontology terms.
- `slotsToGraphQL(slots, opts)` — the canonical projection of `SearchSlots` into a GraphQL query string (one field per domain; filters/ranges/references as nested selections + arguments).
- `parseGraphQLToSlots(query, { nameMap })` — the inverse: a structural parse of a (possibly hand-edited) query back into raw-name `SearchSlots`, or a typed parse error.
- `validateGraphQL(query)` / `validateGraphQLCompleteness(query, slots)` — a syntax gate plus a **drift guard** that asserts a serialized query round-trips without silently dropping a slot.

Extracting it from `search` makes the codec independently testable and lets it sit beside the web autocomplete module it must agree with, without forcing consumers to pull the compiler's heavy transitive dependencies. The GraphQL↔SPARQL no-drift guard stays in `search` (it needs the compiler) and consumes this package as a dependency.

## Public interface

| Symbol                                      | Purpose                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `buildGraphQLSchema(vocabulary)`            | Build the ontology-derived query schema used by every adapter and API validation.                     |
| `buildGraphQLNameMap(vocabulary)`           | Validate generated names and create reversible raw/GraphQL mappings.                                  |
| `sanitizeGraphQLName(name)`                 | Apply the canonical GraphQL Name projection used by schema and serializer.                            |
| `slotsToGraphQL(slots, opts?)`              | Serialize slots -> spec-valid GraphQL query string. `opts.enumProperties` controls enum framing.      |
| `parseGraphQLToSlots(query, opts?)`         | Parse a query -> `GraphQLParseResult` or `GraphQLParseError`; a name map restores raw ontology names. |
| `validateGraphQL(query)`                    | Syntax/structure gate -> `GraphQLValidationResult`.                                                   |
| `validateGraphQLCompleteness(query, slots)` | Assert a serialized query covers every slot (drift prevention).                                       |

## Requirements & invariants

| #   | Requirement / invariant                                                                                                   | Guarding test                               |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| G1  | Every `slotsToGraphQL` output is **spec-valid GraphQL** (`[GRAPHQL]` June 2018) — parseable by graphql-js `parse`.        | `__tests__/graphql-validator.test.ts`       |
| G2  | `slotsToGraphQL` is deterministic — identical slots yield byte-identical output.                                          | `__tests__/graphql-serializer.test.ts`      |
| G3  | `parseGraphQLToSlots(slotsToGraphQL(s))` round-trips `s` (filters, ranges, enum framing, nested references).              | `__tests__/graphql-parser.test.ts`          |
| G4  | `validateGraphQLCompleteness` flags any slot the serialized query dropped — the drift bug that motivated it cannot recur. | `__tests__/graphql-validator.test.ts`       |
| G5  | A new `ReferenceFilter` field is caught by a compile-time exhaustiveness guard in the serializer (no silent omission).    | `graphql-serializer.ts` (TS exhaustiveness) |
| G6  | The codec carries no ontology-specific identifiers — it is keyed by SHACL local names from the IR (criterion 9b).         | review checklist                            |
| G7  | Every queryable literal property is represented as enum, numeric, or free-form string; object references stay recursive.  | `__tests__/graphql-schema.test.ts`          |
| G8  | Colliding or reserved generated names fail deterministically instead of overwriting schema fields.                        | `__tests__/graphql-name.test.ts`            |

## How to interface

```ts
import {
  buildGraphQLNameMap,
  buildGraphQLSchema,
  parseGraphQLToSlots,
  slotsToGraphQL,
} from '@ontology-search/graphql-ir'

const schema = buildGraphQLSchema(vocabulary)
const nameMap = buildGraphQLNameMap(vocabulary)
const query = slotsToGraphQL(slots, { enumProperties: new Set(['country']) })
const back = parseGraphQLToSlots(query, { nameMap })
```

`@ontology-search/search` re-exports the codec symbols for backward
compatibility. New adapters should depend directly on this package.

## Standards

- [GraphQL Specification, September 2025](https://spec.graphql.org/September2025/),
  especially Names (section 2.1.9), executable documents, type validation, and
  schema validation.
- [graphql-js](https://github.com/graphql/graphql-js), the GraphQL reference
  implementation used to construct, parse, and validate the contract.

## See also

- ADR [0003](../../docs/adr/0003-decompose-search-package.md) — why the codec was extracted from `search`.
- ADR [0001](../../docs/adr/0001-graphql-editor-schema-from-discovery.md) — the editor schema this codec serves.
- `apps/web/src/lib/graphql-autocomplete` — the CodeMirror adapter over this shared contract.
- `@ontology-search/slots` — the IR this codec serializes.
