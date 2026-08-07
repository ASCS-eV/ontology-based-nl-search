# @ontology-search/authoring-gate

> The authoring semantic + residual gates — the design-time half of validation, enforcing what the runtime checker cannot.

**Layer:** rank 3, alongside `search`. Depends on `authoring-ir`, `ontology`, `sparql`, `api-types` and `core`.

## Purpose

The WASM engine (`@ontology-search/authoring`) answers "is this a well-formed OpenSCENARIO document?" — schema validity, element attribution. It cannot answer "does this scenario make sense?": whether an `entityRef` resolves to a declared entity, whether two entities share a name, or whether a road id referenced by the `.xosc` exists in the `.xodr` it points at. Those are **cross-file, referential and geometric** questions.

This package is the authoring-domain analog of `packages/search`: it lowers a validated `AuthoringIR` to an RDF instance graph and asks those questions as **real SPARQL** over the in-process Oxigraph store, rather than as bespoke object-graph walks. Three gates run in order:

| Gate           | Question                                                                             | Mechanism                                              |
| -------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| **semantic**   | Do references resolve? Are names unique? Does the road id exist in the road network? | SPARQL over `irToRdf` + `liftOpenDriveRoadFacts`       |
| **structural** | Is the emitted document schema-valid?                                                | delegated to the WASM engine                           |
| **residual**   | Is the road geometry G1/G2-continuous? Does the scenario start in collision?         | in-process analytic geometry, or an external QC bundle |

Every gap is attributed to a **rule UID** — `asam.net:xosc:1.2.0:reference_control.…` where ASAM defines one, a repo-scoped UID where it does not — so the repair loop can cite the exact rule to the model and results can be exported as a standard `.xqar` report.

Grounding is real, not hand-typed: `opendrive-ontology.ts` resolves the OpenDRIVE class and property IRIs from the **pinned ASAM ontology**, so the lifted facts are typed by the standard's own vocabulary. Gate-internal modelling predicates live under a separate `gate:` namespace and are never confused with it.

## Public interface

Single entry point (`.`). The notable exports:

| Export                                                   | Purpose                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `runSemanticGate`                                        | The referential / uniqueness / cross-file gate.                            |
| `runResidualGate`, `getResidualChecker`                  | Geometry continuity + collision checks, in-process or via external bundle. |
| `irToRdf`, `liftOpenDriveRoadFacts`, `OSC_NS`, `GATE_NS` | The RDF lowering the semantic gate queries.                                |
| `QC_RULES`                                               | The rule identities every gap is attributed to.                            |
| `gapsToXqar`, `parseXqar`                                | Standard `.xqar` report emission and ingestion.                            |
| `warmOpenDriveRoadGrounding`                             | Startup warm of the ontology-grounding cache.                              |

## Requirements & invariants

| #   | Requirement / invariant                                                                                                                                    | Guarding test                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| G1  | An unresolvable entity reference is flagged with the `reference_control` UID, including through `$param` indirection.                                      | `__tests__/semantic-gate.test.ts`       |
| G2  | A duplicate entity name is flagged with the `unique_element_names` UID — the lowering keys individuals by INDEX so a duplicate stays visible as two nodes. | `__tests__/semantic-gate.test.ts`       |
| G3  | A road id absent from the `.xodr` is flagged; with no road network supplied the cross-file check does not run at all rather than reporting a false gap.    | `__tests__/semantic-gate.test.ts`       |
| G4  | A grounding that cannot be resolved records the rule as **skipped**, never as passed, and never throws into the request path.                              | `__tests__/semantic-gate.test.ts`       |
| G5  | Literal escaping is symmetric across the lowering and the queries — an entity name carrying a quote, backslash or control character still resolves.        | `__tests__/rdf-literal-turtle.test.ts`  |
| G6  | The emitted instance graph is well-formed Turtle for any IR, and a value carrying triple syntax cannot inject a second subject.                            | `__tests__/rdf-literal-turtle.test.ts`  |
| G7  | OpenDRIVE class/property IRIs are resolved from the pinned ontology, never hand-typed.                                                                     | `__tests__/opendrive-ontology.test.ts`  |
| G8  | Malformed `.xodr` XML yields an empty-but-well-formed fact graph, so the gate reports unresolvable references instead of throwing.                         | `__tests__/opendrive-road-lift.test.ts` |
| G9  | Emitted `.xqar` is readable by the ASAM framework at the configured `resultFile`, and a clean run still produces a well-formed empty result.               | `__tests__/qc-bundle-entry.test.ts`     |

## How to interface

```ts
import { runSemanticGate, QC_RULES } from '@ontology-search/authoring-gate'

const result = await runSemanticGate(ir, { roadNetworkXodr })
// result.gaps carry `ruleUid`; result.skipped names rules that could not run
```

## See also

- `@ontology-search/authoring-ir` — the IR these gates validate.
- `@ontology-search/authoring` — the WASM engine behind the structural gate.
- `packages/llm/src/authoring/scene-agent.ts` — the bounded repair loop driven by these gaps.
