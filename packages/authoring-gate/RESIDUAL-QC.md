# Residual-gate coverage manifest

The **residual gate** covers ASAM qc rules that are out of reach of both the
SHACL **semantic gate** (`semantic-gate.ts`, referential / uniqueness /
cross-file resolution over the RDF instance graph) and the structural **WASM
checker** (`packages/authoring-wasm`, XSD/enum/type conformance of the emitted
`.xosc`). It is selected by `RESIDUAL_MODE` exactly as the authoring backend is
selected by `AUTHORING_MODE`.

Each row maps a residual rule to its canonical ASAM UID
(`packages/authoring-gate/src/qc-rules.ts`) and the backend that decides it. A
rule with **no configured backend is reported `skipped`** — it is never silently
treated as a pass (see `GateResult.skipped`).

| Rule                                    | UID                                                 | Backend                 | Default | Decidable in-process? |
| --------------------------------------- | --------------------------------------------------- | ----------------------- | ------- | --------------------- |
| Road-geometry heading continuity (G1)   | `asam.net:xodr:1.7.0:road.geometry.continuity`      | `in-process` (analytic) | on      | ✅ pure geometry      |
| Road-geometry curvature continuity (G2) | `asam.net:xodr:1.7.0:road.geometry.continuity`      | `in-process` (analytic) | on      | ✅ pure geometry      |
| No collision at scenario start          | `asam.net:xosc:sim:no_collision_at_scenario_start`  | `external` (simulator)  | off     | ❌ needs simulation   |
| Target reachable within horizon         | `asam.net:xosc:sim:reachable_target_within_horizon` | `external` (simulator)  | off     | ❌ needs simulation   |

## Backends

- **`in-process`** (`InProcessResidualChecker`, default) — pure, deterministic
  analytic geometry over the lifted `.xodr` planView primitives (line / arc /
  spiral). Checks heading (G1) and curvature (G2) continuity at each primitive
  join within a tolerance. No Python, no simulator, no I/O. Simulation-only rules
  are reported `skipped`.

- **`external`** (`ExternalResidualChecker`, opt-in via `RESIDUAL_MODE=external`)
  — runs the same analytic geometry check **and** exposes the seam for an
  out-of-process simulator adapter (esmini + the ASAM qc-framework) that would
  decide the collision / physics rules. No runner is wired in-repo, so those
  rules remain `skipped` (honest, never fabricated). The self-test provisions a
  real runner against this seam.

## Why a separate residual gate

Geometry continuity is a numeric property of the road network, not of the
scenario graph — it cannot be expressed as SPARQL over the IR, and the WASM
structural checker only validates the `.xosc` against the schema (it never reads
the `.xodr` geometry). The residual gate is where those "everything else"
plausibility rules live, cleanly separated from the two structural gates.
