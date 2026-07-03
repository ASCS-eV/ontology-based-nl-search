# @ontology-search/slots

> The slot IR — the structured intermediate representation the LLM fills and the deterministic compiler reads.

**Layer:** a leaf contract package (rank 0) whose only runtime dependency is `zod`. Importable by any higher layer (`search`, `llm`, `api`) without pulling Oxigraph/SHACL/`graphql` transitively. See ADR [0003](../../docs/adr/0003-decompose-search-package.md).

## Purpose

`SearchSlots` is the system's **central contract**: the LLM never writes SPARQL — it fills slots via a single tool call, and the deterministic compiler translates those slots into SPARQL. That IR is consumed by the compiler, the GraphQL codec, the `llm` slot pipeline/validator, and the `api` route schemas. Giving it a dependency-light home of its own means any of those layers can type-check against the exact same shape without depending on the whole `search` package, and no consumer can drift from the canonical definition.

The IR is **domain-agnostic by construction**: it carries no ontology-specific field names. Every constraint a user expresses — geography, license, cross-references, anything — flows through one of the generic buckets (`filters`, `ranges`, `references`), keyed by a SHACL property's local name. Ontologies with different naming or shape depth need zero changes here (criterion 9b — the ontology-name budget).

## Public interface

| Subpath              | Purpose                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                  | Everything below, re-exported.                                                                                                                                                        |
| `./slots`            | The IR types — `SearchSlots`, `ReferenceFilter`, `SlotValue`, `CompileResult`, `TraceabilityPlan`/`TraceabilityStep` — plus `normalizeReferences` and `createEmptySlots` helpers.     |
| `./slot-wire-schema` | The Zod wire schemas — `referenceFilterWireSchema`, `interpretationWireSchema`, `gapsWireSchema`, etc. — and their inferred types, layered on by LLM tools / submission / API routes. |

## Requirements & invariants

| #   | Requirement / invariant                                                                                                                                                                       | Guarding test                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| S1  | `normalizeReferences` accepts the array form, the single-object form, and `undefined`/empty, always returning an array.                                                                       | `__tests__/slots.test.ts`              |
| S2  | Blank/whitespace-only `domain` reference entries are dropped at the boundary.                                                                                                                 | `__tests__/slots.test.ts`              |
| S3  | Leaf reference nodes stay exactly `{ domain, label? }` — an empty/undefined `references` key is stripped so equality and snapshots stay stable; nested chains are preserved and AND-combined. | `__tests__/slots.test.ts`              |
| S4  | The slot wire format is held to **JSON Schema 2020-12** (`[JSON-SCHEMA-CORE]`/`[JSON-SCHEMA-VAL]`) — the Vercel AI SDK serializes these Zod schemas for the `submit_slots` tool call.         | `__tests__/slots.test.ts` (round-trip) |
| S5  | The recursive `referenceFilterWireSchema` validates nested cross-domain chains and rejects entries missing `domain`.                                                                          | `__tests__/slots.test.ts`              |
| S6  | Zero ontology-specific identifiers in source — the IR is domain-agnostic (criterion 9b).                                                                                                      | review checklist                       |

## How to interface

```ts
import type { SearchSlots, ReferenceFilter } from '@ontology-search/slots/slots'
import { normalizeReferences } from '@ontology-search/slots/slots'
import { referenceFilterWireSchema } from '@ontology-search/slots/slot-wire-schema'
```

The `@ontology-search/search` package re-exports the same symbols via its `.`, `./slots`, and `./slot-wire-schema` subpaths for back-compat, so existing consumers need no change.

## See also

- ADR [0003](../../docs/adr/0003-decompose-search-package.md) — why the IR was extracted from `search`.
- `apps/docs/standards-audit.md` — provenance of the slot mechanism and its JSON Schema grounding.
- `@ontology-search/graphql-ir` — the slot↔GraphQL codec built on this IR.
