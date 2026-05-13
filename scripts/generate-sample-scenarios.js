/**
 * Generate 50 diverse scenario test assets in Turtle (TTL) format.
 *
 * Each scenario has:
 * - Full domain specification (format, content, quantity, georeference)
 * - A referenced HD map with rich properties (format, content, quantity, quality, data source, georeference)
 * - Optionally a referenced environment model (~20 scenarios)
 *
 * All property selection is GENERIC: modular arithmetic over value arrays.
 * No manual mapping tables — every property is index-derived.
 */
const fs = require('fs')
const path = require('path')

// --- Value arrays (scenario domain) ---
const categories = [
  'cut-in',
  'lane-change',
  'intersection-crossing',
  'following',
  'overtaking',
  'pedestrian-crossing',
  'emergency-braking',
  'free-driving',
  'turning',
  'parking',
  'merging',
]
const weathers = ['clear', 'rain', 'snow', 'fog', 'night', 'windy', 'mixed']
const entities = ['car', 'truck', 'pedestrian', 'bicycle', 'bus', 'motorbike', 'van']
const scenarioFormats = ['ASAM OpenSCENARIO', 'ASAM OpenSCENARIO DSL']
const abstraction = ['Abstract', 'Functional', 'Logical', 'Concrete']
const cities = [
  ['Munich', 'DE'],
  ['Berlin', 'DE'],
  ['Stuttgart', 'DE'],
  ['San Francisco', 'US'],
  ['Detroit', 'US'],
  ['Tokyo', 'JP'],
  ['Paris', 'FR'],
  ['London', 'GB'],
  ['Shanghai', 'CN'],
  ['Seoul', 'KR'],
  ['Milan', 'IT'],
  ['Amsterdam', 'NL'],
  ['Gothenburg', 'SE'],
  ['Hamburg', 'DE'],
  ['Frankfurt', 'DE'],
]
const providers = ['simcorp', 'testfactory', 'drivesim', 'scengen', 'autosimco']
const sourceTypes = [
  'Accident Database',
  'Real World Data',
  'Analytical Hazard Based Approach',
  'Synthetic Generation',
  'Simulation Recording',
  'Manual Authoring',
  'Drone Recording',
]
const criticalityFactors = [
  'occlusion',
  'high_relative_speed',
  'VRU_interaction',
  'adverse_weather',
  'infrastructure_violation',
  'near_miss',
]

// --- Value arrays (referenced HD map properties) ---
const hdmapRoadTypes = ['motorway', 'town', 'rural', 'motorway_entry', 'custom']
const hdmapLaneTypeSets = [
  ['driving'],
  ['driving', 'shoulder'],
  ['driving', 'biking'],
  ['driving', 'walking', 'biking'],
  ['driving', 'bus'],
  ['driving', 'parking'],
  ['driving', 'emergency'],
]
const hdmapLods = ['lane', 'pole', 'crosswalk', 'flat-marking', 'wall', 'curb']
const hdmapFormats = [
  ['ASAM OpenDRIVE', '1.7'],
  ['ASAM OpenDRIVE', '1.8'],
  ['Lanelet2', '1.0'],
  ['Lanelet2', '1.1'],
  ['NDS.Live', '2.5'],
  ['Shape', '1.0'],
]
const hdmapDataSources = [
  'lidar',
  'camera',
  'scanner',
  'aerial',
  'satellite',
  'procedural generation',
  'survey',
  'mobile mapping',
]
const hdmapMeasSystems = [
  '3DMS system',
  'Mobile Mapping System',
  'RTK-GPS',
  'aerial scanner',
  'photogrammetry',
]

// --- Value arrays (referenced environment model properties) ---
const envmodelFormats = [
  ['Autodesk FBX', '1.0'],
  ['glTF', '2.0'],
  ['OpenSceneGraph', '3.0'],
  ['Unreal Datasmith', '1.0'],
]
const envmodelElements = [
  'buildings, roads, vegetation',
  'terrain, buildings, traffic signs',
  'roads, bridges, tunnels',
  'urban environment, street furniture',
  'highway, guardrails, barriers',
  'rural landscape, fields, trees',
  'parking structure, markings',
  'intersection, traffic lights, crosswalks',
]
const envmodelUseCases = [
  'sensor simulation',
  'camera simulation',
  'lidar simulation',
  'visual validation',
  'scenario visualization',
  'digital twin',
]
const envmodelDetailLevels = ['High', 'Medium', 'Low']
const envmodelCreationTools = [
  ['Blender', 'Blender Foundation', '3.6'],
  ['3ds Max', 'Autodesk', '2024'],
  ['Unreal Engine', 'Epic Games', '5.3'],
  ['RoadRunner', 'MathWorks', '2023b'],
]

// --- Output ---
let t = ''
t += '@prefix scenario: <https://w3id.org/ascs-ev/envited-x/scenario/v6/> .\n'
t += '@prefix envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/> .\n'
t += '@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .\n'
t += '@prefix manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/> .\n'
t += '@prefix hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/> .\n'
t += '@prefix environment-model: <https://w3id.org/ascs-ev/envited-x/environment-model/v5/> .\n'
t += '@prefix gx: <https://w3id.org/gaia-x/development#> .\n'
t += '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n'
t += '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n'

for (let i = 0; i < 50; i++) {
  const cat = categories[i % categories.length]
  const weather = weathers[i % weathers.length]
  const e1 = entities[i % entities.length]
  const e2 = entities[(i + 2) % entities.length]
  const fmt = scenarioFormats[i % scenarioFormats.length]
  const abs = abstraction[i % abstraction.length]
  const [city, country] = cities[i % cities.length]
  const prov = providers[i % providers.length]
  const cslug = city.toLowerCase().replace(/ /g, '-')
  const nm =
    cat
      .split('-')
      .map((x) => x[0].toUpperCase() + x.slice(1))
      .join(' ') +
    ' in ' +
    city
  const uri = `did:web:${prov}.io:Scenario:${cat}-${cslug}-${String(i + 1).padStart(3, '0')}`
  const srcType = sourceTypes[i % sourceTypes.length]
  const critFactor = criticalityFactors[i % criticalityFactors.length]

  // Scenario header
  t += `# --- Scenario ${i + 1}: ${nm} ---\n\n`
  t += `<${uri}> a scenario:Scenario ;\n`
  t += `  rdfs:label "${nm}"@en ;\n`
  t += `  scenario:hasDomainSpecification [\n`
  t += `    a scenario:DomainSpecification ;\n`
  t += `    scenario:hasFormat [\n`
  t += `      a scenario:Format ;\n`
  t += `      scenario:formatType "${fmt}" ;\n`
  t += `      scenario:version "${fmt.includes('DSL') ? '2.2' : '1.3'}"\n`
  t += `    ] ;\n`
  t += `    scenario:hasContent [\n`
  t += `      a scenario:Content ;\n`
  t += `      scenario:abstractionLevel "${abs}" ;\n`
  t += `      scenario:scenarioCategory "${cat}" ;\n`
  t += `      scenario:weatherSummary "${weather}" ;\n`
  t += `      scenario:entityTypes "${e1}" ;\n`
  t += `      scenario:entityTypes "${e2}" ;\n`
  t += `      scenario:country "${country.toLowerCase()}" ;\n`
  t += `      scenario:criticalityFactors "${critFactor}"\n`
  t += `    ] ;\n`
  t += `    scenario:hasQuantity [\n`
  t += `      a scenario:Quantity ;\n`
  t += `      scenario:numberTrafficObjects "${2 + (i % 8)}"^^xsd:integer ;\n`
  t += `      scenario:permanentTrafficObjects "${1 + (i % 5)}"^^xsd:integer ;\n`
  t += `      scenario:temporaryTrafficObjects "${i % 4}"^^xsd:integer\n`
  t += `    ] ;\n`
  t += `    scenario:hasDataSource [\n`
  t += `      a scenario:DataSource ;\n`
  t += `      scenario:sourceType "${srcType}"\n`
  t += `    ] ;\n`
  t += `    scenario:hasGeoreference [\n`
  t += `      a georeference:Georeference ;\n`
  t += `      georeference:hasProjectLocation [\n`
  t += `        a georeference:ProjectLocation ;\n`
  t += `        georeference:country "${country}" ;\n`
  t += `        georeference:city "${city}"\n`
  t += `      ]\n`
  t += `    ]\n`
  t += `  ] ;\n`

  // --- Referenced HD Map (all 50 scenarios) ---
  const hdmapRefUri = `did:web:mapprov${(i % 5) + 1}.net:HdMap:ref-${cslug}-${String(i + 1).padStart(3, '0')}`
  const hdmapRoad = hdmapRoadTypes[i % hdmapRoadTypes.length]
  const hdmapLanes = hdmapLaneTypeSets[i % hdmapLaneTypeSets.length]
  const hdmapLod = hdmapLods[i % hdmapLods.length]
  const [hdmapFmtType, hdmapFmtVer] = hdmapFormats[i % hdmapFormats.length]
  const hdmapDs = hdmapDataSources[i % hdmapDataSources.length]
  const hdmapMs = hdmapMeasSystems[i % hdmapMeasSystems.length]
  const hdmapTd = ['GB', 'JP', 'AU', 'SG'].includes(country) ? 'left-hand' : 'right-hand'
  const hdmapLength = (10 + ((i * 7 + 3) % 113)).toFixed(1)
  const hdmapIntersections = (i * 3 + 1) % 21
  const hdmapTrafficLights = (i * 2 + 5) % 16
  const hdmapSigns = 10 + ((i * 13 + 7) % 491)
  const hdmapObjects = 50 + ((i * 37 + 11) % 2951)
  const hdmapSpeedMin = 20 + ((i * 11) % 81)
  const hdmapSpeedMax = hdmapSpeedMin + 30 + ((i * 7) % 121)
  const hdmapPrecision = [0.005, 0.01, 0.02, 0.05][i % 4]

  // Determine if this scenario also gets an environment model reference
  const hasEnvModel = i % 5 < 2 // ~20 out of 50

  // Build manifest with referenced artifacts
  t += `  scenario:hasManifest [\n`
  t += `    a manifest:Manifest ;\n`
  t += `    manifest:hasReferencedArtifacts <${hdmapRefUri}>`
  if (hasEnvModel) {
    const envRefUri = `did:web:envprov${(i % 4) + 1}.net:EnvironmentModel:ref-${cslug}-${String(i + 1).padStart(3, '0')}`
    t += ` ,\n      <${envRefUri}>`
  }
  t += `\n  ] .\n\n`

  // --- Inline referenced HD map instance ---
  t += `<${hdmapRefUri}> a hdmap:HdMap ;\n`
  t += `  rdfs:label "Referenced HD Map for ${nm}"@en ;\n`
  t += `  hdmap:hasDomainSpecification [\n`
  t += `    a hdmap:DomainSpecification ;\n`
  t += `    hdmap:hasFormat [\n`
  t += `      a hdmap:Format ;\n`
  t += `      hdmap:formatType "${hdmapFmtType}" ;\n`
  t += `      hdmap:version "${hdmapFmtVer}"\n`
  t += `    ] ;\n`
  t += `    hdmap:hasContent [\n`
  t += `      a hdmap:Content ;\n`
  t += `      hdmap:roadTypes "${hdmapRoad}" ;\n`
  t += `      hdmap:laneTypes ${hdmapLanes.map((l) => '"' + l + '"').join(' , ')} ;\n`
  t += `      hdmap:levelOfDetail "${hdmapLod}" ;\n`
  t += `      hdmap:trafficDirection "${hdmapTd}"\n`
  t += `    ] ;\n`
  t += `    hdmap:hasQuantity [\n`
  t += `      a hdmap:Quantity ;\n`
  t += `      hdmap:length "${hdmapLength}"^^xsd:float ;\n`
  t += `      hdmap:numberIntersections "${hdmapIntersections}"^^xsd:integer ;\n`
  t += `      hdmap:numberTrafficLights "${hdmapTrafficLights}"^^xsd:integer ;\n`
  t += `      hdmap:numberTrafficSigns "${hdmapSigns}"^^xsd:integer ;\n`
  t += `      hdmap:numberObjects "${hdmapObjects}"^^xsd:integer ;\n`
  t += `      hdmap:speedLimit [\n`
  t += `        a hdmap:Range2D ;\n`
  t += `        hdmap:min "${hdmapSpeedMin}.0"^^xsd:float ;\n`
  t += `        hdmap:max "${hdmapSpeedMax}.0"^^xsd:float\n`
  t += `      ]\n`
  t += `    ] ;\n`
  t += `    hdmap:hasQuality [\n`
  t += `      a hdmap:Quality ;\n`
  t += `      hdmap:precision "${hdmapPrecision}"^^xsd:float\n`
  t += `    ] ;\n`
  t += `    hdmap:hasDataSource [\n`
  t += `      a hdmap:DataSource ;\n`
  t += `      hdmap:usedDataSources "${hdmapDs}" ;\n`
  t += `      hdmap:measurementSystem "${hdmapMs}"\n`
  t += `    ] ;\n`
  t += `    hdmap:hasGeoreference [\n`
  t += `      a georeference:Georeference ;\n`
  t += `      georeference:hasProjectLocation [\n`
  t += `        a georeference:ProjectLocation ;\n`
  t += `        georeference:country "${country}" ;\n`
  t += `        georeference:city "${city}"\n`
  t += `      ]\n`
  t += `    ]\n`
  t += `  ] .\n\n`

  // --- Inline referenced environment model instance (for ~20 scenarios) ---
  if (hasEnvModel) {
    const envRefUri = `did:web:envprov${(i % 4) + 1}.net:EnvironmentModel:ref-${cslug}-${String(i + 1).padStart(3, '0')}`
    const [envFmtType, envFmtVer] = envmodelFormats[i % envmodelFormats.length]
    const envElems = envmodelElements[i % envmodelElements.length]
    const envUseCase = envmodelUseCases[i % envmodelUseCases.length]
    const envDetail = envmodelDetailLevels[i % envmodelDetailLevels.length]
    const [envToolName, envToolVendor, envToolVer] =
      envmodelCreationTools[i % envmodelCreationTools.length]
    const envTriCount = 10000 + ((i * 97 + 13) % 4990001)
    const envGeoCount = 50 + ((i * 43 + 7) % 1951)
    const envTexCount = 10 + ((i * 23 + 3) % 491)
    const envTexRes = [512, 1024, 2048, 4096][i % 4]

    t += `<${envRefUri}> a environment-model:EnvironmentModel ;\n`
    t += `  rdfs:label "Referenced Environment Model for ${nm}"@en ;\n`
    t += `  environment-model:hasDomainSpecification [\n`
    t += `    a environment-model:DomainSpecification ;\n`
    t += `    environment-model:hasFormat [\n`
    t += `      a environment-model:Format ;\n`
    t += `      environment-model:formatType "${envFmtType}" ;\n`
    t += `      environment-model:version "${envFmtVer}"\n`
    t += `    ] ;\n`
    t += `    environment-model:hasContent [\n`
    t += `      a environment-model:Content ;\n`
    t += `      environment-model:elements "${envElems}" ;\n`
    t += `      environment-model:useCase "${envUseCase}"\n`
    t += `    ] ;\n`
    t += `    environment-model:hasProject [\n`
    t += `      a environment-model:Project ;\n`
    t += `      environment-model:creationToolName "${envToolName}" ;\n`
    t += `      environment-model:creationToolVendor "${envToolVendor}" ;\n`
    t += `      environment-model:creationToolVersion "${envToolVer}"\n`
    t += `    ] ;\n`
    t += `    environment-model:hasQuantity [\n`
    t += `      a environment-model:Quantity ;\n`
    t += `      environment-model:triangleCount "${envTriCount}"^^xsd:integer ;\n`
    t += `      environment-model:geometryCount "${envGeoCount}"^^xsd:integer ;\n`
    t += `      environment-model:textureMaterialCount "${envTexCount}"^^xsd:integer\n`
    t += `    ] ;\n`
    t += `    environment-model:hasQuality [\n`
    t += `      a environment-model:Quality ;\n`
    t += `      environment-model:detailLevel "${envDetail}" ;\n`
    t += `      environment-model:textureResolution "${envTexRes}"^^xsd:float\n`
    t += `    ] ;\n`
    t += `    environment-model:hasGeoreference [\n`
    t += `      a georeference:Georeference ;\n`
    t += `      georeference:hasProjectLocation [\n`
    t += `        a georeference:ProjectLocation ;\n`
    t += `        georeference:country "${country}" ;\n`
    t += `        georeference:city "${city}"\n`
    t += `      ]\n`
    t += `    ]\n`
    t += `  ] .\n\n`
  }
}

const outPath = path.join(__dirname, '..', 'packages', 'search', 'data', 'sample-scenarios.ttl')
fs.writeFileSync(outPath, t, 'utf-8')
const hdmapCount = 50
const envCount = Array.from({ length: 50 }, (_, i) => (i % 5 < 2 ? 1 : 0)).reduce(
  (a, b) => a + b,
  0
)
console.log(
  `Generated 50 scenario assets with ${hdmapCount} HD map refs + ${envCount} env model refs`
)
console.log(`File: ${outPath}`)
console.log(`Size: ${(t.length / 1024).toFixed(1)} KB`)
