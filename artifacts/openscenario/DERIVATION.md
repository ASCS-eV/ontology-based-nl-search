# DERIVATION — OpenSCENARIO authoring domain (cut-in subset)

This domain (`openscenario.owl.ttl`, `openscenario.shacl.ttl`,
`openscenario.context.jsonld`) is **derived**, not hand-invented. It is the
translation dictionary for scenario authoring — the authoring analog of the
search feature's ontology artifacts (task 01 of `plans/xosc-authoring/`).

## Normative sources

| What                                                | Source                                                                                                                                                             | Used for                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Class/property vocabulary, enumerations, occurrence | **ASAM OpenSCENARIO 1.3.0** — `OpenSCENARIO.xsd` (`submodules/ontology-management-base/imports/OpenScenario/OpenSCENARIO.xsd`, 106 KB)                             | `owl:Class` / `owl:*Property`, `sh:in`, `sh:min/maxCount` |
| Numeric value bounds                                | **`RangeCheckerRulesV1_3`** — `submodules/openscenario-api/cpp/openScenarioLib/generated/v1_3/checker/range/RangeCheckerRulesV1_3.cpp` (RA Consulting, Apache-2.0) | `sh:minInclusive` / `sh:maxInclusive` / `sh:minExclusive` |

The **same** `RangeCheckerRulesV1_3` file is compiled into the in-process WASM
checker (`packages/authoring-wasm`). Design-time SHACL and the runtime checker
therefore read one source and **cannot drift**.

## Method

1. **complexType → `owl:Class`**; **child element → `owl:ObjectProperty`** (named
   camelCase of the child element); **attribute → `owl:DatatypeProperty`**. This is
   the exact convention the generic XML→RDF lift (`packages/ontology/src/xml-to-rdf.ts`)
   emits, so a lifted `.xosc` is typed by these shapes without any bespoke mapping.
2. **Enumerations** (`sh:in`) transcribed verbatim from the XSD `simpleType`
   `xsd:enumeration` members: `VehicleCategory`, `ParameterType`, `DynamicsShape`,
   `DynamicsDimension`.
3. **Numeric bounds** transcribed from the corresponding `*RangeCheckerRule`:
   - `Axle.maxSteering` ∈ `[0, π]`, `Axle.wheelDiameter` `> 0`, `Axle.trackWidth` `>= 0`
   - `Performance.maxSpeed | maxAcceleration | maxDeceleration` `>= 0`
   - `Dimensions.width | length | height` `>= 0`
   - `LanePosition.s` `>= 0`
4. **Role-vs-type**: the XSD `Axles` element carries two role-elements
   (`FrontAxle`, `RearAxle`) both of `complexType Axle`. Because the generic lift
   types nodes by element name, `FrontAxle`/`RearAxle` are declared
   `rdfs:subClassOf Axle` and `AxleShape` targets all three explicitly.

## Manual curation deltas

- **Scope**: curated to the **cut-in archetype subset** (`Entities`,
  `ScenarioObject`, `Vehicle` + `Performance`/`BoundingBox`/`Axles`, `RoadNetwork`,
  `ParameterDeclarations`, `Storyboard`/`Init`/`Private`, the `Position` family,
  and the lateral `LaneChangeAction` family). The XSD has 287 complexTypes; full
  coverage is a later slice (see task 01 non-goals). Unmodeled elements are
  unconstrained (SHACL open-world), so lifting a full `.xosc` never fails on them.
- **Stable IRIs / prefixes**: namespace `https://w3id.org/ascs-ev/envited-x/openscenario/v1/`
  (ASCS-eV policy), prefix `openscenario:`.
- **References kept raw**: reference-valued attributes (`entityRef`) are modeled as
  `owl:DatatypeProperty` here (raw string, round-trip fidelity for lowering,
  task 04). Their first-class `owl:ObjectProperty` projection + referential
  resolution is task 03.

## Round-trip (lossy) notes for lowering (task 04)

RDF is unordered and non-choice; these XSD constructs are **not** recoverable from
the lifted graph alone and must be restored by the model-generated writer (task 04),
never by a hand serializer:

- **`xsd:sequence` order** — element order within a type is significant for XSD
  validity; the graph does not preserve it.
- **`xsd:choice`** — e.g. `Position` is a choice of `LanePosition` /
  `RelativeLanePosition` / …; the graph records which was chosen but not that it is
  an exclusive choice.
- **Attribute vs. element placement** — both become predicates in RDF.

## Regeneration

Enumerations and bounds are small and stable within a minor version. On an
OpenSCENARIO version bump: re-read the new XSD `simpleType` members and the new
`RangeCheckerRules` bounds, update `sh:in` / `sh:min*` / `sh:max*`, and bump
`owl:versionInfo`. The generic lift and the shape structure are unaffected.
