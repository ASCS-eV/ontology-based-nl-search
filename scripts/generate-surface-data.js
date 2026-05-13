/**
 * Generate 20 surface model test assets in Turtle (TTL) format.
 * Covers: format types (OpenCRG, DLM), georeference, quality properties.
 */
const fs = require('fs')
const path = require('path')

let seed = 389
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
function randFloat(min, max) {
  return Math.round((rand() * (max - min) + min) * 100) / 100
}

const formatTypes = ['ASAM OpenCRG', 'DLM']
const contentTypes = [
  'road surface profile',
  'friction map',
  'elevation model',
  'roughness profile',
  'tire-road contact',
  'drainage model',
]

const cities = [
  ['Munich', 'DE', 'DE-BY', 'Bavaria'],
  ['Berlin', 'DE', 'DE-BE', 'Berlin'],
  ['Stuttgart', 'DE', 'DE-BW', 'Baden-Wuerttemberg'],
  ['Frankfurt', 'DE', 'DE-HE', 'Hesse'],
  ['San Francisco', 'US', 'US-CA', 'California'],
  ['Detroit', 'US', 'US-MI', 'Michigan'],
  ['Tokyo', 'JP', 'JP-13', 'Tokyo'],
  ['Paris', 'FR', 'FR-IDF', 'Ile-de-France'],
  ['London', 'GB', 'GB-LND', 'London'],
  ['Gothenburg', 'SE', 'SE-AB', 'Stockholm'],
]

const providers = ['surfacepro', 'roadsurf', 'crgdata', 'pavesim', 'surfmodel']

let t = ''
t += '@prefix surface-model: <https://w3id.org/ascs-ev/envited-x/surface-model/v6/> .\n'
t += '@prefix envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/> .\n'
t += '@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .\n'
t += '@prefix manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/> .\n'
t += '@prefix gx: <https://w3id.org/gaia-x/development#> .\n'
t += '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n'
t += '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n'

for (let i = 0; i < 20; i++) {
  const fmt = pick(formatTypes)
  const content = pick(contentTypes)
  const [city, country, state, region] = pick(cities)
  const prov = pick(providers)
  const slug = city.toLowerCase().replace(/ /g, '-') + '-surface-' + String(i + 1).padStart(3, '0')
  const nm = `${city} ${fmt} Surface Model`
  const length = randFloat(0.1, 50)
  const elev = randFloat(0, 200)
  const resLong = pick([0.001, 0.005, 0.01, 0.05])
  const resLat = pick([0.001, 0.005, 0.01, 0.05])
  const orient = randFloat(0, 360)

  t += `# --- Surface Model ${i + 1}: ${nm} ---\n\n`
  t += `<did:web:${prov}.io:SurfaceModel:${slug}> a surface-model:SurfaceModel ;\n`
  t += `  rdfs:label "${nm}"@en ;\n`
  t += `  surface-model:hasResourceDescription [\n`
  t += `    a envited-x:ResourceDescription ;\n`
  t += `    gx:name "${nm}" ;\n`
  t += `    gx:description "${content} for ${city}, ${region} using ${fmt} format" ;\n`
  t += `    gx:version "${randInt(1, 2)}.${randInt(0, 9)}.0" ;\n`
  t += `    gx:license "${pick(['CC-BY-4.0', 'CC-BY-NC-4.0', 'proprietary'])}" ;\n`
  t += `    gx:containsPII false\n`
  t += `  ] ;\n`
  t += `  surface-model:hasDomainSpecification [\n`
  t += `    a surface-model:DomainSpecification ;\n`
  t += `    surface-model:hasFormat [\n`
  t += `      a surface-model:Format ;\n`
  t += `      surface-model:formatType "${fmt}" ;\n`
  t += `      surface-model:version "${pick(['1.0', '1.1', '2.0'])}"\n`
  t += `    ] ;\n`
  t += `    surface-model:hasContent [\n`
  t += `      a surface-model:Content ;\n`
  t += `      surface-model:contentType "${content}"\n`
  t += `    ] ;\n`
  t += `    surface-model:hasQuantity [\n`
  t += `      a surface-model:Quantity ;\n`
  t += `      surface-model:length "${length}"^^xsd:float ;\n`
  t += `      surface-model:elevationRange "${elev}"^^xsd:float ;\n`
  t += `      surface-model:mapDataField ${pick([true, false])}\n`
  t += `    ] ;\n`
  t += `    surface-model:hasQuality [\n`
  t += `      a surface-model:Quality ;\n`
  t += `      surface-model:resolutionLongitudinal "${resLong}"^^xsd:float ;\n`
  t += `      surface-model:resolutionLateral "${resLat}"^^xsd:float ;\n`
  t += `      surface-model:orientation "${orient}"^^xsd:float ;\n`
  t += `      surface-model:platformExists ${pick([true, false])} ;\n`
  t += `      surface-model:rampExists ${pick([true, false])}\n`
  t += `    ] ;\n`
  t += `    surface-model:hasGeoreference [\n`
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
  t += `  surface-model:hasManifest [\n`
  t += `    a manifest:Manifest\n`
  t += `  ] .\n\n`
}

const outPath = path.join(
  __dirname,
  '..',
  'packages',
  'search',
  'data',
  'sample-surface-models.ttl'
)
fs.writeFileSync(outPath, t, 'utf-8')
console.log(`Generated 20 surface model assets -> ${outPath}`)
console.log(`File size: ${(t.length / 1024).toFixed(1)} KB`)
