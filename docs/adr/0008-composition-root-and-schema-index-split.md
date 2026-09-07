# ADR 0008 — Composition root & `schema-index` extraction: deferred

- **Status:** Accepted (decision: defer)
- **Date:** 2026-08-07

## Context

An architecture audit raised two structural findings alongside seven smaller
ones. The seven were implemented (PRs #210–#217). These two were held back
because their cost is high and their payoff turned out, on inspection, to be
speculative. This ADR records why, so the finding is not re-opened from the
audit notes alone.

### Finding E — ambient state behind a dependency-injection façade

`packages/search/src/service.ts` declares:

> `SearchService` class with constructor-injected dependencies (Dependency
> Inversion) — **No global state**, all external I/O accessed through typed
> interfaces.

That is true of the class and false of the composed system. The production
wiring in `apps/api/src/search-factory.ts` injects `getInitializedStore`,
`compileSlotsWithTrace`, `compileAllCountQueries` and `generateStructuredSearch`
— each of which reads a module-level singleton internally. The injection seam is
one layer thick over ambient globals.

Repo-wide there are roughly thirty module-level mutable caches, and four
different composition strategies coexist: constructor DI (`SearchService`),
config-selected singleton with a lifecycle (`getAuthoringBackend`,
`getSparqlStore`, `getAgentBackend`), factory singleton with a test reset
(`search-factory`), and — the one that scales — a cache keyed by its owner
(`schema-index/term-index.ts`, `WeakMap<SparqlStore, …>`).

The proposed fix was to converge the caches onto that last pattern.

### Finding G — `search` is still a large package

`packages/search` is 9,468 LOC. `schema-index/` (7 files, 1,502 LOC — term
index, lexical ranking, retrieval, fragment extraction, embedding seam) is a
cohesive subsystem with a clean dependency direction, and was the obvious
candidate to extract, following the `slots` and `graphql-ir` extractions of
[ADR 0003](./0003-decompose-search-package.md).

## Decision

**Defer both.** Fix the false claim in `service.ts` instead.

### E — the capability it would unlock is already available

The argument for converging the singletons was that process-wide state makes it
impossible to serve two ontologies from one process. But the genericity proof
already does exactly that. From `packages/testing/src/eval/__tests__/ontology-swap.test.ts`:

> The suite runs in its own vitest process (`fileParallelism: false`, `isolate`)
> so the process-wide singletons (config, store, registry, indices) are built
> once, against the fixture only.

Process isolation solves it, simply and without touching production code. And
the API server loads one ontology at startup and holds it for the process
lifetime — for that lifetime a singleton is the _correct_ model, not an
accident of how the code grew.

So the refactor fixes no observed defect and unlocks no needed capability, while
touching ~30 sites across 6 packages whose measured coverage is 70–87%
(see [ADR 0004](./0004-reinvented-wheels-review.md) for the sibling
"don't change what works" decision, and the floors introduced in PR #216).
That is the worst risk-to-payoff ratio available in this codebase: the widest
blast radius over the weakest safety net, for a benefit nobody has asked for.

What was worth doing, and is done: the six `reset*` cache hooks are no longer
part of any published entry point (PR #217). Those existed for tests, and
shipping a way to clear process-wide caches as part of the public contract
invited a caller to use it. The ambient state remains; the invitation does not.

### G — extraction would add a dependency, not remove one

The premise was that `llm` could then depend on the retrieval subsystem rather
than on all of `search`. It cannot. `llm` imports 21 symbols from `search`:

| Origin                 | Symbols |
| ---------------------- | ------: |
| `schema-index/`        |       9 |
| discovery / vocabulary |       6 |
| `compiler`             |       4 |
| `init`, `types`        |       2 |

Extracting `schema-index` leaves `llm` needing `search` anyway for the compiler
and the discovery surface, so it **adds** a package edge instead of removing
one.

This is the test the earlier extractions passed and this one fails. `slots` and
`graphql-ir` came out of `search` because `web` and `lsp-server` needed them
_without_ transitively pulling Oxigraph WASM, Node `fs` and the SHACL validator
into a browser bundle — a concrete, demonstrable payoff. `schema-index` has no
consumer that wants it independently; its only two users already depend on
`search` for other reasons. The move is 1,502 LOC of file relocation with no
logic change and no coupling reduction.

`search` being large is real. But splitting it _for the number_ is the same
error as the `compiler-helpers.ts` re-export barrel deleted in PR #217, which
satisfied the <400-LOC rule while re-exporting every sub-module so consumers
imported from one undifferentiated surface anyway — metric met, boundary
inert.

## Consequences

- `service.ts` now describes what the composed system actually does. A reader
  no longer has to discover by inspection that the injected dependencies read
  singletons.
- The ambient-state pattern stays. It is documented here rather than implied,
  so a future contributor meets the reasoning instead of the finding.
- `search` stays at ~9.5k LOC. If it grows further, the trigger for splitting
  should be **a consumer that needs a part of it without the rest** — the test
  ADR 0003's successful extractions passed — not the line count.
- Neither decision is permanent. The conditions that would flip them are named
  below.

## Revisit when

- **E** — a second ontology must be served from one process (multi-tenant
  deployment, or hot-reload of the ontology pin without a restart); or the
  singletons start causing real test interference that process isolation cannot
  contain.
- **G** — a consumer appears that needs schema retrieval _without_ the compiler
  and discovery surface. A plausible one: the LSP server, if it ever moves from
  fetching a `VocabularyResponse` over HTTP to building the term index locally.

## Alternatives considered

- **Do both now.** Rejected: ~30 sites over 70–87%-covered code plus a 1,502-LOC
  move, for no observed defect and no requested capability.
- **Do E only.** Rejected for the same reason; the `reset*` removal in PR #217
  already took the part with a concrete rationale.
- **Do G only.** Rejected: it increases `llm`'s package-dependency count.
- **Say nothing and leave the audit finding open.** Rejected — the finding is
  reasonable on its face, and without this record the next reader re-derives it
  and re-opens the work.

## Related

- [ADR 0003](./0003-decompose-search-package.md) — the extractions that did earn
  their keep, and the test this one fails.
- [ADR 0004](./0004-reinvented-wheels-review.md) — the sibling decision to keep
  three custom utilities rather than adopt libraries that buy nothing.
- [ADR 0005](./0005-wire-contract-versioning-and-openapi.md) — the same
  "defer until a real consumer exists" reasoning applied to the wire contract.
- PRs #210–#217 — the seven audit findings that were implemented.
