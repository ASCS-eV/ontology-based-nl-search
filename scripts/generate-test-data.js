/**
 * Generate 100 diverse HD map test assets in Turtle (TTL) format.
 * Covers: 27 countries, 14 road scenarios, 6 map formats, varied lane types, etc.
 */
const fs = require('fs')
const path = require('path')

// Deterministic pseudo-random
let seed = 42
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff
  return (seed >>> 0) / 0xffffffff
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min
}
function pick(arr) {
  return arr[Math.floor(rand() * arr.length)]
}
function randFloat(min, max) {
  return Math.round((rand() * (max - min) + min) * 10) / 10
}

const countries = [
  ['DE', 'DE-BY', 'Bavaria', ['Munich', 'Nuremberg', 'Augsburg', 'Regensburg']],
  ['DE', 'DE-NW', 'North Rhine-Westphalia', ['Cologne', 'Dusseldorf', 'Dortmund']],
  ['DE', 'DE-BW', 'Baden-Wuerttemberg', ['Stuttgart', 'Karlsruhe', 'Mannheim']],
  ['DE', 'DE-HE', 'Hesse', ['Frankfurt', 'Wiesbaden', 'Darmstadt']],
  ['DE', 'DE-NI', 'Lower Saxony', ['Hannover', 'Wolfsburg', 'Braunschweig']],
  ['DE', 'DE-BE', 'Berlin', ['Berlin']],
  ['DE', 'DE-HH', 'Hamburg', ['Hamburg']],
  ['US', 'US-CA', 'California', ['San Francisco', 'Los Angeles', 'San Jose']],
  ['US', 'US-MI', 'Michigan', ['Detroit', 'Ann Arbor']],
  ['US', 'US-AZ', 'Arizona', ['Phoenix', 'Chandler']],
  ['US', 'US-TX', 'Texas', ['Austin', 'Houston', 'Dallas']],
  ['CN', 'CN-SH', 'Shanghai', ['Shanghai']],
  ['CN', 'CN-BJ', 'Beijing', ['Beijing']],
  ['JP', 'JP-13', 'Tokyo', ['Tokyo', 'Shibuya']],
  ['JP', 'JP-23', 'Aichi', ['Nagoya', 'Toyota City']],
  ['KR', 'KR-11', 'Seoul', ['Seoul']],
  ['FR', 'FR-IDF', 'Ile-de-France', ['Paris']],
  ['GB', 'GB-LND', 'London', ['London']],
  ['NL', 'NL-NH', 'North Holland', ['Amsterdam']],
  ['SE', 'SE-AB', 'Stockholm', ['Stockholm', 'Gothenburg']],
  ['AT', 'AT-9', 'Vienna', ['Vienna']],
  ['CH', 'CH-ZH', 'Zurich', ['Zurich', 'Bern']],
  ['IT', 'IT-25', 'Lombardy', ['Milan']],
  ['ES', 'ES-MD', 'Madrid', ['Madrid', 'Barcelona']],
  ['AU', 'AU-VIC', 'Victoria', ['Melbourne']],
  ['SG', 'SG', 'Singapore', ['Singapore']],
  ['FI', 'FI-ES', 'Uusimaa', ['Helsinki']],
]

const scenarios = [
  { name: 'highway', road: 'motorway', desc: 'Highway stretch', sMin: 80, sMax: 250 },
  {
    name: 'urban-intersection',
    road: 'town',
    desc: 'Complex urban intersection',
    sMin: 20,
    sMax: 50,
  },
  { name: 'roundabout', road: 'town', desc: 'Multi-lane roundabout', sMin: 20, sMax: 50 },
  {
    name: 'parking-garage',
    road: 'custom',
    desc: 'Multi-level parking structure',
    sMin: 5,
    sMax: 30,
  },
  {
    name: 'highway-ramp',
    road: 'motorway_entry',
    desc: 'Highway on/off ramp',
    sMin: 40,
    sMax: 100,
  },
  { name: 'rural-road', road: 'rural', desc: 'Country road', sMin: 30, sMax: 100 },
  { name: 'tunnel', road: 'motorway', desc: 'Highway tunnel section', sMin: 60, sMax: 130 },
  { name: 'bridge', road: 'motorway', desc: 'Bridge crossing', sMin: 60, sMax: 130 },
  {
    name: 'construction-zone',
    road: 'town',
    desc: 'Road with construction zone',
    sMin: 20,
    sMax: 60,
  },
  { name: 'school-zone', road: 'town', desc: 'School zone with crossings', sMin: 10, sMax: 30 },
  { name: 'industrial', road: 'town', desc: 'Industrial area roads', sMin: 30, sMax: 60 },
  {
    name: 'residential',
    road: 'town',
    desc: 'Residential neighborhood streets',
    sMin: 20,
    sMax: 50,
  },
  { name: 'test-track', road: 'custom', desc: 'Proving ground test track', sMin: 0, sMax: 300 },
  { name: 'mixed-urban', road: 'town', desc: 'Mixed-use urban district', sMin: 20, sMax: 70 },
]

const formats = [
  ['ASAM OpenDRIVE', ['1.4', '1.5', '1.6', '1.7', '1.8']],
  ['Lanelet2', ['1.0', '1.1']],
  ['NDS.Live', ['2.0', '2.5']],
  ['HERE HD Live Map', ['1.0']],
  ['Shape', ['1.0']],
  ['Road5', ['2.0']],
]

const laneOpts = [
  ['driving'],
  ['driving', 'shoulder'],
  ['driving', 'biking'],
  ['driving', 'walking', 'biking'],
  ['driving', 'bus'],
  ['driving', 'parking'],
  ['driving', 'emergency'],
]

const lods = ['lane', 'pole', 'crosswalk', 'flat-marking', 'wall', 'curb']
const dataSrcs = [
  'lidar',
  'camera',
  'scanner',
  'aerial',
  'satellite',
  'procedural generation',
  'survey',
  'mobile mapping',
]
const measSys = [
  '3DMS system',
  'Mobile Mapping System',
  'RTK-GPS',
  'aerial scanner',
  'photogrammetry',
]
const licenses = [
  'CC-BY-4.0',
  'EPL-2.0',
  'CC-BY-NC-4.0',
  'MIT',
  'proprietary',
  'CC-BY-SA-4.0',
  'CC0-1.0',
]

let ttl = ''
ttl += '@prefix hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/> .\n'
ttl += '@prefix envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/> .\n'
ttl += '@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .\n'
ttl += '@prefix manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/> .\n'
ttl += '@prefix gx: <https://w3id.org/gaia-x/development#> .\n'
ttl += '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n'
ttl += '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n'

for (let i = 1; i <= 100; i++) {
  const sc = pick(scenarios)
  const [cc, state, region, cities] = pick(countries)
  const city = pick(cities)
  const [fmtType, fmtVersions] = pick(formats)
  const fmtVer = pick(fmtVersions)
  const lanes = pick(laneOpts)
  const td = ['GB', 'JP', 'AU', 'SG'].includes(cc) ? 'left-hand' : 'right-hand'
  const lod = pick(lods)
  const ds = pick(dataSrcs)
  const ms = pick(measSys)
  const lic = pick(licenses)
  const provider = 'provider' + randInt(1, 40)
  const length = randFloat(0.5, 120)
  const elev = randFloat(0, 500)
  const nInt = randInt(0, 20)
  const nLights = randInt(0, 15)
  const nSigns = randInt(10, 500)
  const nObj = randInt(50, 3000)
  const nOut = randInt(10, 500)
  const sMin = sc.sMin + randInt(0, 20)
  const sMax = sc.sMax + randInt(0, 50)
  const prec = pick([0.005, 0.01, 0.02, 0.05])
  const ver = randInt(1, 5) + '.' + randInt(0, 9) + '.' + randInt(0, 9)
  const slug =
    city.toLowerCase().replace(/ /g, '-') + '-' + sc.name + '-' + String(i).padStart(3, '0')
  const name =
    city +
    ' ' +
    sc.name.replace(/-/g, ' ').replace(/\b([a-z])/g, (m, c) => c.toUpperCase()) +
    ' HD Map'
  const desc =
    sc.desc + ' in ' + city + ', ' + region + '. ' + nInt + ' intersections, ' + nSigns + ' signs.'
  const lonMin = Math.round((rand() * 260 - 120) * 1000) / 1000
  const latMin = Math.round((rand() * 50 + 25) * 1000) / 1000

  ttl += `# --- Asset ${i}: ${name} ---\n\n`
  ttl += `<did:web:${provider}.net:HdMap:${slug}> a hdmap:HdMap ;\n`
  ttl += `  rdfs:label "${name}"@en ;\n`
  ttl += `  hdmap:hasResourceDescription [\n`
  ttl += `    a envited-x:ResourceDescription ;\n`
  ttl += `    gx:name "${name}" ;\n`
  ttl += `    gx:description "${desc}" ;\n`
  ttl += `    gx:version "${ver}" ;\n`
  ttl += `    gx:license "${lic}" ;\n`
  ttl += `    gx:containsPII false\n`
  ttl += `  ] ;\n`
  ttl += `  hdmap:hasDomainSpecification [\n`
  ttl += `    a hdmap:DomainSpecification ;\n`
  ttl += `    hdmap:hasFormat [\n`
  ttl += `      a hdmap:Format ;\n`
  ttl += `      hdmap:formatType "${fmtType}" ;\n`
  ttl += `      hdmap:version "${fmtVer}"\n`
  ttl += `    ] ;\n`
  ttl += `    hdmap:hasContent [\n`
  ttl += `      a hdmap:Content ;\n`
  ttl += `      hdmap:roadTypes "${sc.road}" ;\n`
  ttl += `      hdmap:laneTypes ${lanes.map((l) => '"' + l + '"').join(' , ')} ;\n`
  ttl += `      hdmap:levelOfDetail "${lod}" ;\n`
  ttl += `      hdmap:trafficDirection "${td}"\n`
  ttl += `    ] ;\n`
  ttl += `    hdmap:hasQuantity [\n`
  ttl += `      a hdmap:Quantity ;\n`
  ttl += `      hdmap:length "${length}"^^xsd:float ;\n`
  ttl += `      hdmap:elevationRange "${elev}"^^xsd:float ;\n`
  ttl += `      hdmap:numberIntersections "${nInt}"^^xsd:integer ;\n`
  ttl += `      hdmap:numberTrafficLights "${nLights}"^^xsd:integer ;\n`
  ttl += `      hdmap:numberTrafficSigns "${nSigns}"^^xsd:integer ;\n`
  ttl += `      hdmap:numberObjects "${nObj}"^^xsd:integer ;\n`
  ttl += `      hdmap:numberOutlines "${nOut}"^^xsd:integer ;\n`
  ttl += `      hdmap:rangeOfModeling "20.0"^^xsd:float ;\n`
  ttl += `      hdmap:speedLimit [\n`
  ttl += `        a hdmap:Range2D ;\n`
  ttl += `        hdmap:min "${sMin}.0"^^xsd:float ;\n`
  ttl += `        hdmap:max "${sMax}.0"^^xsd:float\n`
  ttl += `      ]\n`
  ttl += `    ] ;\n`
  ttl += `    hdmap:hasQuality [\n`
  ttl += `      a hdmap:Quality ;\n`
  ttl += `      hdmap:precision "${prec}"^^xsd:float\n`
  ttl += `    ] ;\n`
  ttl += `    hdmap:hasDataSource [\n`
  ttl += `      a hdmap:DataSource ;\n`
  ttl += `      hdmap:usedDataSources "${ds}" ;\n`
  ttl += `      hdmap:measurementSystem "${ms}"\n`
  ttl += `    ] ;\n`
  ttl += `    hdmap:hasGeoreference [\n`
  ttl += `      a georeference:Georeference ;\n`
  ttl += `      georeference:hasProjectLocation [\n`
  ttl += `        a georeference:ProjectLocation ;\n`
  ttl += `        georeference:country "${cc}" ;\n`
  ttl += `        georeference:state "${state}" ;\n`
  ttl += `        georeference:region "${region}" ;\n`
  ttl += `        georeference:city "${city}" ;\n`
  ttl += `        georeference:hasBoundingBox [\n`
  ttl += `          a georeference:BoundingBox ;\n`
  ttl += `          georeference:xMin "${lonMin}"^^xsd:float ;\n`
  ttl += `          georeference:yMin "${latMin}"^^xsd:float ;\n`
  ttl += `          georeference:xMax "${Math.round((lonMin + rand() * 0.2) * 1000) / 1000}"^^xsd:float ;\n`
  ttl += `          georeference:yMax "${Math.round((latMin + rand() * 0.15) * 1000) / 1000}"^^xsd:float\n`
  ttl += `        ]\n`
  ttl += `      ]\n`
  ttl += `    ]\n`
  ttl += `  ] .\n\n`
}

const outPath = path.join(__dirname, '..', 'src', 'lib', 'data', 'sample-assets.ttl')
fs.writeFileSync(outPath, ttl, 'utf-8')
console.log(`Generated 100 assets -> ${outPath}`)
console.log(`File size: ${(ttl.length / 1024).toFixed(1)} KB`)
console.log(`Lines: ${ttl.split('\n').length}`)
