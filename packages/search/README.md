# @ontology-search/search

The search core: turns structured `SearchSlots` into deterministic SPARQL and
orchestrates the query pipeline. Schema metadata (domains, properties, shape
groups, cross-references, `CompilerVocab`) is discovered from the SHACL graph
at runtime — never hardcoded.

**Layer:** depends on `core`, `sparql`, `ontology`, `api-types`.

## Exports

| Subpath              | Purpose                                                              |
| -------------------- | -------------------------------------------------------------------- |
| `.`                  | `SearchService`, schema queries, metadata/reference indices, lineage |
| `./slots`            | `SearchSlots`, `ReferenceFilter`, `TraceabilityPlan` types           |
| `./compiler`         | `compileSlots` — deterministic SPARQL generation                     |
| `./sparql-validator` | Post-compilation SPARQL validation                                   |
| `./shacl-reader`     | Reads raw SHACL Turtle for the LLM prompt                            |
| `./types`            | Response/interpretation/gap types                                    |

## Critical invariant

The compiler is **deterministic** — the same slots always produce the same
query. This is the security model: the LLM never writes SPARQL, so no prompt
injection can produce an arbitrary query. The determinism guarantee is pinned
by `src/__tests__/compiler.snapshots.test.ts`.
