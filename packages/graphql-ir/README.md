# @ontology-search/graphql-ir

> The slot ↔ GraphQL codec — serialize `SearchSlots` to a GraphQL query, parse a GraphQL query back to slots, and validate both.

**Layer:** rank 2. Depends only on `@ontology-search/slots` (the IR), `@ontology-search/core` (logging + the shared GraphQL-enum-name helper), and `graphql` (graphql-js). It does **not** touch Oxigraph, SHACL, or the compiler, so it is reusable on its own. See ADR [0003](../../docs/adr/0003-decompose-search-package.md).

## Purpose

The GraphQL editor in the web app is a human-editable surface for the slot IR. This package is the bidirectional bridge:

- `slotsToGraphQL(slots, opts)` — the canonical projection of `SearchSlots` into a GraphQL query string (one field per domain; filters/ranges/references as nested selections + arguments).
- `parseGraphQLToSlots(query)` — the inverse: a structural parse of a (possibly hand-edited) query back into `SearchSlots`, or a typed parse error.
- `validateGraphQL(query)` / `validateGraphQLCompleteness(query, slots)` — a syntax gate plus a **drift guard** that asserts a serialized query round-trips without silently dropping a slot.

Extracting it from `search` makes the codec independently testable and lets it sit beside the web autocomplete module it must agree with, without forcing consumers to pull the compiler's heavy transitive dependencies. The GraphQL↔SPARQL no-drift guard stays in `search` (it needs the compiler) and consumes this package as a dependency.

## Public interface

| Symbol                                      | Purpose                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `slotsToGraphQL(slots, opts?)`              | Serialize slots → spec-valid GraphQL query string. `opts.enumProperties` controls value vs enum framing. |
| `parseGraphQLToSlots(query)`                | Parse a query → `GraphQLParseResult` (`{ data }`) or `GraphQLParseError` (`{ error }`).                  |
| `validateGraphQL(query)`                    | Syntax/structure gate → `GraphQLValidationResult`.                                                       |
| `validateGraphQLCompleteness(query, slots)` | Assert a serialized query covers every slot (drift prevention).                                          |
| `GraphQLSerializeOptions`                   | Options for `slotsToGraphQL`.                                                                            |

## Requirements & invariants

| #   | Requirement / invariant                                                                                                   | Guarding test                               |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| G1  | Every `slotsToGraphQL` output is **spec-valid GraphQL** (`[GRAPHQL]` June 2018) — parseable by graphql-js `parse`.        | `__tests__/graphql-validator.test.ts`       |
| G2  | `slotsToGraphQL` is deterministic — identical slots yield byte-identical output.                                          | `__tests__/graphql-serializer.test.ts`      |
| G3  | `parseGraphQLToSlots(slotsToGraphQL(s))` round-trips `s` (filters, ranges, enum framing, nested references).              | `__tests__/graphql-parser.test.ts`          |
| G4  | `validateGraphQLCompleteness` flags any slot the serialized query dropped — the drift bug that motivated it cannot recur. | `__tests__/graphql-validator.test.ts`       |
| G5  | A new `ReferenceFilter` field is caught by a compile-time exhaustiveness guard in the serializer (no silent omission).    | `graphql-serializer.ts` (TS exhaustiveness) |
| G6  | The codec carries no ontology-specific identifiers — it is keyed by SHACL local names from the IR (criterion 9b).         | review checklist                            |

## How to interface

```ts
import { slotsToGraphQL, parseGraphQLToSlots } from '@ontology-search/graphql-ir'

const query = slotsToGraphQL(slots, { enumProperties: new Set(['country']) })
const back = parseGraphQLToSlots(query)
```

`@ontology-search/search` re-exports the same symbols from its root for back-compat, so existing consumers (e.g. `apps/api`) need no change.

## See also

- ADR [0003](../../docs/adr/0003-decompose-search-package.md) — why the codec was extracted from `search`.
- ADR [0001](../../docs/adr/0001-graphql-editor-schema-from-discovery.md) — the editor schema this codec serves.
- `apps/web/src/lib/graphql-autocomplete` — the web mirror this codec must agree with.
- `@ontology-search/slots` — the IR this codec serializes.
