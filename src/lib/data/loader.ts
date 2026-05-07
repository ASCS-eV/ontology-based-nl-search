import { readFileSync } from 'fs'
import { join } from 'path'
import type { SparqlStore } from '@/lib/sparql'

/**
 * Load sample TTL data from file (100 diverse HD map assets).
 * Falls back to a minimal inline dataset if file is not found.
 */
function getSampleData(): string {
  try {
    return readFileSync(join(process.cwd(), 'src', 'lib', 'data', 'sample-assets.ttl'), 'utf-8')
  } catch {
    return FALLBACK_TURTLE
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
 */
export async function loadSampleData(store: SparqlStore): Promise<void> {
  await store.loadTurtle(getSampleData())
}
