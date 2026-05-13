/**
 * Generate 50 OSI trace test assets in Turtle (TTL) format.
 * Covers: road types, lane types, format types, granularity, georeference.
 */
const fs = require('fs')
const path = require('path')

let seed = 137
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff
  return (seed >>> 0) / 0xffffffff
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)]
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min
}

const roadTypes = [
  'motorway',
  'rural',
  'town',
  'townArterial',
  'townCollector',
  'townExpressway',
  'pedestrian',
  'bicycle',
  'lowSpeed',
  'unknown',
]
const laneTypes = [
  'driving',
  'biking',
  'shoulder',
  'parking',
  'onRamp',
  'offRamp',
  'entry',
  'exit',
  'median',
  'curb',
  'border',
  'restricted',
]
const formatTypes = ['ASAM OSI GroundTruth', 'ASAM OSI SensorView', 'ASAM OSI SensorData']
const granularities = ['object list', 'detection list']
const compressions = ['uncompressed', 'zstd', 'lz4']
const dataSources = [
  'lidar',
  'camera',
  'radar',
  'simulation',
  'real-world recording',
  'synthetic generation',
]
const measSystems = [
  'dSpace AURELION',
  'IPG CarMaker',
  'CARLA Simulator',
  'Vehicle Sensor Rig',
  'Mobile Mapping System',
]

const cities = [
  ['Munich', 'DE', 'DE-BY', 'Bavaria'],
  ['Berlin', 'DE', 'DE-BE', 'Berlin'],
  ['Frankfurt', 'DE', 'DE-HE', 'Hesse'],
  ['Stuttgart', 'DE', 'DE-BW', 'Baden-Wuerttemberg'],
  ['Hamburg', 'DE', 'DE-HH', 'Hamburg'],
  ['San Francisco', 'US', 'US-CA', 'California'],
  ['Detroit', 'US', 'US-MI', 'Michigan'],
  ['Tokyo', 'JP', 'JP-13', 'Tokyo'],
  ['Paris', 'FR', 'FR-IDF', 'Ile-de-France'],
  ['London', 'GB', 'GB-LND', 'London'],
  ['Shanghai', 'CN', 'CN-SH', 'Shanghai'],
  ['Seoul', 'KR', 'KR-11', 'Seoul'],
  ['Amsterdam', 'NL', 'NL-NH', 'North Holland'],
  ['Gothenburg', 'SE', 'SE-AB', 'Stockholm'],
  ['Milan', 'IT', 'IT-25', 'Lombardy'],
]

const providers = ['osidata', 'tracecorp', 'sensorworks', 'simtrace', 'avrecord']

let t = ''
t += '@prefix ositrace: <https://w3id.org/ascs-ev/envited-x/ositrace/v6/> .\n'
t += '@prefix envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/> .\n'
t += '@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .\n'
t += '@prefix manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/> .\n'
t += '@prefix gx: <https://w3id.org/gaia-x/development#> .\n'
t += '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n'
t += '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n'

for (let i = 0; i < 50; i++) {
  const road = pick(roadTypes)
  const lane1 = pick(laneTypes)
  const lane2 = pick(laneTypes.filter((l) => l !== lane1))
  const fmt = pick(formatTypes)
  const gran = pick(granularities)
  const comp = pick(compressions)
  const [city, country, state, region] = pick(cities)
  const prov = pick(providers)
  const ds = pick(dataSources)
  const ms = pick(measSystems)
  const td = ['GB', 'JP', 'AU', 'SG'].includes(country) ? 'left-hand' : 'right-hand'
  const slug =
    city.toLowerCase().replace(/ /g, '-') + '-' + road + '-' + String(i + 1).padStart(3, '0')
  const nm = `${city} ${road.replace(/([A-Z])/g, ' $1').trim()} OSI Trace`
  const numFrames = randInt(100, 50000)
  const numChannels = randInt(1, 8)
  const osiVer = `3.${randInt(5, 7)}.0`
  const fmtShort = fmt.split(' ').pop()

  t += `# --- OSI Trace ${i + 1}: ${nm} ---\n\n`
  t += `<did:web:${prov}.io:OSITrace:${slug}> a ositrace:OSITrace ;\n`
  t += `  rdfs:label "${nm}"@en ;\n`
  t += `  ositrace:hasResourceDescription [\n`
  t += `    a envited-x:ResourceDescription ;\n`
  t += `    gx:name "${nm}" ;\n`
  t += `    gx:description "${fmtShort} trace of ${road} road in ${city}, ${region}" ;\n`
  t += `    gx:version "${randInt(1, 3)}.${randInt(0, 9)}.0" ;\n`
  t += `    gx:license "${pick(['CC-BY-4.0', 'CC-BY-NC-4.0', 'proprietary', 'MIT'])}" ;\n`
  t += `    gx:containsPII false\n`
  t += `  ] ;\n`
  t += `  ositrace:hasDomainSpecification [\n`
  t += `    a ositrace:DomainSpecification ;\n`
  t += `    ositrace:hasFormat [\n`
  t += `      a ositrace:Format ;\n`
  t += `      ositrace:formatType "${fmt}" ;\n`
  t += `      ositrace:version "${osiVer}" ;\n`
  t += `      ositrace:fileFormat "MCAP" ;\n`
  t += `      ositrace:compression "${comp}" ;\n`
  t += `      ositrace:osiTraceFormatVersion "1.0.0"\n`
  t += `    ] ;\n`
  t += `    ositrace:hasContent [\n`
  t += `      a ositrace:Content ;\n`
  t += `      ositrace:roadTypes "${road}" ;\n`
  t += `      ositrace:laneTypes "${lane1}" , "${lane2}" ;\n`
  t += `      ositrace:levelOfDetail "${pick(['car', 'bus', 'motorbike', 'bike', 'building'])}" ;\n`
  t += `      ositrace:trafficDirection "${td}" ;\n`
  t += `      ositrace:granularity "${gran}"\n`
  t += `    ] ;\n`
  t += `    ositrace:hasQuantity [\n`
  t += `      a ositrace:Quantity ;\n`
  t += `      ositrace:numberFrames "${numFrames}"^^xsd:integer ;\n`
  t += `      ositrace:numberOfChannels "${numChannels}"^^xsd:integer\n`
  t += `    ] ;\n`
  t += `    ositrace:hasQuality [\n`
  t += `      a ositrace:Quality ;\n`
  t += `      ositrace:precision "${pick([0.01, 0.02, 0.05, 0.1])}"^^xsd:float\n`
  t += `    ] ;\n`
  t += `    ositrace:hasDataSource [\n`
  t += `      a ositrace:DataSource ;\n`
  t += `      ositrace:usedDataSources "${ds}" ;\n`
  t += `      ositrace:measurementSystem "${ms}"\n`
  t += `    ] ;\n`
  t += `    ositrace:hasGeoreference [\n`
  t += `      a georeference:Georeference ;\n`
  t += `      georeference:hasProjectLocation [\n`
  t += `        a georeference:ProjectLocation ;\n`
  t += `        georeference:country "${country}" ;\n`
  t += `        georeference:state "${state}" ;\n`
  t += `        georeference:region "${region}" ;\n`
  t += `        georeference:city "${city}"\n`
  t += `      ]\n`
  t += `    ]\n`
  t += `  ] ;\n`
  t += `  ositrace:hasManifest [\n`
  t += `    a manifest:Manifest\n`
  t += `  ] .\n\n`
}

const outPath = path.join(__dirname, '..', 'packages', 'search', 'data', 'sample-ositrace.ttl')
fs.writeFileSync(outPath, t, 'utf-8')
console.log(`Generated 50 OSI trace assets -> ${outPath}`)
console.log(`File size: ${(t.length / 1024).toFixed(1)} KB`)
