const fs = require('fs')

const categories = [
  'cut-in', 'lane-change', 'intersection-crossing', 'following', 'overtaking',
  'pedestrian-crossing', 'emergency-braking', 'free-driving', 'turning', 'parking', 'merging'
]
const weathers = ['clear', 'rain', 'snow', 'fog', 'night', 'windy', 'mixed']
const entities = ['car', 'truck', 'pedestrian', 'bicycle', 'bus', 'motorbike', 'van']
const formats = ['ASAM OpenSCENARIO', 'ASAM OpenSCENARIO DSL']
const abstraction = ['Abstract', 'Functional', 'Logical', 'Concrete']
const cities = [
  ['Munich', 'DE'], ['Berlin', 'DE'], ['Stuttgart', 'DE'],
  ['San Francisco', 'US'], ['Detroit', 'US'], ['Tokyo', 'JP'],
  ['Paris', 'FR'], ['London', 'GB'], ['Shanghai', 'CN'], ['Seoul', 'KR'],
  ['Milan', 'IT'], ['Amsterdam', 'NL'], ['Gothenburg', 'SE'],
  ['Hamburg', 'DE'], ['Frankfurt', 'DE']
]
const providers = ['simcorp', 'testfactory', 'drivesim', 'scengen', 'autosimco']

let t = ''
t += '@prefix scenario: <https://w3id.org/ascs-ev/envited-x/scenario/v6/> .\n'
t += '@prefix envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/> .\n'
t += '@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .\n'
t += '@prefix manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/> .\n'
t += '@prefix hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/> .\n'
t += '@prefix gx: <https://w3id.org/gaia-x/development#> .\n'
t += '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .\n'
t += '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .\n\n'

for (let i = 0; i < 50; i++) {
  const cat = categories[i % categories.length]
  const weather = weathers[i % weathers.length]
  const e1 = entities[i % entities.length]
  const e2 = entities[(i + 2) % entities.length]
  const fmt = formats[i % formats.length]
  const abs = abstraction[i % abstraction.length]
  const [city, country] = cities[i % cities.length]
  const prov = providers[i % providers.length]
  const cslug = city.toLowerCase().replace(/ /g, '-')
  const nm = cat.split('-').map(x => x[0].toUpperCase() + x.slice(1)).join(' ') + ' in ' + city

  const uri = `did:web:${prov}.io:Scenario:${cat}-${cslug}-${String(i + 1).padStart(3, '0')}`

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
  t += `      scenario:country "${country.toLowerCase()}"\n`
  t += `    ] ;\n`
  t += `    scenario:hasQuantity [\n`
  t += `      a scenario:Quantity ;\n`
  t += `      scenario:numberOfEntities "${2 + (i % 5)}"^^xsd:integer ;\n`
  t += `      scenario:duration "${(5 + i * 3.7).toFixed(1)}"^^xsd:float\n`
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

  // Some scenarios have referenced hdmaps (for cross-domain queries)
  if (i % 3 === 0) {
    const refUri = `did:web:prov${(i % 5) + 1}.net:HdMap:ref-${String(i + 1).padStart(3, '0')}`
    t += `  scenario:hasManifest [\n`
    t += `    a manifest:Manifest ;\n`
    t += `    manifest:hasReferencedArtifacts <${refUri}>\n`
    t += `  ] .\n\n`
    // Referenced HD Map stub with relevant properties
    const roadType = cat.includes('intersection') ? 'town' : 'motorway'
    t += `<${refUri}> a hdmap:HdMap ;\n`
    t += `  rdfs:label "Ref HD Map for ${nm}"@en ;\n`
    t += `  hdmap:hasDomainSpecification [\n`
    t += `    a hdmap:DomainSpecification ;\n`
    t += `    hdmap:hasContent [\n`
    t += `      a hdmap:Content ;\n`
    t += `      hdmap:roadTypes "${roadType}" ;\n`
    t += `      hdmap:laneTypes "driving"\n`
    t += `    ]\n`
    t += `  ] .\n\n`
  } else {
    t += `  scenario:hasManifest [\n`
    t += `    a manifest:Manifest\n`
    t += `  ] .\n\n`
  }
}

fs.writeFileSync('src/lib/data/sample-scenarios.ttl', t)
console.log(`Generated 50 scenario assets (${(t.length / 1024).toFixed(1)} KB)`)
