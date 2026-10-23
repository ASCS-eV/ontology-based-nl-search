/**
 * OpenLABEL V1-0-0 sample content.
 *
 * Owns every `openlabel:*` node in the sample data and rewrites ONLY those
 * nodes, leaving the rest of the sample files untouched (the rest is committed
 * data with no generator):
 *
 *   - `sample-openlabel.jsonld` — standalone `openlabel:Tag` documents, one
 *     per situation in `openlabel-situations.mjs` (Tag → AdminTag / Odd /
 *     Behaviour / RoadUser, as in OMB's `openlabel_instance.json`).
 *   - `sample-hdmap.jsonld` — every HD map gets ONE `openlabel:OddScenery`
 *     content node holding scenery attributes only.
 *   - `sample-scenarios.jsonld` — every scenario gets separate
 *     `OddEnvironment`, `OddDynamicElements`, `Behaviour` and `RoadUser`
 *     content nodes (the scenery lives in the referenced HD map), drawn from
 *     the motorway situations when every HD map it references is
 *     motorway-like and from the contrast situations when one is not, so a
 *     scenario never carries a situation its maps contradict.
 *   - ositrace / environment-model / surface-model — NO OpenLABEL nodes: their
 *     shapes allow exactly one `hasContent` item (`sh:maxCount 1`) and name no
 *     OpenLABEL alternative.
 *
 * The node shapes follow OMB's own valid instances
 * (`tests/data/scenario/valid/scenario_instance.json`): category-pure ODD
 * nodes, `schema:QuantitativeValue` ranges, datatypes exactly as the v1 shapes
 * demand. The result is validated against the v1 SHACL by
 * `packages/search/src/__tests__/openlabel-sample-conformance.test.ts` and, in
 * OMB, with `onto-validate`.
 *
 * Usage:  node scripts/generate-openlabel-sample-data.mjs [--check]
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL] §4.1.2 sh:datatype, §4.6.3 sh:or
 * @see https://www.w3.org/TR/json-ld11/ — [JSON-LD] typed values, `@id` references
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

import { ODD_CATEGORY, SITUATIONS, VALUE_KIND } from './openlabel-situations.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const dataDirectory = join(__dirname, '..', 'packages', 'search', 'data')

export const OPENLABEL_NAMESPACE = 'https://openlabel.asam.net/V1-0-0/ontologies/'
const TAG_ID_PREFIX = 'did:web:openlabel.example:Tag:'

const BEHAVIOUR_ATTRIBUTES = new Set([
  'BehaviourCommunication',
  'MotionAccelerate',
  'MotionAway',
  'MotionCross',
  'MotionCutIn',
  'MotionCutOut',
  'MotionDecelerate',
  'MotionDrive',
  'MotionLaneChangeLeft',
  'MotionLaneChangeRight',
  'MotionOvertake',
  'MotionReverse',
  'MotionRun',
  'MotionSlide',
  'MotionStop',
  'MotionTowards',
  'MotionTurn',
  'MotionTurnLeft',
  'MotionTurnRight',
  'MotionUTurn',
  'MotionWalk',
])
const ROAD_USER_ATTRIBUTES = new Set(['RoadUserAnimal', 'RoadUserHuman', 'RoadUserVehicle'])

const ODD_ATTRIBUTE_CATEGORY = new Map(
  Object.entries(ODD_CATEGORY).flatMap(([category, names]) => names.map((name) => [name, category]))
)

const lowerFirst = (value) => value.charAt(0).toLowerCase() + value.slice(1)
const decimal = (n) => ({
  '@value': Number.isInteger(n) ? n.toFixed(1) : String(n),
  '@type': 'xsd:decimal',
})
const integer = (n) => ({ '@value': String(n), '@type': 'xsd:integer' })
const enumRef = (value) => ({ '@id': `openlabel:${value}` })
const isRange = (spec) =>
  Array.isArray(spec) && spec.length === 2 && spec.every((v) => typeof v === 'number')

function valueNode(kind, spec, where) {
  if (isRange(spec)) {
    if (!kind.endsWith('OrRange')) throw new Error(`${where}: v1 allows no range here`)
    const [min, max] = spec
    if (min > max) throw new Error(`${where}: minValue must be <= maxValue`)
    return {
      '@type': 'schema:QuantitativeValue',
      'schema:minValue': decimal(min),
      'schema:maxValue': decimal(max),
    }
  }
  if (kind.startsWith('integer')) {
    if (!Number.isInteger(spec)) throw new Error(`${where}: integer expected`)
    return integer(spec)
  }
  return decimal(spec)
}

/** Write situation attributes onto a JSON-LD node using the v1 value rules. */
export function applyAttributes(target, attributes, where) {
  for (const [name, spec] of Object.entries(attributes)) {
    const key = `openlabel:${name}`
    if (typeof spec === 'boolean') {
      target[key] = spec
    } else if (typeof spec === 'number' || isRange(spec)) {
      const valueName = `${lowerFirst(name)}Value`
      const kind = VALUE_KIND[valueName]
      if (!kind) throw new Error(`${where}: ${name} has no ${valueName} in the v1 shapes`)
      target[key] = true
      target[`openlabel:${valueName}`] = valueNode(kind, spec, `${where}.${valueName}`)
    } else {
      target[key] = Array.isArray(spec) ? spec.map(enumRef) : enumRef(spec)
    }
  }
}

export function splitOdd(odd = {}, where) {
  const byCategory = { OddScenery: {}, OddEnvironment: {}, OddDynamicElements: {} }
  for (const [name, spec] of Object.entries(odd)) {
    const category = ODD_ATTRIBUTE_CATEGORY.get(name)
    if (!category) throw new Error(`${where}: unknown ODD attribute ${name}`)
    byCategory[category][name] = spec
  }
  return byCategory
}

function checkNames(attributes = {}, allowed, where) {
  for (const name of Object.keys(attributes)) {
    if (!allowed.has(name)) throw new Error(`${where}: unknown attribute ${name}`)
  }
}

function typedNode(type, attributes, where) {
  const node = { '@type': `openlabel:${type}` }
  applyAttributes(node, attributes, where)
  return node
}

const isEmpty = (attributes) => !attributes || Object.keys(attributes).length === 0

/** Category-pure content nodes of one situation, keyed by node type. */
export function contentNodes(situation) {
  const where = situation.id
  checkNames(situation.behaviour, BEHAVIOUR_ATTRIBUTES, `${where}.behaviour`)
  checkNames(situation.roadUser, ROAD_USER_ATTRIBUTES, `${where}.roadUser`)
  const odd = splitOdd(situation.odd, `${where}.odd`)
  const nodes = {}
  for (const [category, attributes] of Object.entries(odd)) {
    if (!isEmpty(attributes))
      nodes[category] = typedNode(category, attributes, `${where}.${category}`)
  }
  if (!isEmpty(situation.behaviour)) {
    nodes.Behaviour = typedNode('Behaviour', situation.behaviour, `${where}.behaviour`)
  }
  if (!isEmpty(situation.roadUser)) {
    nodes.RoadUser = typedNode('RoadUser', situation.roadUser, `${where}.roadUser`)
  }
  return nodes
}

const uuidFor = (index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`

function buildTag(situation, index) {
  const where = situation.id
  checkNames(situation.behaviour, BEHAVIOUR_ATTRIBUTES, `${where}.behaviour`)
  checkNames(situation.roadUser, ROAD_USER_ATTRIBUTES, `${where}.roadUser`)
  splitOdd(situation.odd, `${where}.odd`)
  const tag = {
    '@id': `${TAG_ID_PREFIX}${situation.id}`,
    '@type': 'openlabel:Tag',
    'rdfs:label': { '@value': situation.title, '@language': 'en' },
    'openlabel:AdminTag': {
      '@type': 'openlabel:AdminTag',
      'openlabel:scenarioName': situation.title,
      'openlabel:scenarioDescription': situation.summary,
      'openlabel:scenarioUniqueReference': uuidFor(index),
      'openlabel:scenarioVersion': '1.0.0',
    },
  }
  // Standalone tags use the generic v1 classes; the ODD category classes are
  // for nodes embedded in an asset (OMB `openlabel_instance.json`).
  const parts = [
    ['openlabel:Odd', 'Odd', situation.odd],
    ['openlabel:Behaviour', 'Behaviour', situation.behaviour],
    ['openlabel:RoadUser', 'RoadUser', situation.roadUser],
  ]
  for (const [key, type, attributes] of parts) {
    if (!isEmpty(attributes)) tag[key] = typedNode(type, attributes, `${where}.${type}`)
  }
  return tag
}

/** The standalone-tag document (`sample-openlabel.jsonld`). */
export function buildTagDocument() {
  return {
    '@context': {
      openlabel: OPENLABEL_NAMESPACE,
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      schema: 'https://schema.org/',
    },
    '@graph': SITUATIONS.map(buildTag),
  }
}

// ── patching the asset documents ───────────────────────────────────────────

const asArray = (value) => (Array.isArray(value) ? value : [value])
const typesOf = (node) => asArray(node['@type'] ?? [])
const isOpenLabelNode = (node) =>
  node !== null &&
  typeof node === 'object' &&
  typesOf(node).some((type) => String(type).startsWith('openlabel:'))

/** The `<domain>:hasContent` holder of an asset, if it has one. */
function contentHolder(asset) {
  const specKey = Object.keys(asset).find((key) => key.endsWith(':hasDomainSpecification'))
  const spec = specKey ? asset[specKey] : undefined
  if (!spec || typeof spec !== 'object') return undefined
  const key = Object.keys(spec).find((candidate) => candidate.endsWith(':hasContent'))
  return key ? { owner: spec, key } : undefined
}

function coprimeStride(length) {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b))
  return [7, 11, 13, 17, 19, 23].find((stride) => gcd(stride, length) === 1) ?? 1
}

const MOTORWAY_SITUATIONS = SITUATIONS.filter((s) => s.road === 'motorway')
const OTHER_SITUATIONS = SITUATIONS.filter((s) => s.road === 'other')

function pick(candidates, counter) {
  return candidates[(counter * coprimeStride(candidates.length) + 1) % candidates.length]
}

/** Values of the field `<prefix>:<name>` across the asset's native content nodes. */
function nativeValues(contentNodesOfAsset, name) {
  return contentNodesOfAsset
    .filter((node) => !isOpenLabelNode(node))
    .flatMap((node) =>
      Object.entries(node)
        .filter(([key]) => key.endsWith(`:${name}`))
        .flatMap(([, value]) => asArray(value))
    )
}

const MOTORWAY_ROAD_TYPES = new Set(['motorway', 'highway'])

/** `roadTypes` of the asset's native content node (motorway-like or not). */
function isMotorwayLike(contentNodesOfAsset) {
  return nativeValues(contentNodesOfAsset, 'roadTypes').some((v) => MOTORWAY_ROAD_TYPES.has(v))
}

/** Whether each HD map document of the file is motorway-like, by `@id`. */
function mapKindsById(document) {
  const kinds = new Map()
  for (const node of document['@graph']) {
    if (typesOf(node)[0] !== 'hdmap:HdMap' || !node['@id']) continue
    const holder = contentHolder(node)
    const content = holder
      ? asArray(holder.owner[holder.key]).filter((n) => !isOpenLabelNode(n))
      : []
    kinds.set(node['@id'], isMotorwayLike(content))
  }
  return kinds
}

/** Every member of `ids` the node mentions anywhere, as an `@id` or a string. */
function mentionedIds(node, ids) {
  if (typeof node === 'string') return ids.has(node) ? [node] : []
  if (Array.isArray(node)) return node.flatMap((item) => mentionedIds(item, ids))
  if (node && typeof node === 'object') {
    return Object.values(node).flatMap((value) => mentionedIds(value, ids))
  }
  return []
}

/**
 * The situations a scenario draws from: `motorway` when every HD map of the
 * same file it references is motorway-like, `other` when one is not, `any`
 * when it references no map of the file. A scenario references a map by its
 * `@id`, wherever its manifest holds it.
 */
export function situationFamily(scenario, mapKinds) {
  const kinds = [...new Set(mentionedIds(scenario, new Set(mapKinds.keys())))].map((id) =>
    mapKinds.get(id)
  )
  if (kinds.length === 0) return 'any'
  return kinds.every(Boolean) ? 'motorway' : 'other'
}

/** Native HD-map lane types with a v1 `LaneSpecificationType` counterpart. */
const LANE_TYPE = new Map([
  ['driving', 'LaneTypeTraffic'],
  ['biking', 'LaneTypeCycle'],
  ['bus', 'LaneTypeBus'],
  ['tram', 'LaneTypeTram'],
])

/** Native traffic direction → v1 `LaneSpecificationTravelDirection`. */
const TRAVEL_DIRECTION = new Map([
  ['right-hand', 'TravelDirectionRight'],
  ['left-hand', 'TravelDirectionLeft'],
])

/**
 * The scenery an HD map's own content already states, in v1 terms: road
 * type, lane types and travel direction. A map's OpenLABEL annotation then
 * never contradicts the map, and every map is annotated with what it has.
 */
export function sceneryFromNativeContent(contentNodesOfAsset) {
  const scenery = {}
  if (isMotorwayLike(contentNodesOfAsset)) scenery.DrivableAreaType = 'RoadTypeMotorway'
  const laneTypes = [
    ...new Set(nativeValues(contentNodesOfAsset, 'laneTypes').map((v) => LANE_TYPE.get(v))),
  ].filter(Boolean)
  if (laneTypes.length > 0) {
    scenery.LaneSpecificationType = laneTypes.length === 1 ? laneTypes[0] : laneTypes
  }
  const direction = TRAVEL_DIRECTION.get(nativeValues(contentNodesOfAsset, 'trafficDirection')[0])
  if (direction) scenery.LaneSpecificationTravelDirection = direction
  return scenery
}

function additionsFor(asset, counters, mapKinds) {
  const type = typesOf(asset)[0]
  const holder = contentHolder(asset)
  if (!holder) return []
  const existing = asArray(holder.owner[holder.key]).filter((node) => !isOpenLabelNode(node))

  if (type === 'hdmap:HdMap') {
    const motorway = isMotorwayLike(existing)
    const counterKey = motorway ? 'hdmapMotorway' : 'hdmapOther'
    const situation = pick(
      motorway ? MOTORWAY_SITUATIONS : OTHER_SITUATIONS,
      counters[counterKey]++
    )
    // The situation's own scenery wins where both say something (it may be
    // more specific, e.g. a managed motorway).
    const scenery = {
      ...sceneryFromNativeContent(existing),
      ...splitOdd(situation.odd, situation.id).OddScenery,
    }
    return isEmpty(scenery) ? [] : [typedNode('OddScenery', scenery, `${situation.id}.OddScenery`)]
  }
  if (type === 'scenario:Scenario') {
    const family = situationFamily(asset, mapKinds)
    const candidates = { motorway: MOTORWAY_SITUATIONS, other: OTHER_SITUATIONS, any: SITUATIONS }
    const situation = pick(candidates[family], counters[`scenario-${family}`]++)
    const nodes = contentNodes(situation)
    return ['OddEnvironment', 'OddDynamicElements', 'Behaviour', 'RoadUser']
      .map((nodeType) => nodes[nodeType])
      .filter(Boolean)
  }
  return []
}

const usesOpenLabelPrefix = (document) => JSON.stringify(document['@graph']).includes('"openlabel:')

/**
 * Replace all OpenLABEL content nodes of an asset document. Pure: returns a
 * new document, never mutates `document`.
 */
export function patchDocument(document) {
  const out = structuredClone(document)
  const counters = {
    hdmapMotorway: 0,
    hdmapOther: 0,
    'scenario-motorway': 0,
    'scenario-other': 0,
    'scenario-any': 0,
  }
  const mapKinds = mapKindsById(out)
  for (const asset of out['@graph']) {
    const holder = contentHolder(asset)
    if (!holder) continue
    const kept = asArray(holder.owner[holder.key]).filter((node) => !isOpenLabelNode(node))
    const additions = additionsFor(asset, counters, mapKinds)
    holder.owner[holder.key] = [...kept, ...additions]
  }
  if (!usesOpenLabelPrefix(out)) delete out['@context'].openlabel
  else out['@context'].openlabel = OPENLABEL_NAMESPACE
  if (usesQuantitativeValue(out)) out['@context'].schema = 'https://schema.org/'
  return out
}

const usesQuantitativeValue = (document) =>
  JSON.stringify(document['@graph']).includes('"schema:QuantitativeValue"')

export const ASSET_FILES = [
  'sample-hdmap.jsonld',
  'sample-scenarios.jsonld',
  'sample-ositrace.jsonld',
  'sample-environment-models.jsonld',
  'sample-surface-models.jsonld',
]
export const TAG_FILE = 'sample-openlabel.jsonld'

const serialise = (document) => `${JSON.stringify(document, null, 2)}\n`

/** Every file this script owns, as `{ fileName, text }` computed from the committed data. */
export function computeOutputs(directory = dataDirectory) {
  const outputs = [{ fileName: TAG_FILE, text: serialise(buildTagDocument()) }]
  for (const fileName of ASSET_FILES) {
    const document = JSON.parse(readFileSync(join(directory, fileName), 'utf8'))
    outputs.push({ fileName, text: serialise(patchDocument(document)) })
  }
  return outputs
}

function main() {
  const check = process.argv.includes('--check')
  let drift = 0
  for (const { fileName, text } of computeOutputs()) {
    const path = join(dataDirectory, fileName)
    const current = existsSync(path) ? readFileSync(path, 'utf8') : ''
    if (current === text) continue
    drift++
    if (!check) writeFileSync(path, text, 'utf8')
    process.stdout.write(`${check ? 'would update' : 'updated'} ${fileName}\n`)
  }
  if (check && drift > 0) process.exitCode = 1
  if (drift === 0) process.stdout.write('OpenLABEL sample data is up to date\n')
}

const isMainModule =
  process.argv[1] && resolve(process.argv[1]).toLowerCase() === __filename.toLowerCase()
if (isMainModule) main()
