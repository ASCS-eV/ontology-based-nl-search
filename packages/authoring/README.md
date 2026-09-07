# @ontology-search/authoring

> The authoring backend seam — a config-selected, swappable `AuthoringBackend` over the in-process OpenSCENARIO WASM engine.

**Layer:** rank 2, alongside `sparql` and `ontology`. Depends on `authoring-ir`, `authoring-wasm`, `road-catalog` and `core`.

## Purpose

This package is to the OpenSCENARIO engine what `packages/sparql` is to Oxigraph: one interface, two implementations, selected by validated config, so that **nothing above this layer knows an engine exists**.

`getAuthoringBackend()` reads `AUTHORING_MODE`:

- **`wasm`** (default) — `WasmAuthoringBackend`, the RA Consulting `openscenario.api.test` C++ engine compiled to WebAssembly and loaded in-process. It authors, serializes and validates OpenSCENARIO 1.3 with element-attributed diagnostics.
- **`null`** — `NullAuthoringBackend`, a deterministic no-engine backend for tests and for running the deterministic half of the pipeline without paying the ~5.7 MB artifact.

The lowering itself (`irToEngineTree`) is deterministic and pure: it maps an `AuthoringIR` onto the engine's typed tree and reports, rather than silently drops, any action the engine cannot express (`unexpressibleActions`). An action the IR carries but OpenSCENARIO cannot represent becomes a rule-attributed gap, never a quietly smaller scenario.

## Public interface

| Subpath     | Purpose                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`         | `getAuthoringBackend` / `closeAuthoringBackend`, both implementations, the capability probe, and `irToEngineTree` / `unexpressibleActions`. |
| `./backend` | The `AuthoringBackend` interface and its diagnostic / options / result types — for consumers that only need to type against the contract.   |

## Requirements & invariants

| #   | Requirement / invariant                                                                                                                                                                             | Guarding test                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| A1  | `getAuthoringBackend()` selects on `AUTHORING_MODE` and returns the same instance for the process; `closeAuthoringBackend()` releases it and is idempotent.                                         | `__tests__/backend-factory.test.ts`  |
| A2  | The null backend reports no engine and empty versions rather than pretending — a caller can always distinguish "not validated" from "validated clean".                                              | `__tests__/null-backend.test.ts`     |
| A3  | The engine's reported versions must match `ENGINE_VERSIONS` (the pinned artifact's own `versions.json`), so a stale or mis-built `osc-engine.wasm` fails loudly at startup.                         | `__tests__/capability-probe.test.ts` |
| A4  | A `describe()` that throws is surfaced as a `BackendCapabilityError`, not swallowed into a "no engine" answer.                                                                                      | `__tests__/capability-probe.test.ts` |
| A5  | Golden conformance against the real WASM engine: a known-good scenario is accepted, a known-bad one is rejected **with a located diagnostic** (the gate has teeth), and repeated validations agree. | `__tests__/wasm-backend.test.ts`     |
| A6  | Lowering is pure and deterministic — the same IR yields a deep-equal engine tree.                                                                                                                   | `__tests__/ir-to-engine.test.ts`     |
| A7  | An IR action the single-maneuver lowering omits is REPORTED by `unexpressibleActions`, never silently dropped; an all-expressible scene reports nothing.                                            | `__tests__/ir-to-engine.test.ts`     |
| A8  | An already-aborted signal is honoured before dispatch, so a cancelled request never enters the engine.                                                                                              | `__tests__/wasm-backend.test.ts`     |

## How to interface

```ts
import { getAuthoringBackend } from '@ontology-search/authoring'
import type { AuthoringBackend } from '@ontology-search/authoring/backend'

const backend = getAuthoringBackend()
const result = await backend.validate(xosc, { files })
```

Engine-level types (`EngineInfo`, `EngineFiles`, `EngineParameters`, `Severity`) come from `@ontology-search/authoring-wasm` directly — this package does not re-export them, so the dependency stays visible to `scripts/check-layers.mjs`.

## See also

- ADR [0006](../../docs/adr/0006-authoring-wasm-engine-ops-model.md) — version single-sourcing, reproducible build, ops model.
- ADR [0007](../../docs/adr/0007-openscenario-fork-carry-branch.md) — the fork carry-branch that replaced the build-time patch.
- `@ontology-search/authoring-gate` — the design-time gates the engine cannot enforce.
