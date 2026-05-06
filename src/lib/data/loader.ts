import type { SparqlStore } from '@/lib/sparql'

/**
 * Sample SimulationAsset metadata in Turtle format.
 * Based on ENVITED-X ontology structure for testing purposes.
 */
const SAMPLE_DATA_TURTLE = `
@prefix envx: <https://w3id.org/2024/2/2/envited-x/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix dct: <http://purl.org/dc/terms/> .

# Sample Simulation Assets

envx:asset-001 a envx:SimulationAsset ;
  rdfs:label "A9 München-Nürnberg Highway Section"@en ;
  dct:description "High-definition map of the A9 highway between München and Nürnberg, Germany. 3 lanes per direction."@en ;
  envx:hasAssetType envx:HDMap ;
  envx:hasFormat "OpenDRIVE" ;
  envx:hasCountry "Germany" ;
  envx:hasRoadType "Highway" ;
  envx:hasLaneCount "3"^^xsd:integer ;
  envx:hasLength "120.5"^^xsd:float ;
  envx:hasCreator "BMW AG" ;
  envx:hasLicense "CC-BY-4.0" .

envx:asset-002 a envx:SimulationAsset ;
  rdfs:label "B27 Stuttgart Urban Road"@en ;
  dct:description "Urban road section of Bundesstraße 27 in Stuttgart with traffic lights and pedestrian crossings."@en ;
  envx:hasAssetType envx:HDMap ;
  envx:hasFormat "OpenDRIVE" ;
  envx:hasCountry "Germany" ;
  envx:hasRoadType "Urban" ;
  envx:hasLaneCount "2"^^xsd:integer ;
  envx:hasLength "5.2"^^xsd:float ;
  envx:hasCreator "University of Stuttgart" ;
  envx:hasLicense "MIT" .

envx:asset-003 a envx:SimulationAsset ;
  rdfs:label "Highway Cut-In Scenario"@en ;
  dct:description "OpenSCENARIO cut-in scenario on a 3-lane German highway at 130 km/h."@en ;
  envx:hasAssetType envx:Scenario ;
  envx:hasFormat "OpenSCENARIO" ;
  envx:hasCountry "Germany" ;
  envx:hasRoadType "Highway" ;
  envx:hasLaneCount "3"^^xsd:integer ;
  envx:hasCreator "ASCS e.V." ;
  envx:hasLicense "Apache-2.0" .

envx:asset-004 a envx:SimulationAsset ;
  rdfs:label "Vienna Ring Road Section"@en ;
  dct:description "HD map of a section of the Vienna Ring Road with tram tracks and mixed traffic."@en ;
  envx:hasAssetType envx:HDMap ;
  envx:hasFormat "OpenDRIVE" ;
  envx:hasCountry "Austria" ;
  envx:hasRoadType "Urban" ;
  envx:hasLaneCount "2"^^xsd:integer ;
  envx:hasLength "3.8"^^xsd:float ;
  envx:hasCreator "TU Wien" ;
  envx:hasLicense "CC-BY-4.0" .

envx:asset-005 a envx:SimulationAsset ;
  rdfs:label "A1 Salzburg Highway 3D Environment"@en ;
  dct:description "3D environment model of the A1 highway near Salzburg with bridges and tunnels."@en ;
  envx:hasAssetType envx:EnvironmentModel ;
  envx:hasFormat "FBX" ;
  envx:hasCountry "Austria" ;
  envx:hasRoadType "Highway" ;
  envx:hasLaneCount "2"^^xsd:integer ;
  envx:hasLength "15.0"^^xsd:float ;
  envx:hasCreator "Virtual Vehicle" ;
  envx:hasLicense "CC-BY-NC-4.0" .

envx:asset-006 a envx:SimulationAsset ;
  rdfs:label "Autobahn Emergency Brake Scenario"@en ;
  dct:description "Emergency braking scenario on German Autobahn A5 with 3 lanes at 180 km/h."@en ;
  envx:hasAssetType envx:Scenario ;
  envx:hasFormat "OpenSCENARIO" ;
  envx:hasCountry "Germany" ;
  envx:hasRoadType "Highway" ;
  envx:hasLaneCount "3"^^xsd:integer ;
  envx:hasCreator "Fraunhofer IOSB" ;
  envx:hasLicense "Apache-2.0" .
`

/**
 * Load sample data into the SPARQL store for development/testing.
 */
export async function loadSampleData(store: SparqlStore): Promise<void> {
  await store.loadTurtle(SAMPLE_DATA_TURTLE)
}
