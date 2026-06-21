# @ontology-search/search

> Search core: compiles structured `SearchSlots` into deterministic SPARQL and orchestrates the query pipeline.

**Layer:** `core, sparql, ontology ← search`. Sits above the storage and ontology layers and below `llm` and the apps. Depends on `@ontology-search/core`, `@ontology-search/sparql`, `@ontology-search/ontology`, `@ontology-search/api-types`, and — since the ADR 0003 decomposition — the extracted leaf packages `@ontology-search/slots` (the IR) and `@ontology-search/graphql-ir` (the slot↔GraphQL codec).

## Purpose

Turns the structured `SearchSlots` IR (produced upstream by the LLM) into a SPARQL query and runs the surrounding pipeline: schema-metadata discovery, slot-to-query compilation, post-compilation validation, and service orchestration. All schema metadata — domains, properties, shape groups, cross-references, and the `CompilerVocab` — is discovered from the SHACL graph at runtime; none of it is hardcoded.

## Module map

After the ADR 0003 decomposition the IR (`@ontology-search/slots`) and the GraphQL
codec (`@ontology-search/graphql-ir`) live in their own packages. What remains in
`search` is four internal seams with different change cadences:

| Seam              | Modules                                                                                                                                          | Subpath                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **Discovery**     | `asset-domains`, `schema-queries`, `property-paths`, `concept-expansion`, `vocabulary-extractor`, `schema-loader`, `shacl-reader`, `data-loader` | `./discovery` (public subset)      |
| **Compilation**   | `compiler`, `compiler-vocab`, `count-query`, `sparql-validator`                                                                                  | `./compiler`, `./sparql-validator` |
| **Lineage**       | `metadata-index`, `reference-index`, `traceability`                                                                                              | `./lineage`                        |
| **Orchestration** | `service`                                                                                                                                        | `.`                                |

These are kept as subpath exports rather than separate packages: the seam is real
and now importable on its own, but packaging is deferred until a second consumer
appears (ADR 0003 step 4 — avoid speculative package surface). The root `.` still
re-exports everything for back-compat.

## Public interface

| Subpath              | Purpose                                                                         |
| -------------------- | ------------------------------------------------------------------------------- |
| `.`                  | `SearchService`, schema queries, metadata/reference indices, and lineage        |
| `./compiler`         | `compileSlots` — deterministic SPARQL generation from slots                     |
| `./sparql-validator` | Post-compilation SPARQL validation                                              |
| `./shacl-reader`     | Reads raw SHACL Turtle for the LLM prompt                                       |
| `./discovery`        | SHACL-driven schema-metadata discovery surface (asset domains, paths, vocab)    |
| `./lineage`          | Asset-metadata aggregates, the data-driven reference index, lineage exploration |
| `./types`            | Response, interpretation, and gap types                                         |
| `./slots`            | Back-compat re-export of `@ontology-search/slots` (the IR moved there)          |
| `./slot-wire-schema` | Back-compat re-export of the Zod wire schemas from `@ontology-search/slots`     |

## Requirements & invariants

Each contract below is guarded by a named test (mirroring the requirements-driven
style of the `graphql-autocomplete` module). The security model rests on the first
two: the LLM only fills slots, and the compiler is the sole, deterministic SPARQL
author — so no prompt injection can produce an arbitrary query.

| #   | Requirement                                                                                         | Guarded by                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| S1  | **Deterministic compilation** — identical slots always produce byte-identical SPARQL                | `src/__tests__/compiler.snapshots.test.ts`                                                                  |
| S2  | **GraphQL ↔ SPARQL no-drift** — the GraphQL projection and the compiled SPARQL stay equivalent      | `src/__tests__/compiler.test.ts` ("GraphQL ↔ SPARQL equivalence (no-drift guard)")                          |
| S3  | **Slot ↔ GraphQL round-trip** — `slots → slotsToGraphQL → parseGraphQLToSlots` preserves slots      | `@ontology-search/graphql-ir` `src/__tests__/graphql-parser.test.ts` (codec moved there in ADR 0003 step 3) |
| S4  | **Compiled SPARQL is spec-valid** — every query parses under SPARQL 1.1 before execution            | `src/__tests__/sparql-validator.test.ts` (`./sparql-validator`)                                             |
| S5  | **Schema metadata is SHACL-discovered, never hardcoded** — incl. inheritance over `rdfs:subClassOf` | `src/__tests__/property-paths.test.ts`                                                                      |

- The slot wire format is held to **JSON Schema 2020-12**: the Zod schemas in
  `./slot-wire-schema` are serialized to JSON Schema for the `submit_slots` tool call.
- Callers must provide an initialized SPARQL store and a domain registry built from
  the loaded ontology before invoking the service.

## How to interface

```ts
import { compileSlots } from '@ontology-search/search/compiler'
import type { SearchSlots } from '@ontology-search/search/slots'

const slots: SearchSlots = {
  /* domains, filters, ranges, references … */
}

const sparql = compileSlots(slots, compilerVocab)
// `sparql` is identical for identical `slots` — deterministic by contract.
```

## See also

- [Root README](../../README.md)
- [`@ontology-search/llm`](../llm/README.md) — produces the `SearchSlots` this package compiles
- [`@ontology-search/ontology`](../ontology/README.md) — domain registry and vocabulary indexing
- `apps/docs/standards-audit.md` — slot IR provenance and standards grounding
