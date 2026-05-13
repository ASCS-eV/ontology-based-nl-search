/**
 * Generate 30 environment model test assets in Turtle (TTL) format.
 * Covers: format types (FBX, glTF, etc.), detail levels, georeference.
 */
const fs = require('fs')
const path = require('path')

let seed = 271
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

const formatTypes = ['Autodesk FBX', 'glTF', 'OpenSceneGraph', 'Unreal Datasmith']
const detailLevels = ['High', 'Medium', 'Low']
const elements = [
  'buildings, roads, vegetation',
  'terrain, buildings, traffic signs',
  'roads, bridges, tunnels',
  'urban environment, street furniture',
  'highway, guardrails, barriers',
  'rural landscape, fields, trees',
  'parking structure, markings',
  'intersection, traffic lights, crosswalks',
]
const useCases = [
  'sensor simulation',
  'camera simulation',
  'lidar simulation',
  'visual validation',
  'scenario visualization',
  'digital twin',
  'SiL testing',
  'HiL testing',
]
const creationTools = [
  ['Blender', 'Blender Foundation', '3.6'],
  ['3ds Max', 'Autodesk', '2024'],
  ['Unreal Engine', 'Epic Games', '5.3'],
  ['Unity', 'Unity Technologies', '2023.2'],
  ['RoadRunner', 'MathWorks', '2023b'],
  ['CARLA Scene Builder', 'CARLA', '0.9.15'],
]

const cities = [
  ['Munich', 'DE', 'DE-BY', 'Bavaria'],
  ['Berlin', 'DE', 'DE-BE', 'Berlin'],
  ['Stuttgart', 'DE', 'DE-BW', 'Baden-Wuerttemberg'],
  ['San Francisco', 'US', 'US-CA', 'California'],
  ['Detroit', 'US', 'US-MI', 'Michigan'],
  ['Tokyo', 'JP', 'JP-13', 'Tokyo'],
  ['Paris', 'FR', 'FR-IDF', 'Ile-de-France'],
  ['London', 'GB', 'GB-LND', 'London'],
  ['Shanghai', 'CN', 'CN-SH', 'Shanghai'],
  ['Amsterdam', 'NL', 'NL-NH', 'North Holland'],
  ['Gothenburg', 'SE', 'SE-AB', 'Stockholm'],
  ['Milan', 'IT', 'IT-25', 'Lombardy'],
]

const providers = ['envmodels', '3dscene', 'simworld', 'digitwin', 'scenecraft']

let t = ''
t += '@prefix environment-model: <https://w3id.org/ascs-ev/envited-x/environment-model/v5/> .\n'
t += '@prefix envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/> .\n'
t += '@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .\n'
t += '@prefix manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/> .\n'
t += '@prefix gx: <https://w3id.org/gaia-x/development#> .\n'
t += '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n'
t += '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n'

for (let i = 0; i < 30; i++) {
  const fmt = pick(formatTypes)
  const detail = pick(detailLevels)
  const elem = pick(elements)
  const useCase = pick(useCases)
  const [toolName, toolVendor, toolVer] = pick(creationTools)
  const [city, country, state, region] = pick(cities)
  const prov = pick(providers)
  const slug = city.toLowerCase().replace(/ /g, '-') + '-envmodel-' + String(i + 1).padStart(3, '0')
  const nm = `${city} ${detail} Detail Environment Model`
  const triCount = randInt(10000, 5000000)
  const geoCount = randInt(50, 2000)
  const texCount = randInt(10, 500)
  const texRes = pick([512, 1024, 2048, 4096])

  t += `# --- Environment Model ${i + 1}: ${nm} ---\n\n`
  t += `<did:web:${prov}.io:EnvironmentModel:${slug}> a environment-model:EnvironmentModel ;\n`
  t += `  rdfs:label "${nm}"@en ;\n`
  t += `  environment-model:hasResourceDescription [\n`
  t += `    a envited-x:ResourceDescription ;\n`
  t += `    gx:name "${nm}" ;\n`
  t += `    gx:description "${detail} detail 3D environment model of ${city} for ${useCase}" ;\n`
  t += `    gx:version "${randInt(1, 3)}.${randInt(0, 9)}.0" ;\n`
  t += `    gx:license "${pick(['CC-BY-4.0', 'CC-BY-NC-4.0', 'proprietary'])}" ;\n`
  t += `    gx:containsPII false\n`
  t += `  ] ;\n`
  t += `  environment-model:hasDomainSpecification [\n`
  t += `    a environment-model:DomainSpecification ;\n`
  t += `    environment-model:hasFormat [\n`
  t += `      a environment-model:Format ;\n`
  t += `      environment-model:formatType "${fmt}" ;\n`
  t += `      environment-model:version "${pick(['1.0', '2.0', '3.0'])}"\n`
  t += `    ] ;\n`
  t += `    environment-model:hasContent [\n`
  t += `      a environment-model:Content ;\n`
  t += `      environment-model:elements "${elem}" ;\n`
  t += `      environment-model:useCase "${useCase}"\n`
  t += `    ] ;\n`
  t += `    environment-model:hasProject [\n`
  t += `      a environment-model:Project ;\n`
  t += `      environment-model:creationToolName "${toolName}" ;\n`
  t += `      environment-model:creationToolVendor "${toolVendor}" ;\n`
  t += `      environment-model:creationToolVersion "${toolVer}"\n`
  t += `    ] ;\n`
  t += `    environment-model:hasQuantity [\n`
  t += `      a environment-model:Quantity ;\n`
  t += `      environment-model:triangleCount "${triCount}"^^xsd:integer ;\n`
  t += `      environment-model:geometryCount "${geoCount}"^^xsd:integer ;\n`
  t += `      environment-model:textureMaterialCount "${texCount}"^^xsd:integer\n`
  t += `    ] ;\n`
  t += `    environment-model:hasQuality [\n`
  t += `      a environment-model:Quality ;\n`
  t += `      environment-model:detailLevel "${detail}" ;\n`
  t += `      environment-model:textureResolution "${texRes}"^^xsd:float\n`
  t += `    ] ;\n`
  t += `    environment-model:hasGeoreference [\n`
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
  t += `  environment-model:hasManifest [\n`
  t += `    a manifest:Manifest\n`
  t += `  ] .\n\n`
}

const outPath = path.join(
  __dirname,
  '..',
  'packages',
  'search',
  'data',
  'sample-environment-models.ttl'
)
fs.writeFileSync(outPath, t, 'utf-8')
console.log(`Generated 30 environment model assets -> ${outPath}`)
console.log(`File size: ${(t.length / 1024).toFixed(1)} KB`)
