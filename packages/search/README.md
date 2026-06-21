# @ontology-search/search

> Search core: compiles structured `SearchSlots` into deterministic SPARQL and orchestrates the query pipeline.

**Layer:** `core, sparql, ontology ← search`. Sits above the storage and ontology layers and below `llm` and the apps. Depends on `@ontology-search/core`, `@ontology-search/sparql`, `@ontology-search/ontology`, and `@ontology-search/api-types`.

## Purpose

Turns the structured `SearchSlots` IR (produced upstream by the LLM) into a SPARQL query and runs the surrounding pipeline: schema-metadata discovery, slot-to-query compilation, post-compilation validation, and service orchestration. All schema metadata — domains, properties, shape groups, cross-references, and the `CompilerVocab` — is discovered from the SHACL graph at runtime; none of it is hardcoded.

## Public interface

| Subpath              | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `.`                  | `SearchService`, schema queries, metadata/reference indices, and lineage       |
| `./slots`            | `SearchSlots`, `ReferenceFilter`, `TraceabilityPlan` and related slot types    |
| `./compiler`         | `compileSlots` — deterministic SPARQL generation from slots                    |
| `./sparql-validator` | Post-compilation SPARQL validation                                             |
| `./shacl-reader`     | Reads raw SHACL Turtle for the LLM prompt                                      |
| `./types`            | Response, interpretation, and gap types                                        |
| `./slot-wire-schema` | Shared Zod wire schemas for slot submission (references, interpretation, gaps) |

## Requirements & invariants

Each contract below is guarded by a named test (mirroring the requirements-driven
style of the `graphql-autocomplete` module). The security model rests on the first
two: the LLM only fills slots, and the compiler is the sole, deterministic SPARQL
author — so no prompt injection can produce an arbitrary query.

| #   | Requirement                                                                                         | Guarded by                                                                         |
| --- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| S1  | **Deterministic compilation** — identical slots always produce byte-identical SPARQL                | `src/__tests__/compiler.snapshots.test.ts`                                         |
| S2  | **GraphQL ↔ SPARQL no-drift** — the GraphQL projection and the compiled SPARQL stay equivalent      | `src/__tests__/compiler.test.ts` ("GraphQL ↔ SPARQL equivalence (no-drift guard)") |
| S3  | **Slot ↔ GraphQL round-trip** — `slots → slotsToGraphQL → parseGraphQLToSlots` preserves slots      | `src/__tests__/graphql-parser.test.ts`                                             |
| S4  | **Compiled SPARQL is spec-valid** — every query parses under SPARQL 1.1 before execution            | `src/__tests__/sparql-validator.test.ts` (`./sparql-validator`)                    |
| S5  | **Schema metadata is SHACL-discovered, never hardcoded** — incl. inheritance over `rdfs:subClassOf` | `src/__tests__/property-paths.test.ts`                                             |

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
