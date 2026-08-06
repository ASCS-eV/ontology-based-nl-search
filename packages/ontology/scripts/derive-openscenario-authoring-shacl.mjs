#!/usr/bin/env node
/**
 * Derive `artifacts/openscenario/openscenario.shacl.ttl` — the cut-in-archetype
 * SHACL excerpt `packages/llm/src/authoring/scene-prompt.ts` embeds in the
 * scene-authoring system prompt.
 *
 * Before OMB v0.4.0, no native OpenSCENARIO ontology existed anywhere upstream,
 * so this repo hand-transcribed enums and occurrence constraints straight out of
 * `OpenSCENARIO.xsd`. OMB v0.4.0 now vendors ASAM's OWN generated OWL 2 ontology
 * (`.ontology/imports/openscenario/openscenario.owl.ttl` — see that file's
 * README for provenance), so the enum vocabularies below are DERIVED from it
 * (each `owl:oneOf` read live, never hand-typed) instead of re-transcribed from
 * the XSD by hand. A renamed or removed upstream datatype fails this script
 * loudly rather than silently freezing a stale enum in the committed artifact
 * (as `VehicleCategory` had: 10 hand-picked values against ASAM's current 21).
 *
 * What is still hand-curated, and why:
 *   - The CLASS/PROPERTY SCOPE (which classes, which of their properties) is
 *     the cut-in archetype subset `packages/authoring/src/ir-to-engine.ts`
 *     lowers to — narrower than ASAM's full 287-complexType model on purpose
 *     (see `artifacts/openscenario/DERIVATION.md`).
 *   - NUMERIC BOUNDS (`sh:minInclusive`/`sh:maxInclusive`/`sh:minExclusive`) are
 *     not part of the OWL/SHACL model at all (verified: the pinned ontology
 *     has zero `sh:minInclusive` triples) — they come from the engine's own
 *     `RangeCheckerRulesV1_3` (a DIFFERENT pinned source, `submodules/openscenario-api`),
 *     transcribed here exactly as before so design-time and the runtime WASM
 *     checker cannot drift from each other [OSC-RCR].
 *
 * Usage:
 *   node packages/ontology/scripts/derive-openscenario-authoring-shacl.mjs            # write
 *   node packages/ontology/scripts/derive-openscenario-authoring-shacl.mjs --check    # verify only; non-zero exit if stale
 *
 * [OWL2] OWL 2 Web Ontology Language (docs/specs/references/owl2-syntax.md).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Parser as N3Parser } from 'n3'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..', '..')
const CHECK_ONLY = process.argv.includes('--check')

const PINNED_ONTOLOGY = join(REPO, '.ontology', 'imports', 'openscenario', 'openscenario.owl.ttl')
const OUTPUT = join(REPO, 'artifacts', 'openscenario', 'openscenario.shacl.ttl')

const OWL = 'http://www.w3.org/2002/07/owl#'
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#'

/** Every `rdfs:Datatype` this artifact needs an `owl:oneOf` enum list for. */
const ENUM_DATATYPES = ['ParameterType', 'VehicleCategory', 'DynamicsShape', 'DynamicsDimension']

/**
 * Every class this artifact must find in the pinned ontology (drift guard).
 * Named by the REAL ASAM class, not this artifact's own element-role aliases:
 * `<OpenSCENARIO>` is the document root (no OWL class upstream — never a
 * shape target check); `<FrontAxle>`/`<RearAxle>` and `<SpeedActionDynamics>`/
 * `<LaneChangeActionDynamics>` are XSD role-elements of the SAME shared
 * complexType (`Axle`, `TransitionDynamics` respectively) — exactly the
 * "role-vs-type" pattern `artifacts/openscenario/DERIVATION.md` documents, so
 * the guard checks the shared type, not the per-role element names this
 * artifact's own `sh:targetClass` lists additionally target.
 */
const REQUIRED_CLASSES = [
  'FileHeader',
  'ParameterDeclaration',
  'RoadNetwork',
  'Entities',
  'ScenarioObject',
  'Vehicle',
  'Performance',
  'Dimensions',
  'Axle',
  'TransitionDynamics',
  'LanePosition',
  'RelativeLanePosition',
  'AbsoluteTargetSpeed',
]

/** Resolve an RDF list (`rdf:first`/`rdf:rest`) to an ordered array of literal values. */
function resolveList(quads, headNode) {
  const byNode = new Map()
  for (const q of quads) {
    if (q.subject.termType !== 'BlankNode' && q.subject.termType !== 'NamedNode') continue
    if (!byNode.has(q.subject.value)) byNode.set(q.subject.value, {})
    if (q.predicate.value === `${RDF}first`) byNode.get(q.subject.value).first = q.object
    if (q.predicate.value === `${RDF}rest`) byNode.get(q.subject.value).rest = q.object.value
  }
  const values = []
  let node = headNode
  while (node && node !== `${RDF}nil`) {
    const entry = byNode.get(node)
    if (!entry) break
    if (entry.first) values.push(entry.first.value)
    node = entry.rest
  }
  return values
}

/** Look up the `owl:oneOf` list of a named `rdfs:Datatype` by its `rdfs:label`. */
function findEnumValues(quads, label) {
  const datatype = quads.find(
    (q) =>
      q.predicate.value === `${RDF}type` &&
      q.object.value === `${RDFS}Datatype` &&
      quads.some(
        (l) =>
          l.subject.value === q.subject.value &&
          l.predicate.value === `${RDFS}label` &&
          l.object.value === label
      )
  )
  if (!datatype) {
    throw new Error(
      `derive-openscenario-authoring-shacl: no rdfs:Datatype labelled "${label}" found in ` +
        `${PINNED_ONTOLOGY}. Did ASAM rename it upstream? Update ENUM_DATATYPES to match.`
    )
  }
  const oneOf = quads.find(
    (q) => q.subject.value === datatype.subject.value && q.predicate.value === `${OWL}oneOf`
  )
  if (!oneOf) {
    throw new Error(`derive-openscenario-authoring-shacl: "${label}" declares no owl:oneOf list.`)
  }
  const values = resolveList(quads, oneOf.object.value)
  if (values.length === 0) {
    throw new Error(`derive-openscenario-authoring-shacl: "${label}" owl:oneOf resolved empty.`)
  }
  return values
}

/** Verify every class this artifact targets still exists upstream (drift guard). */
function assertClassesExist(quads) {
  const classSubjects = new Set(
    quads
      .filter((q) => q.predicate.value === `${RDF}type` && q.object.value === `${OWL}Class`)
      .map((q) => q.subject.value)
  )
  const labelledClasses = new Set(
    quads
      .filter((q) => q.predicate.value === `${RDFS}label` && classSubjects.has(q.subject.value))
      .map((q) => q.object.value)
  )
  // ASAM's OWL declares classes by rdfs:label matching the element/class name
  // verbatim for OpenSCENARIO (unlike OpenDRIVE's `T_`-prefixed complexType
  // labels — see packages/authoring-gate/src/opendrive-ontology.ts).
  const missing = REQUIRED_CLASSES.filter((name) => !labelledClasses.has(name))
  if (missing.length > 0) {
    throw new Error(
      `derive-openscenario-authoring-shacl: missing from the pinned ontology: ${missing.join(', ')}. ` +
        `Did ASAM rename or remove them upstream?`
    )
  }
}

function ttlList(values) {
  return `( ${values.map((v) => `"${v}"`).join(' ')} )`
}

/** Render the artifact. Structure mirrors the hand-curated original 1:1; only
 * the four `sh:in` lists are substituted with values read live from the
 * pinned ontology. */
function render(enums) {
  return `# OpenSCENARIO authoring domain — SHACL shapes (cut-in archetype subset).
#
# SHACL CORE ONLY. The repo's SHACL engine (rdf-validate-shacl / Zazuko) evaluates
# W3C SHACL Core; sh:sparql (referential resolution, uniqueness, cross-file) is the
# SHACL semantic gate's concern and runs as SPARQL over the in-process store, not
# here. These shapes encode the value/enum/range/cardinality families — the same
# constraints the in-process WASM checker enforces at runtime, projected to design
# time so an under-specified IR fails fast before serialization.
#
# GENERATED — do not hand-edit. Enums (sh:in) are read live from ASAM's own
# generated OWL ontology (owl:oneOf), never hand-transcribed. Numeric bounds
# (sh:minInclusive/sh:maxInclusive/sh:minExclusive) are transcribed from the
# engine's own RangeCheckerRulesV1_3 (RA Consulting, Apache-2.0), the single
# source the runtime checker uses — so the two gates cannot drift.
#
# Regenerate: node packages/ontology/scripts/derive-openscenario-authoring-shacl.mjs
#
# STANDARDS (criterion #31):
#   [OSC-OWL] ASAM OpenSCENARIO 1.3.0 — generated OWL 2 + SHACL, vendored by
#             OMB v0.4.0+ at .ontology/imports/openscenario/ (enums, classes)
#   [OSC-RCR] RangeCheckerRulesV1_3 — submodules/openscenario-api/cpp/openScenarioLib/
#             generated/v1_3/checker/range/RangeCheckerRulesV1_3.cpp (numeric bounds)
#   [SHACL]   W3C SHACL — docs/specs/references/shacl.md
#   [TURTLE]  W3C RDF 1.1 Turtle — docs/specs/references/turtle.md

@prefix openscenario: <https://w3id.org/ascs-ev/envited-x/openscenario/v1/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://w3id.org/ascs-ev/envited-x/openscenario/v1/shapes>
    a owl:Ontology ;
    owl:imports <https://w3id.org/ascs-ev/envited-x/openscenario/v1> .

openscenario:OpenSCENARIOShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:OpenSCENARIO ;
    sh:property [ sh:path openscenario:fileHeader ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "OpenSCENARIO requires exactly one FileHeader."@en ] ;
    sh:property [ sh:path openscenario:entities ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "OpenSCENARIO requires exactly one Entities."@en ] ;
    sh:property [ sh:path openscenario:storyboard ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "OpenSCENARIO requires exactly one Storyboard."@en ] .

openscenario:FileHeaderShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:FileHeader ;
    sh:property [ sh:path openscenario:revMajor ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:revMinor ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:author ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:date ; sh:minCount 1 ; sh:maxCount 1 ] .

# ParameterType enumeration. [OSC-OWL] rdfs:Datatype ParameterType, owl:oneOf.
openscenario:ParameterDeclarationShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:ParameterDeclaration ;
    sh:property [ sh:path openscenario:name ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:value ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:parameterType ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ${ttlList(enums.ParameterType)} ;
        sh:message "parameterType must be a ParameterType enum member."@en ] .

openscenario:RoadNetworkShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:RoadNetwork ;
    sh:property [ sh:path openscenario:logicFile ; sh:maxCount 1 ] .

openscenario:EntitiesShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:Entities ;
    sh:property [ sh:path openscenario:scenarioObject ; sh:minCount 1 ;
        sh:message "Entities must declare at least one ScenarioObject."@en ] .

openscenario:ScenarioObjectShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:ScenarioObject ;
    sh:property [ sh:path openscenario:name ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:message "Every ScenarioObject must have a name."@en ] .

# VehicleCategory enumeration. [OSC-OWL] rdfs:Datatype VehicleCategory, owl:oneOf.
openscenario:VehicleShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:Vehicle ;
    sh:property [ sh:path openscenario:name ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:vehicleCategory ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ${ttlList(enums.VehicleCategory)} ;
        sh:message "vehicleCategory must be a VehicleCategory enum member."@en ] ;
    sh:property [ sh:path openscenario:performance ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:boundingBox ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:axles ; sh:maxCount 1 ] .

# maxSpeed/maxAcceleration/maxDeceleration >= 0. [OSC-RCR] PerformanceRangeCheckerRule.
openscenario:PerformanceShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:Performance ;
    sh:property [ sh:path openscenario:maxSpeed ; sh:minCount 1 ; sh:maxCount 1 ; sh:minInclusive 0 ;
        sh:message "Performance.maxSpeed must be >= 0."@en ] ;
    sh:property [ sh:path openscenario:maxAcceleration ; sh:minCount 1 ; sh:maxCount 1 ; sh:minInclusive 0 ;
        sh:message "Performance.maxAcceleration must be >= 0."@en ] ;
    sh:property [ sh:path openscenario:maxDeceleration ; sh:minCount 1 ; sh:maxCount 1 ; sh:minInclusive 0 ;
        sh:message "Performance.maxDeceleration must be >= 0."@en ] .

# width/length/height >= 0. [OSC-RCR] DimensionsRangeCheckerRule.
openscenario:DimensionsShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:Dimensions ;
    sh:property [ sh:path openscenario:width ; sh:minCount 1 ; sh:minInclusive 0 ] ;
    sh:property [ sh:path openscenario:length ; sh:minCount 1 ; sh:minInclusive 0 ] ;
    sh:property [ sh:path openscenario:height ; sh:minCount 1 ; sh:minInclusive 0 ] .

# maxSteering in [0, PI]; wheelDiameter > 0; trackWidth >= 0. [OSC-RCR] AxleRangeCheckerRule.
# Targets the role-elements FrontAxle/RearAxle (both complexType Axle) explicitly.
openscenario:AxleShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:Axle, openscenario:FrontAxle, openscenario:RearAxle ;
    sh:property [ sh:path openscenario:maxSteering ; sh:minCount 1 ;
        sh:minInclusive 0 ; sh:maxInclusive 3.141592653589793 ;
        sh:message "Axle.maxSteering must be in [0, PI]."@en ] ;
    sh:property [ sh:path openscenario:wheelDiameter ; sh:minCount 1 ; sh:minExclusive 0 ;
        sh:message "Axle.wheelDiameter must be > 0."@en ] ;
    sh:property [ sh:path openscenario:trackWidth ; sh:minCount 1 ; sh:minInclusive 0 ;
        sh:message "Axle.trackWidth must be >= 0."@en ] .

# DynamicsShape / DynamicsDimension enumerations. [OSC-OWL] rdfs:Datatype, owl:oneOf.
openscenario:SpeedActionDynamicsShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:SpeedActionDynamics ;
    sh:property [ sh:path openscenario:dynamicsShape ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ${ttlList(enums.DynamicsShape)} ;
        sh:message "dynamicsShape must be a DynamicsShape enum member."@en ] ;
    sh:property [ sh:path openscenario:dynamicsDimension ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ${ttlList(enums.DynamicsDimension)} ;
        sh:message "dynamicsDimension must be a DynamicsDimension enum member."@en ] .

openscenario:LaneChangeActionDynamicsShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:LaneChangeActionDynamics ;
    sh:property [ sh:path openscenario:dynamicsShape ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ${ttlList(enums.DynamicsShape)} ] ;
    sh:property [ sh:path openscenario:dynamicsDimension ; sh:minCount 1 ; sh:maxCount 1 ;
        sh:in ${ttlList(enums.DynamicsDimension)} ] .

# s >= 0 (lane s-coordinate). [OSC-RCR] LanePositionRangeCheckerRule.
openscenario:LanePositionShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:LanePosition ;
    sh:property [ sh:path openscenario:roadId ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:laneId ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:s ; sh:minCount 1 ; sh:maxCount 1 ; sh:minInclusive 0 ;
        sh:message "LanePosition.s must be >= 0."@en ] .

openscenario:RelativeLanePositionShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:RelativeLanePosition ;
    sh:property [ sh:path openscenario:entityRef ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:dLane ; sh:minCount 1 ; sh:maxCount 1 ] ;
    sh:property [ sh:path openscenario:ds ; sh:minCount 1 ; sh:maxCount 1 ] .

openscenario:AbsoluteTargetSpeedShape a sh:NodeShape ;
    sh:closed false ;
    sh:targetClass openscenario:AbsoluteTargetSpeed ;
    sh:property [ sh:path openscenario:value ; sh:minCount 1 ; sh:maxCount 1 ] .
`
}

function main() {
  const content = readFileSync(PINNED_ONTOLOGY, 'utf-8')
  const quads = new N3Parser().parse(content)

  assertClassesExist(quads)
  const enums = Object.fromEntries(
    ENUM_DATATYPES.map((name) => [name, findEnumValues(quads, name)])
  )

  const rendered = render(enums)

  if (CHECK_ONLY) {
    const current = readFileSync(OUTPUT, 'utf-8')
    if (current !== rendered) {
      console.error(
        `✗ ${OUTPUT} is stale relative to the pinned ontology. Run without --check to regenerate.`
      )
      process.exit(1)
    }
    console.log(`✓ ${OUTPUT} matches the pinned ontology.`)
    return
  }

  writeFileSync(OUTPUT, rendered)
  console.log(`✓ wrote ${OUTPUT}`)
}

main()
