# ADR 0003 — Decompose the `search` package

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

`@ontology-search/search` is **8,259 LOC across 23 files — 39% of all source** —
and fuses four responsibilities with different change cadences and consumers:

1. **Schema discovery** (`vocabulary-extractor`, `schema-queries`, `property-paths`,
   `concept-expansion`, `data-loader`, `shacl-reader` ≈ 2,300 LOC)
2. **Slot → SPARQL compilation** (`compiler.ts` = **2,518 LOC, 10 exports,
   42 functions** — the largest file in the repo; bundles vocab build + warmup +
   domain normalization + slot compilation + count queries)
3. **Slot ↔ GraphQL codec** (`graphql-serializer` + `graphql-parser` +
   `graphql-validator` ≈ 700 LOC) — a standalone, standard-pinned (graphql-js)
   contract layer the web autocomplete module mirrors.
4. **Lineage / metadata** (`metadata-index`, `reference-index`, `traceability`
   ≈ 860 LOC)

The architecture audit flagged this as the system's top structural debt: a
"god-package" with a "god-file" (`compiler.ts`). It violates CONTRIBUTING #15
(files > ~400 LOC need justification or a refactor plan) and limits reuse — the
GraphQL codec cannot be consumed without pulling Oxigraph/SHACL transitively.

The slot IR (`SearchSlots`/`ReferenceFilter` in `slots.ts` + the Zod
`slot-wire-schema.ts`) is the **central contract**: imported by the compiler, the
GraphQL codec, `llm` (slot validator/agents), and `api` (route Zod). It currently
lives inside `search`, which is why anything touching the IR or the codec must
depend on the whole package.

## Decision

Decompose `search` along its responsibility seams, **lowest-risk first**, keeping
the `@ontology-search/search` public surface (`src/index.ts`) stable via
re-exports so no consumer breaks in any single step.

Target module shape:

- **`@ontology-search/slots`** (new leaf, rank 0) — the IR: `SearchSlots`,
  `ReferenceFilter`, `normalizeReferences`, and the Zod `slot-wire-schema`. Pure
  types + Zod (zod is already a `core`/`search` dep). Importable by any layer.
- **`@ontology-search/graphql-ir`** (new, depends on `slots` + `graphql` +
  `core/graphql/enum`) — the slot↔GraphQL serializer/parser/validator. Reusable;
  removes ~700 LOC and the direct `graphql` source dep from `search`.
- **`search`** keeps discovery + compilation + lineage + orchestration, with
  `compiler.ts` split internally into `compiler-vocab.ts` (vocab/reference caches +
  warmup), `compiler-helpers.ts` (the SPARQL-emit helpers shared by both halves —
  `assembleQuery`, `buildPrefixes`, `prefixedPredicate`, `findDomainForIri`,
  `normalizeDomainName`), `compiler.ts` (slot→SPARQL core), and `count-query.ts`.
  The shared-helpers file is **required**, not optional: a naive vocab/compiler
  two-way cut would be mutually dependent (the compile core consumes
  `CompilerVocab` from vocab while `warmupCompiler`/`getDomainReferences` orchestrate
  compile-side indices), so a third helpers leaf breaks the cycle. (Further
  discovery/lineage package extraction is possible later but is **not** required
  by this ADR.)

The deterministic-compiler security model, SHACL-driven discovery, and all
standards citations are preserved — this is structural, not behavioral.

## Consequences

- `compiler.ts` drops from 2,518 LOC to a cohesive core; the god-file is gone.
- The GraphQL codec becomes independently testable/reusable and sits beside the
  web autocomplete module it must agree with (the GraphQL↔SPARQL no-drift guard
  stays in `search`, which adds `graphql-ir` as a dev dependency).
- The IR gains a single, dependency-light home; `llm` and `api` import it without
  pulling `search`'s heavy transitive deps. Note: while the back-compat re-exports
  live, anything importing `@ontology-search/search` still pulls `graphql`/`slots`
  transitively — the dependency-shedding benefit is realized for _new, direct_
  consumers of `graphql-ir`/`slots`, and fully only after a later deprecation step
  removes the re-exports.
- One new layer-rank entry per new package in `scripts/check-layers.mjs` `RANKS` —
  the layering gate (added earlier) is the prerequisite that makes each extraction
  step's "downward-only" guarantee enforceable in CI.
- Cost: each step touches many import sites (mechanical), and `search` must keep
  back-compat re-exports — both at `src/index.ts` (root imports) **and** at the
  `./slots` / `./slot-wire-schema` subpath export files (the IR is consumed via
  those subpaths, not the root) — for one release so each step is non-breaking.

## Rollout (one autonomous, individually-mergeable PR per step)

Each step branches off `main`, carries a regression test where it changes
behavior (criterion #30), passes `pnpm run validate` + the layer gate, gets an
adversarial implementation review, and merges before the next begins. Ordered
lowest-risk first.

1. **Split `compiler.ts` internally** → `compiler-helpers.ts` + `compiler-vocab.ts`
   - `compiler.ts` (core) + `count-query.ts`. Pure move; `index.ts` unchanged;
     the determinism + no-drift suites are the guard. (No new package.)
2. **Extract `@ontology-search/slots`** (IR leaf). Back-compat via the `./slots`
   and `./slot-wire-schema` **subpath** re-exports plus the `index.ts` root
   re-exports.
3. **Extract `@ontology-search/graphql-ir`** (codec; depends on `slots`).
   Back-compat via `index.ts` root re-export; `search` keeps `graphql-ir` as a dev
   dep for the no-drift test; drop `graphql` from `search`'s direct deps.
4. **Separate discovery vs lineage** as `search` subpath exports (not packages) —
   documents the seam cheaply; revisit packaging only if a second consumer appears.

Adjacent audit findings, tracked here so they aren't lost, each its own PR after
the decomposition: **(5)** coverage measurement with per-file floors that exclude
the flake-prone oxigraph cold-start paths; **(6)** propagate the
requirements-table pattern (this ADR + `graphql-autocomplete`) to the remaining
module READMEs; **(7)** reinvented-wheels review — keep the custom SSE parser
(stateful-callback libs are not drop-in) and the LRU (only a no-TTL consumer),
documented as deliberate; optionally adopt `fastest-levenshtein`; **(8)** upgrade
`graphql` 16 → 17 (removes the dual-instance hazard); **(9)** decide wire-contract
versioning / OpenAPI (likely deferred to partner exposure).

## Alternatives considered

- **Leave it; just split files inside `search`.** Removes the god-file but not the
  god-package; the codec stays un-reusable and the IR stays heavy. Rejected as a
  half-measure (though step 1 does exactly this as a safe first increment).
- **One big-bang refactor PR.** Rejected — unreviewable, high blast radius.
- **Move the IR into `api-types`.** Rejected — the IR carries a Zod schema
  (runtime), whereas `api-types` is deliberately zero-runtime-dep and browser-safe.
  A dedicated `slots` package keeps that boundary clean.

## Related

- [ADR 0001](./0001-graphql-editor-schema-from-discovery.md),
  [ADR 0002](./0002-field-based-recursive-references.md) — the editor schema /
  reference work whose codec this ADR relocates.
