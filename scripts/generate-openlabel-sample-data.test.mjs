/**
 * Tests for the OpenLABEL V1-0-0 sample-data generator.
 *
 * The committed sample files are owned by `generate-openlabel-sample-data.mjs`
 * for every `openlabel:*` node: this suite pins that they are reproducible,
 * that the rewrite is idempotent and local, and that the nodes follow the v1
 * value rules and the category-pure embedding of OMB's valid instances.
 * Conformance to the SHACL shapes themselves is asserted by
 * `packages/search/src/__tests__/openlabel-sample-conformance.test.ts`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  applyAttributes,
  ASSET_FILES,
  buildTagDocument,
  computeOutputs,
  patchDocument,
  splitOdd,
  TAG_FILE,
} from './generate-openlabel-sample-data.mjs'
import { ODD_CATEGORY, SITUATIONS } from './openlabel-situations.mjs'

const dataDirectory = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'packages',
  'search',
  'data'
)
const readDocument = (fileName) => JSON.parse(readFileSync(join(dataDirectory, fileName), 'utf8'))
const asArray = (value) => (Array.isArray(value) ? value : [value])
const typesOf = (node) => asArray(node['@type'] ?? []).map(String)

/** Values of `<prefix>:<name>` across an asset's non-OpenLABEL content nodes. */
function nativeContentValues(asset, name) {
  const specKey = Object.keys(asset).find((key) => key.endsWith(':hasDomainSpecification'))
  const spec = asset[specKey]
  const content = asArray(spec[Object.keys(spec).find((key) => key.endsWith(':hasContent'))])
  return content
    .filter((node) => !typesOf(node).some((type) => type.startsWith('openlabel:')))
    .flatMap((node) =>
      Object.entries(node)
        .filter(([key]) => key.endsWith(`:${name}`))
        .flatMap(([, value]) => asArray(value))
    )
}

function embeddedOpenLabelNodes(asset) {
  const specKey = Object.keys(asset).find((key) => key.endsWith(':hasDomainSpecification'))
  const spec = asset[specKey]
  const content = asArray(spec[Object.keys(spec).find((key) => key.endsWith(':hasContent'))])
  return content.filter((node) => typesOf(node).some((type) => type.startsWith('openlabel:')))
}

test('the committed sample files are exactly what the generator produces', () => {
  for (const { fileName, text } of computeOutputs()) {
    assert.equal(
      readFileSync(join(dataDirectory, fileName), 'utf8'),
      text,
      `${fileName} is out of date — run: node scripts/generate-openlabel-sample-data.mjs`
    )
  }
})

test('rewriting is idempotent', () => {
  for (const fileName of ASSET_FILES) {
    const once = patchDocument(readDocument(fileName))
    assert.deepEqual(patchDocument(once), once, fileName)
  }
})

test('rewriting never touches anything but OpenLABEL nodes', () => {
  const strip = (document) => {
    const copy = structuredClone(document)
    for (const asset of copy['@graph']) {
      const specKey = Object.keys(asset).find((key) => key.endsWith(':hasDomainSpecification'))
      const spec = specKey && asset[specKey]
      const contentKey = spec && Object.keys(spec).find((key) => key.endsWith(':hasContent'))
      if (contentKey) {
        spec[contentKey] = asArray(spec[contentKey]).filter(
          (node) => !typesOf(node).some((type) => type.startsWith('openlabel:'))
        )
      }
    }
    delete copy['@context'].openlabel
    delete copy['@context'].schema
    return copy
  }
  for (const fileName of ASSET_FILES) {
    const document = readDocument(fileName)
    assert.deepEqual(strip(patchDocument(document)), strip(document), fileName)
  }
})

test('every situation is unique, named and describes a scenery', () => {
  const ids = SITUATIONS.map((situation) => situation.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.ok(SITUATIONS.length >= 30)
  for (const situation of SITUATIONS) {
    assert.match(situation.id, /^[a-z0-9]+(-[a-z0-9]+)*$/)
    assert.ok(situation.title && situation.summary, situation.id)
    assert.ok(situation.odd?.DrivableAreaType, `${situation.id} has no DrivableAreaType`)
  }
  const groups = new Set(SITUATIONS.map((situation) => situation.group))
  for (const group of [
    'nominal',
    'braking',
    'cut-in',
    'obstacle',
    'perception',
    'odd-boundary',
    'emergency',
    'traffic-rules',
    'contrast',
  ]) {
    assert.ok(groups.has(group), `missing situation group ${group}`)
  }
  assert.ok(SITUATIONS.some((situation) => situation.road === 'other'))
})

test('every ODD attribute belongs to exactly one category', () => {
  const all = Object.values(ODD_CATEGORY).flat()
  assert.equal(new Set(all).size, all.length)
  for (const situation of SITUATIONS) {
    assert.doesNotThrow(() => splitOdd(situation.odd, situation.id))
  }
})

test('standalone tags follow Tag → AdminTag / Odd / Behaviour / RoadUser', () => {
  const { '@graph': tags } = buildTagDocument()
  assert.equal(tags.length, SITUATIONS.length)
  for (const tag of tags) {
    assert.equal(tag['@type'], 'openlabel:Tag')
    assert.match(tag['@id'], /^did:web:openlabel\.example:Tag:/)
    assert.equal(tag['openlabel:AdminTag']['@type'], 'openlabel:AdminTag')
    assert.equal(tag['openlabel:Odd']['@type'], 'openlabel:Odd')
  }
})

test('every HD map restates its own road type, lane types and travel direction', () => {
  // Independent restatement of the native → v1 correspondence.
  const MOTORWAY = new Set([
    'openlabel:RoadTypeMotorway',
    'openlabel:MotorwayManaged',
    'openlabel:MotorwayUnmanaged',
  ])
  const LANE_TYPE = {
    driving: 'openlabel:LaneTypeTraffic',
    biking: 'openlabel:LaneTypeCycle',
    bus: 'openlabel:LaneTypeBus',
    tram: 'openlabel:LaneTypeTram',
  }
  const DIRECTION = {
    'right-hand': 'openlabel:TravelDirectionRight',
    'left-hand': 'openlabel:TravelDirectionLeft',
  }
  const ids = (value) => asArray(value ?? []).map((ref) => ref['@id'])
  const maps = ['sample-hdmap.jsonld', 'sample-scenarios.jsonld']
    .flatMap((fileName) => readDocument(fileName)['@graph'])
    .filter((asset) => asset['@type'] === 'hdmap:HdMap')
  assert.ok(maps.length > 0)
  for (const map of maps) {
    const where = map['@id']
    const [scenery] = embeddedOpenLabelNodes(map)
    assert.ok(scenery, `${where}: no OpenLABEL scenery`)
    const native = (name) => nativeContentValues(map, name)
    if (native('roadTypes').some((v) => v === 'motorway' || v === 'highway')) {
      assert.ok(
        ids(scenery['openlabel:DrivableAreaType']).some((id) => MOTORWAY.has(id)),
        where
      )
    }
    const laneTypes = ids(scenery['openlabel:LaneSpecificationType'])
    for (const laneType of native('laneTypes')) {
      if (LANE_TYPE[laneType]) assert.ok(laneTypes.includes(LANE_TYPE[laneType]), where)
    }
    assert.deepEqual(
      ids(scenery['openlabel:LaneSpecificationTravelDirection']),
      native('trafficDirection').map((v) => DIRECTION[v]),
      where
    )
  }
})

test('files embed OpenLABEL only where the domain shapes allow it', () => {
  const hdmap = readDocument('sample-hdmap.jsonld')['@graph']
  for (const asset of hdmap) {
    const nodes = embeddedOpenLabelNodes(asset)
    assert.equal(nodes.length, 1, asset['@id'])
    assert.deepEqual(typesOf(nodes[0]), ['openlabel:OddScenery'])
    for (const key of Object.keys(nodes[0]).filter((k) => /^openlabel:[A-Z]/.test(k))) {
      assert.ok(
        ODD_CATEGORY.OddScenery.includes(key.slice('openlabel:'.length)),
        `${asset['@id']} ${key}`
      )
    }
  }
  const scenarios = readDocument('sample-scenarios.jsonld')['@graph'].filter(
    (asset) => asset['@type'] === 'scenario:Scenario'
  )
  const allowed = new Set([
    'openlabel:OddEnvironment',
    'openlabel:OddDynamicElements',
    'openlabel:Behaviour',
    'openlabel:RoadUser',
  ])
  for (const asset of scenarios) {
    for (const node of embeddedOpenLabelNodes(asset)) {
      assert.ok(
        typesOf(node).every((type) => allowed.has(type)),
        `${asset['@id']} ${typesOf(node)}`
      )
      assert.equal(typesOf(node).length, 1, 'category-pure: one type per node')
    }
  }
  // shapes of these domains allow exactly one hasContent item and name no OpenLABEL alternative
  for (const fileName of [
    'sample-ositrace.jsonld',
    'sample-environment-models.jsonld',
    'sample-surface-models.jsonld',
  ]) {
    assert.ok(!JSON.stringify(readDocument(fileName)).includes('openlabel:'), fileName)
  }
  assert.ok(TAG_FILE.endsWith('openlabel.jsonld'))
})

test('values use the datatypes of the v1 shapes', () => {
  const node = {}
  applyAttributes(
    node,
    {
      WeatherRain: 12.5,
      TrafficVolume: 1800,
      SubjectVehicleSpeed: [60, 120],
      LaneSpecificationMarking: false,
      DrivableAreaType: ['MotorwayManaged', 'RoadTypeSlip'],
    },
    'case'
  )
  assert.equal(node['openlabel:WeatherRain'], true)
  assert.deepEqual(node['openlabel:weatherRainValue'], { '@value': '12.5', '@type': 'xsd:decimal' })
  assert.deepEqual(node['openlabel:trafficVolumeValue'], {
    '@value': '1800',
    '@type': 'xsd:integer',
  })
  assert.deepEqual(node['openlabel:subjectVehicleSpeedValue'], {
    '@type': 'schema:QuantitativeValue',
    'schema:minValue': { '@value': '60.0', '@type': 'xsd:decimal' },
    'schema:maxValue': { '@value': '120.0', '@type': 'xsd:decimal' },
  })
  assert.equal(node['openlabel:LaneSpecificationMarking'], false)
  assert.deepEqual(node['openlabel:DrivableAreaType'], [
    { '@id': 'openlabel:MotorwayManaged' },
    { '@id': 'openlabel:RoadTypeSlip' },
  ])
})

test('inputs the v1 shapes forbid are rejected at generation time', () => {
  // a value property without a `<flag>Value` in the shapes
  assert.throws(() => applyAttributes({}, { DrivableAreaType: 3 }, 'x'), /no drivableAreaTypeValue/)
  // v1 offers a range only where the shape is `sh:or ( scalar QuantitativeValue )`
  assert.throws(() => applyAttributes({}, { WeatherRain: [1, 2] }, 'x'), /allows no range/)
  // sh:datatype xsd:integer: a fractional number would not conform
  assert.throws(() => applyAttributes({}, { TrafficVolume: 1.5 }, 'x'), /integer expected/)
  // QuantitativeValueShape: minValue <= maxValue
  assert.throws(
    () => applyAttributes({}, { MotionDrive: [9, 3] }, 'x'),
    /minValue must be <= maxValue/
  )
  // unknown ODD attribute
  assert.throws(() => splitOdd({ NotAnAttribute: true }, 'x'), /unknown ODD attribute/)
})
