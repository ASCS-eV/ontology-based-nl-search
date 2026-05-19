import type { SparqlStore } from '@ontology-search/sparql/types'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, '..', 'data')

/**
 * Load a sample data file for development/testing.
 * Returns the raw file content, or empty string if the file is missing.
 */
function loadDataFile(filename: string): string {
  try {
    return readFileSync(join(DATA_DIR, filename), 'utf-8')
  } catch {
    // intentional: graceful degradation — sample files are optional and
    // the caller falls back to FALLBACK_TURTLE when none load successfully
    return ''
  }
}

const FALLBACK_TURTLE = `
@prefix hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/> .
@prefix envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/> .
@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .
@prefix gx: <https://w3id.org/gaia-x/development#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<did:web:fallback:HdMap:sample-001> a hdmap:HdMap ;
  rdfs:label "Sample HD Map"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "Sample HD Map" ;
    gx:description "Fallback sample asset" ;
    gx:version "1.0.0" ;
    gx:license "CC-BY-4.0" ;
    gx:containsPII false
  ] ;
  hdmap:hasDomainSpecification [
    a hdmap:DomainSpecification ;
    hdmap:hasFormat [
      a hdmap:Format ;
      hdmap:formatType "ASAM OpenDRIVE" ;
      hdmap:version "1.6"
    ] ;
    hdmap:hasContent [
      a hdmap:Content ;
      hdmap:roadTypes "town" ;
      hdmap:laneTypes "driving" ;
      hdmap:levelOfDetail "lane" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "5.0"^^xsd:float ;
      hdmap:numberIntersections "2"^^xsd:integer ;
      hdmap:numberTrafficLights "1"^^xsd:integer ;
      hdmap:numberTrafficSigns "10"^^xsd:integer
    ] ;
    hdmap:hasGeoreference [
      a georeference:Georeference ;
      georeference:hasProjectLocation [
        a georeference:ProjectLocation ;
        georeference:country "DE" ;
        georeference:city "Munich"
      ]
    ]
  ] .
`

/**
 * Load sample data into the SPARQL store for development/testing.
 * Prefers JSON-LD files (`.jsonld`) and falls back to Turtle (`.ttl`).
 * Falls back to a single inline HD map if no sample files are present.
 */
export async function loadSampleData(store: SparqlStore): Promise<void> {
  const jsonldFiles = [
    'sample-hdmap.jsonld',
    'sample-scenarios.jsonld',
    'sample-ositrace.jsonld',
    'sample-environment-models.jsonld',
    'sample-surface-models.jsonld',
  ]

  const ttlFiles = [
    'sample-assets.ttl',
    'sample-scenarios.ttl',
    'sample-ositrace.ttl',
    'sample-environment-models.ttl',
    'sample-surface-models.ttl',
  ]

  let loaded = 0

  // Try JSON-LD files first
  for (const file of jsonldFiles) {
    const data = loadDataFile(file)
    if (data) {
      await store.loadJsonLd(data)
      loaded++
    }
  }

  // Fall back to TTL files if no JSON-LD files were found
  if (loaded === 0) {
    for (const file of ttlFiles) {
      const data = loadDataFile(file)
      if (data) {
        await store.loadTurtle(data)
        loaded++
      }
    }
  }

  if (loaded === 0) {
    await store.loadTurtle(FALLBACK_TURTLE)
  }
}
