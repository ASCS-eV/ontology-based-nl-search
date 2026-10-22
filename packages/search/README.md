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

| #   | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Guarded by                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Deterministic compilation** — identical slots always produce byte-identical SPARQL                                                                                                                                                                                                                                                                                                                                                                                                                          | `src/__tests__/compiler.snapshots.test.ts`                                                                                                                                                           |
| S2  | **GraphQL ↔ SPARQL no-drift** — the GraphQL projection and the compiled SPARQL stay equivalent                                                                                                                                                                                                                                                                                                                                                                                                                | `src/__tests__/compiler.test.ts` ("GraphQL ↔ SPARQL equivalence (no-drift guard)")                                                                                                                   |
| S3  | **Slot ↔ GraphQL round-trip** — `slots → slotsToGraphQL → parseGraphQLToSlots` preserves slots                                                                                                                                                                                                                                                                                                                                                                                                                | `@ontology-search/graphql-ir` `src/__tests__/graphql-parser.test.ts` (codec moved there in ADR 0003 step 3)                                                                                          |
| S4  | **Compiled SPARQL is spec-valid** — every query parses under SPARQL 1.1 before execution                                                                                                                                                                                                                                                                                                                                                                                                                      | `src/__tests__/sparql-validator.test.ts` (`./sparql-validator`)                                                                                                                                      |
| S5  | **Schema metadata is SHACL-discovered, never hardcoded** — incl. inheritance over `rdfs:subClassOf`                                                                                                                                                                                                                                                                                                                                                                                                           | `src/__tests__/property-paths.test.ts`                                                                                                                                                               |
| S6  | **Gap log is bounded and minimal** — counts a term once per search (at most 10 terms), keeps kinds, domains and day-precision dates only, skips `limitation` gaps, and past capacity drops the least reported term, not the least recent                                                                                                                                                                                                                                                                      | `src/__tests__/gap-log.test.ts`                                                                                                                                                                      |
| S7  | **New discovery never re-routes a property** — leaves inherited below the asset class or literal only via `sh:or` are added only for names no domain resolves and no shape group holds; existing paths, cross-domain resolution, shape-group hops and reference chains are unchanged                                                                                                                                                                                                                          | `src/__tests__/inherited-disjunctive-leaves.test.ts`, `src/__tests__/property-paths-graph.test.ts`, `src/__tests__/extended-paths-real-ontology.test.ts`, `src/__tests__/compiler.snapshots.test.ts` |
| S8  | **A deep filter path is rooted where it starts** — one whose first hop is not the specification hop is walked from the asset, not hung off the specification variable                                                                                                                                                                                                                                                                                                                                         | `src/__tests__/deep-path-first-hop.test.ts`                                                                                                                                                          |
| S9  | **A label never filters a result** — the primary asset and every referenced asset bind `rdfs:label` in an `OPTIONAL` ([RDFS] §3.6 annotation; an `sh:closed` shape cannot carry it, [SHACL] §4.8.1); an unlabelled asset is returned, and a label filter on a reference matches only labelled assets                                                                                                                                                                                                          | `src/__tests__/flat-ontology-genericity.test.ts` ("returns assets that carry no rdfs:label", "joins referenced assets that carry no rdfs:label")                                                     |
| S10 | **Files load with their location as base; data contexts prefer selected domains** — schema and instance Turtle resolve relative IRIs against the file ([TURTLE] §6.3), and so does JSON-LD data unless its context sets `@base` ([JSON-LD11] §4.1.3); a manifest data source inlines remote `@context` IRIs (incl. the `<ns>/context` / `<ns>#context` catalog forms) from every context of its root, a selected domain's winning where two claim the same IRI                                                | `src/__tests__/schema-loader.base-iri.test.ts`, `src/__tests__/data-loader.context.test.ts`                                                                                                          |
| S11 | **One slot key per predicate chain** (ADR 0009) — a leaf a domain reaches one way keeps its local name; several chains get qualified keys (shortest unique suffix of predicate local names joined by `__`, else the owning class leads, else an ordinal), never the bare name; assignment is independent of the order the schema arrives in. A bare name matches every chain that can hold the value (own `sh:in` or none) as one `UNION` group; cards, enum/numeric vocabulary and shape targets are per key | `src/__tests__/property-keys.test.ts`, `src/__tests__/value-object-keys.test.ts`, `src/__tests__/property-keys-real-ontology.test.ts`, `src/__tests__/to-vocabulary-response.test.ts`                |
| S12 | **An `sh:or` of `sh:in` lists is an enumerated leaf** — a property shape whose `sh:or` members carry `sh:datatype` or `sh:in` is a leaf, on a named or a blank node shape; when every member is an `sh:in` list, the union of the lists, narrowed to a top-level `sh:in` on the same shape, is its vocabulary in the paths, the term cards and the slot vocabulary; an open union declares none; the union query and the `sh:in` query fail together, leaving no rejection unhandled                          | `src/__tests__/enumerated-disjunctive-leaves.test.ts`                                                                                                                                                |

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
