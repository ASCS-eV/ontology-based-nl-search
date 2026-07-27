# Residual-gate coverage manifest

The **residual gate** covers ASAM qc rules that are out of reach of both the
SHACL **semantic gate** (`semantic-gate.ts`, referential / uniqueness /
cross-file resolution over the RDF instance graph) and the structural **WASM
checker** (`packages/authoring-wasm`, XSD/enum/type conformance of the emitted
`.xosc`). It is selected by `RESIDUAL_MODE` exactly as the authoring backend is
selected by `AUTHORING_MODE`.

Each row maps a residual rule to its UID (`packages/authoring-gate/src/qc-rules.ts`)
and the backend that decides it. A rule with **no configured backend is reported
`skipped`** — it is never silently treated as a pass (see `GateResult.skipped`).

Every rule in this gate is **repo-declared**: no ASAM checker bundle publishes an
analytic G1/G2 continuity rule or a simulation-decided rule, so all four carry
this repo's emanating entity rather than `asam.net`. That is enforced by
`src/__tests__/qc-rules.test.ts` against the pinned bundle rule lists in
`qc-bundles/` — a UID here cannot silently claim to be an ASAM rule.

| Rule                                    | UID                                                                   | Backend                 | Default | Decidable in-process? |
| --------------------------------------- | --------------------------------------------------------------------- | ----------------------- | ------- | --------------------- |
| Road-geometry heading continuity (G1)   | `envited-x.net:xodr:1.0.0:road.geometry.continuity`                   | `in-process` (analytic) | on      | ✅ pure geometry      |
| Road-geometry curvature continuity (G2) | `envited-x.net:xodr:1.0.0:road.geometry.continuity`                   | `in-process` (analytic) | on      | ✅ pure geometry      |
| No collision at scenario start          | `envited-x.net:xosc:1.0.0:simulation.no_collision_at_scenario_start`  | `external` (simulator)  | off     | ❌ needs simulation   |
| Target reachable within horizon         | `envited-x.net:xosc:1.0.0:simulation.reachable_target_within_horizon` | `external` (simulator)  | off     | ❌ needs simulation   |

The closest published ASAM rule to the continuity pair is
`asam.net:xodr:1.7.0:lane_smoothness.contact_point_no_horizontal_gaps`, recorded
as `relatedAsamRule` in the catalog for orientation. It is a positional test at
lane contact points, not a tangent/curvature test at geometry-primitive joins,
so it is **not** what this gate implements and never carries the attribution.

## Backends

- **`in-process`** (`InProcessResidualChecker`, default) — pure, deterministic
  analytic geometry over the lifted `.xodr` planView primitives (line / arc /
  spiral). Checks heading (G1) and curvature (G2) continuity at each primitive
  join within a tolerance. No Python, no simulator, no I/O. Simulation-only rules
  are reported `skipped`.

- **`external`** (`ExternalResidualChecker`, opt-in via `RESIDUAL_MODE=external`)
  — runs the same analytic geometry check **and**, when
  `RESIDUAL_EXTERNAL_COMMAND` names one, invokes an out-of-process ASAM checker
  bundle over the same road network and imports its `.xqar` as gaps carrying the
  bundle's own rule UIDs. That is how the published OpenDRIVE rules are covered:
  by running the bundle that implements them. See [QC-INTEROP.md](./QC-INTEROP.md).

  Simulation-only rules stay `skipped` — no configured backend decides them — and
  a bundle that fails to run is reported as skipped with the
  `external-bundle-unavailable: ` prefix rather than passing silently.

## Why a separate residual gate

Geometry continuity is a numeric property of the road network, not of the
scenario graph — it cannot be expressed as SPARQL over the IR, and the WASM
structural checker only validates the `.xosc` against the schema (it never reads
the `.xodr` geometry). The residual gate is where those "everything else"
plausibility rules live, cleanly separated from the two structural gates.
