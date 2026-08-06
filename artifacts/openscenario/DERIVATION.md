# DERIVATION — OpenSCENARIO authoring domain (cut-in subset)

`openscenario.shacl.ttl` is **generated**, not hand-invented. It is the
translation dictionary the scene-authoring LLM prompt embeds for grounding
(`packages/llm/src/authoring/scene-prompt.ts`) — the authoring analog of the
search feature's ontology artifacts.

Regenerate: `pnpm --filter @ontology-search/ontology derive:openscenario-authoring`
(`--check` variant verifies without writing; both run
`packages/ontology/scripts/derive-openscenario-authoring-shacl.mjs`).

## History

Before OMB v0.4.0, no native OpenSCENARIO ontology existed anywhere upstream —
only the raw `OpenSCENARIO.xsd`. This repo hand-derived `openscenario.owl.ttl`

- `openscenario.shacl.ttl` from that XSD via a documented method, paired with a
  domain-agnostic generic XML→RDF lift (`packages/ontology/src/xml-to-rdf.ts`) so
  a lifted `.xosc` would validate against the hand-derived shapes.

OMB v0.4.0 now vendors **ASAM's own generated** OpenSCENARIO OWL 2 ontology and
SHACL shapes (`.ontology/imports/openscenario/openscenario.owl.ttl` — see that
file's README for provenance: generated from ASAM's own UML model by
`asam-openx-standards`, not by this repo). That removes the need for this repo
to derive class/property/enum vocabulary from the raw XSD itself, so:

- `openscenario.owl.ttl` and `openscenario.context.jsonld` (the hand-derived
  class declarations and JSON-LD context) were **deleted** — nothing in the
  live pipeline consumed them beyond an acceptance test for the now-removed
  generic lift.
- The generic XML→RDF lift (`packages/ontology/src/xml-to-rdf.ts`) was
  **deleted**. It existed only to make a lifted `.xosc` validate against the
  hand-derived shapes; with no live consumer once the hand-derivation is gone,
  keeping it would be dead code. (The "existing maps" cross-file check — the
  one live consumer of a comparable lift, for `.xodr` road networks — is now
  grounded directly in ASAM's real OpenDRIVE ontology by a narrow,
  purpose-built extractor: `packages/authoring-gate/src/opendrive-ontology.ts`
  - `opendrive-road-lift.ts`. See that module's doc comment for why a full
    generic lift is not the right shape for that check either.)
- Structural validation of an authored `.xosc` remains XSD-based — the
  in-process WASM engine (`packages/authoring-wasm`) — unaffected by any of
  this; nothing here removes or replaces the XSD as the normative schema for
  `.xosc` / `.xodr` documents.

## Normative sources (current)

| What                          | Source                                                                                                                                                             | Used for                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Class existence, enumerations | **ASAM OpenSCENARIO 1.3.0** — generated OWL, vendored by OMB v0.4.0+ at `.ontology/imports/openscenario/openscenario.owl.ttl` (pinned by `ontology-package.json`)  | `owl:oneOf` → `sh:in`; drift guard on required classes    |
| Numeric value bounds          | **`RangeCheckerRulesV1_3`** — `submodules/openscenario-api/cpp/openScenarioLib/generated/v1_3/checker/range/RangeCheckerRulesV1_3.cpp` (RA Consulting, Apache-2.0) | `sh:minInclusive` / `sh:maxInclusive` / `sh:minExclusive` |

Numeric bounds are **not** part of ASAM's generated OWL/SHACL model at all (the
pinned ontology has zero `sh:minInclusive` triples — verified by the derivation
script) — they remain sourced from `RangeCheckerRulesV1_3`, the SAME file
compiled into the in-process WASM checker (`packages/authoring-wasm`), so
design-time SHACL and the runtime checker cannot drift from each other.

## Method

`packages/ontology/scripts/derive-openscenario-authoring-shacl.mjs`:

1. Parses the pinned `openscenario.owl.ttl` with a real RDF parser (n3).
2. For each of `VehicleCategory`, `ParameterType`, `DynamicsShape`,
   `DynamicsDimension`, reads the `rdfs:Datatype`'s `owl:oneOf` list **live**
   and emits it as `sh:in` — never hand-transcribed. (This is exactly the gap
   that let `VehicleCategory` silently freeze at 10 of ASAM's 21 real values
   under the old XSD-transcription method — a live read cannot go stale
   between ontology bumps the way a one-time transcription can.)
3. Verifies every class this artifact's shapes target (`FileHeader`,
   `ParameterDeclaration`, `RoadNetwork`, `Entities`, `ScenarioObject`,
   `Vehicle`, `Performance`, `Dimensions`, `Axle`, `TransitionDynamics`,
   `LanePosition`, `RelativeLanePosition`, `AbsoluteTargetSpeed`) still exists
   upstream, by `rdfs:label` on an `owl:Class` — failing loudly, not silently,
   on an ASAM rename.
4. Numeric bounds are **not** derivable from the OWL/SHACL model (see above),
   so they remain a hand-maintained overlay in the script, transcribed from
   `RangeCheckerRulesV1_3` exactly as before:
   - `Axle.maxSteering` ∈ `[0, π]`, `Axle.wheelDiameter` `> 0`, `Axle.trackWidth` `>= 0`
   - `Performance.maxSpeed | maxAcceleration | maxDeceleration` `>= 0`
   - `Dimensions.width | length | height` `>= 0`
   - `LanePosition.s` `>= 0`
5. **Role-vs-type**: ASAM's model shares ONE class across several XML element
   names for `Axle` (`Axle`, `FrontAxle`, `RearAxle` — the pinned ontology
   models only `Axle`; `FrontAxle`/`RearAxle` are XSD role-elements of it, not
   distinct OWL classes) and for dynamics (`TransitionDynamics` is the shared
   class; `SpeedActionDynamics`/`LaneChangeActionDynamics` are the XSD
   role-elements `SpeedAction`/`LaneChangeAction` use it under). The drift
   guard checks the shared upstream class; this artifact's own `sh:targetClass`
   still lists all the role-element aliases, matching the actual `.xosc`
   element names an author would see.

## Manual curation (unaffected by the OMB bump)

- **Scope**: curated to the **cut-in archetype subset** (`Entities`,
  `ScenarioObject`, `Vehicle` + `Performance`/`BoundingBox`/`Axles`,
  `RoadNetwork`, `ParameterDeclarations`, `Storyboard`/`Init`/`Private`, the
  `Position` family, and the lateral `LaneChangeAction` family) —
  `packages/authoring/src/ir-to-engine.ts` lowers exactly this subset. ASAM's
  model has 287 complexTypes; full coverage is a later slice. Unmodeled
  concepts are simply absent from this excerpt — this artifact is prompt text,
  never executed as real SHACL validation, so there is no open/closed-world
  concern.
- **Stable IRIs / prefixes**: namespace `https://w3id.org/ascs-ev/envited-x/openscenario/v1/`
  (ASCS-eV policy, this repo's own — distinct from ASAM's real
  `http://code.asam.net/simulation/standard/openscenario#`), prefix
  `openscenario:`. This artifact's job is informational grounding for the LLM,
  not a literal RDF projection of `.xosc` instances, so it keeps its own
  stable namespace rather than ASAM's.
- **References kept raw**: reference-valued attributes (`entityRef`) are
  modeled as `owl:DatatypeProperty` here (raw string) — referential resolution
  is the semantic gate's SPARQL concern (`packages/authoring-gate`), not this
  artifact's.
