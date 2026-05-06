import type { SparqlStore } from '@/lib/sparql'

/**
 * Sample HD Map SimulationAsset metadata in Turtle format.
 * Based on the real hdmap v6 ontology from ontology-management-base.
 * Contains 8 varied HD map assets for meaningful search testing.
 */
const SAMPLE_DATA_TURTLE = `
@prefix hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/> .
@prefix envited-x: <https://w3id.org/ascs-ev/envited-x/envited-x/v3/> .
@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .
@prefix manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/> .
@prefix gx: <https://w3id.org/gaia-x/development#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# --- Asset 1: Urban town map from Grafing, Bavaria ---

<did:web:provider1.net:HdMap:grafing-town> a hdmap:HdMap ;
  rdfs:label "Grafing Town Center HD Map"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "Grafing Town Center HD Map" ;
    gx:description "HD map covering the town center of Grafing near Munich, with crosswalks and pedestrian areas." ;
    gx:version "1.0.0" ;
    gx:license "EPL-2.0" ;
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
      hdmap:laneTypes "driving" , "walking" ;
      hdmap:levelOfDetail "crosswalk" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "1.46"^^xsd:float ;
      hdmap:elevationRange "2.22"^^xsd:float ;
      hdmap:numberIntersections "5"^^xsd:integer ;
      hdmap:numberTrafficLights "0"^^xsd:integer ;
      hdmap:numberTrafficSigns "155"^^xsd:integer ;
      hdmap:numberObjects "200"^^xsd:integer ;
      hdmap:numberOutlines "100"^^xsd:integer ;
      hdmap:rangeOfModeling "20.0"^^xsd:float ;
      hdmap:speedLimit [
        a hdmap:Range2D ;
        hdmap:min "10.0"^^xsd:float ;
        hdmap:max "50.0"^^xsd:float
      ]
    ] ;
    hdmap:hasQuality [
      a hdmap:Quality ;
      hdmap:precision "0.01"^^xsd:float ;
      hdmap:accuracyLaneModel2d "0.1"^^xsd:float ;
      hdmap:accuracyLaneModelHeight "0.1"^^xsd:float ;
      hdmap:accuracySignals "0.1"^^xsd:float ;
      hdmap:accuracyObjects "0.1"^^xsd:float
    ] ;
    hdmap:hasDataSource [
      a hdmap:DataSource ;
      hdmap:usedDataSources "scanner" ;
      hdmap:measurementSystem "3DMS system"
    ] ;
    hdmap:hasGeoreference [
      a georeference:Georeference ;
      georeference:hasProjectLocation [
        a georeference:ProjectLocation ;
        georeference:country "DE" ;
        georeference:state "DE-BY" ;
        georeference:region "Upper Bavaria" ;
        georeference:city "Grafing" ;
        georeference:hasBoundingBox [
          a georeference:BoundingBox ;
          georeference:xMin "11.964"^^xsd:float ;
          georeference:yMin "48.043"^^xsd:float ;
          georeference:xMax "11.968"^^xsd:float ;
          georeference:yMax "48.047"^^xsd:float
        ]
      ]
    ]
  ] .

# --- Asset 2: German Autobahn A9 section ---

<did:web:provider2.net:HdMap:a9-highway> a hdmap:HdMap ;
  rdfs:label "A9 Autobahn Section München-Ingolstadt"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "A9 Autobahn Section München-Ingolstadt" ;
    gx:description "HD map of a section of the A9 motorway between München and Ingolstadt with 3 driving lanes per direction." ;
    gx:version "2.1.0" ;
    gx:license "CC-BY-4.0" ;
    gx:containsPII false
  ] ;
  hdmap:hasDomainSpecification [
    a hdmap:DomainSpecification ;
    hdmap:hasFormat [
      a hdmap:Format ;
      hdmap:formatType "ASAM OpenDRIVE" ;
      hdmap:version "1.8"
    ] ;
    hdmap:hasContent [
      a hdmap:Content ;
      hdmap:roadTypes "motorway" ;
      hdmap:laneTypes "driving" , "shoulder" ;
      hdmap:levelOfDetail "lane" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "45.0"^^xsd:float ;
      hdmap:elevationRange "120.5"^^xsd:float ;
      hdmap:numberIntersections "0"^^xsd:integer ;
      hdmap:numberTrafficLights "0"^^xsd:integer ;
      hdmap:numberTrafficSigns "85"^^xsd:integer ;
      hdmap:numberObjects "350"^^xsd:integer ;
      hdmap:numberOutlines "50"^^xsd:integer ;
      hdmap:rangeOfModeling "50.0"^^xsd:float ;
      hdmap:speedLimit [
        a hdmap:Range2D ;
        hdmap:min "80.0"^^xsd:float ;
        hdmap:max "130.0"^^xsd:float
      ]
    ] ;
    hdmap:hasQuality [
      a hdmap:Quality ;
      hdmap:precision "0.005"^^xsd:float ;
      hdmap:accuracyLaneModel2d "0.05"^^xsd:float ;
      hdmap:accuracyLaneModelHeight "0.08"^^xsd:float ;
      hdmap:accuracySignals "0.15"^^xsd:float ;
      hdmap:accuracyObjects "0.2"^^xsd:float
    ] ;
    hdmap:hasDataSource [
      a hdmap:DataSource ;
      hdmap:usedDataSources "lidar" ;
      hdmap:measurementSystem "Mobile Mapping System"
    ] ;
    hdmap:hasGeoreference [
      a georeference:Georeference ;
      georeference:hasProjectLocation [
        a georeference:ProjectLocation ;
        georeference:country "DE" ;
        georeference:state "DE-BY" ;
        georeference:region "Upper Bavaria" ;
        georeference:city "Ingolstadt" ;
        georeference:hasBoundingBox [
          a georeference:BoundingBox ;
          georeference:xMin "11.421"^^xsd:float ;
          georeference:yMin "48.456"^^xsd:float ;
          georeference:xMax "11.782"^^xsd:float ;
          georeference:yMax "48.763"^^xsd:float
        ]
      ]
    ]
  ] .

# --- Asset 3: Rural road in Lower Saxony ---

<did:web:provider3.net:HdMap:niedersachsen-rural> a hdmap:HdMap ;
  rdfs:label "Testfeld Niedersachsen Rural Road"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "Testfeld Niedersachsen Rural Road" ;
    gx:description "Rural road section in the Testfeld Niedersachsen test site for automated driving research." ;
    gx:version "1.2.0" ;
    gx:license "EPL-2.0" ;
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
      hdmap:roadTypes "rural" ;
      hdmap:laneTypes "driving" , "shoulder" ;
      hdmap:levelOfDetail "pole" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "12.8"^^xsd:float ;
      hdmap:elevationRange "5.0"^^xsd:float ;
      hdmap:numberIntersections "3"^^xsd:integer ;
      hdmap:numberTrafficLights "2"^^xsd:integer ;
      hdmap:numberTrafficSigns "42"^^xsd:integer ;
      hdmap:numberObjects "180"^^xsd:integer ;
      hdmap:numberOutlines "30"^^xsd:integer ;
      hdmap:rangeOfModeling "15.0"^^xsd:float ;
      hdmap:speedLimit [
        a hdmap:Range2D ;
        hdmap:min "50.0"^^xsd:float ;
        hdmap:max "100.0"^^xsd:float
      ]
    ] ;
    hdmap:hasQuality [
      a hdmap:Quality ;
      hdmap:precision "0.02"^^xsd:float ;
      hdmap:accuracyLaneModel2d "0.15"^^xsd:float ;
      hdmap:accuracyLaneModelHeight "0.2"^^xsd:float
    ] ;
    hdmap:hasDataSource [
      a hdmap:DataSource ;
      hdmap:usedDataSources "aerial survey" ;
      hdmap:measurementSystem "UAV photogrammetry"
    ] ;
    hdmap:hasGeoreference [
      a georeference:Georeference ;
      georeference:hasProjectLocation [
        a georeference:ProjectLocation ;
        georeference:country "DE" ;
        georeference:state "DE-NI" ;
        georeference:region "Lower Saxony" ;
        georeference:city "Braunschweig" ;
        georeference:hasBoundingBox [
          a georeference:BoundingBox ;
          georeference:xMin "10.468"^^xsd:float ;
          georeference:yMin "52.228"^^xsd:float ;
          georeference:xMax "10.612"^^xsd:float ;
          georeference:yMax "52.315"^^xsd:float
        ]
      ]
    ]
  ] .

# --- Asset 4: Vienna urban map ---

<did:web:provider4.net:HdMap:vienna-ringstrasse> a hdmap:HdMap ;
  rdfs:label "Vienna Ringstraße HD Map"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "Vienna Ringstraße HD Map" ;
    gx:description "HD map of a section of the Vienna Ringstraße with tram tracks, multiple intersections, and complex traffic patterns." ;
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
      hdmap:laneTypes "driving" , "walking" , "biking" ;
      hdmap:levelOfDetail "crosswalk" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "3.2"^^xsd:float ;
      hdmap:elevationRange "1.5"^^xsd:float ;
      hdmap:numberIntersections "12"^^xsd:integer ;
      hdmap:numberTrafficLights "24"^^xsd:integer ;
      hdmap:numberTrafficSigns "89"^^xsd:integer ;
      hdmap:numberObjects "450"^^xsd:integer ;
      hdmap:numberOutlines "200"^^xsd:integer ;
      hdmap:rangeOfModeling "25.0"^^xsd:float ;
      hdmap:speedLimit [
        a hdmap:Range2D ;
        hdmap:min "30.0"^^xsd:float ;
        hdmap:max "50.0"^^xsd:float
      ]
    ] ;
    hdmap:hasQuality [
      a hdmap:Quality ;
      hdmap:precision "0.01"^^xsd:float ;
      hdmap:accuracyLaneModel2d "0.08"^^xsd:float ;
      hdmap:accuracyLaneModelHeight "0.1"^^xsd:float ;
      hdmap:accuracySignals "0.05"^^xsd:float ;
      hdmap:accuracyObjects "0.08"^^xsd:float
    ] ;
    hdmap:hasDataSource [
      a hdmap:DataSource ;
      hdmap:usedDataSources "scanner" ;
      hdmap:measurementSystem "Terrestrial laser scanning"
    ] ;
    hdmap:hasGeoreference [
      a georeference:Georeference ;
      georeference:hasProjectLocation [
        a georeference:ProjectLocation ;
        georeference:country "AT" ;
        georeference:state "AT-9" ;
        georeference:region "Vienna" ;
        georeference:city "Vienna" ;
        georeference:hasBoundingBox [
          a georeference:BoundingBox ;
          georeference:xMin "16.355"^^xsd:float ;
          georeference:yMin "48.200"^^xsd:float ;
          georeference:xMax "16.378"^^xsd:float ;
          georeference:yMax "48.215"^^xsd:float
        ]
      ]
    ]
  ] .

# --- Asset 5: Generic NCAP highway (no georeference) ---

<did:web:provider5.net:HdMap:ncap-highway-generic> a hdmap:HdMap ;
  rdfs:label "Generic NCAP Highway Scenario Map"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "Generic NCAP Highway Scenario Map" ;
    gx:description "A generic HD map without georeference for Euro NCAP highway scenarios. Abstract 3-lane geometry." ;
    gx:version "1.0.0" ;
    gx:license "EPL-2.0" ;
    gx:containsPII false
  ] ;
  hdmap:hasDomainSpecification [
    a hdmap:DomainSpecification ;
    hdmap:hasFormat [
      a hdmap:Format ;
      hdmap:formatType "ASAM OpenDRIVE" ;
      hdmap:version "1.8"
    ] ;
    hdmap:hasContent [
      a hdmap:Content ;
      hdmap:roadTypes "motorway" ;
      hdmap:laneTypes "driving" , "shoulder" ;
      hdmap:levelOfDetail "lane" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "0.5"^^xsd:float ;
      hdmap:elevationRange "0.0"^^xsd:float ;
      hdmap:numberIntersections "0"^^xsd:integer ;
      hdmap:numberTrafficLights "0"^^xsd:integer ;
      hdmap:numberTrafficSigns "0"^^xsd:integer ;
      hdmap:numberObjects "2"^^xsd:integer ;
      hdmap:numberOutlines "0"^^xsd:integer ;
      hdmap:speedLimit [
        a hdmap:Range2D ;
        hdmap:min "0.0"^^xsd:float ;
        hdmap:max "130.0"^^xsd:float
      ]
    ] ;
    hdmap:hasQuality [
      a hdmap:Quality ;
      hdmap:precision "0.01"^^xsd:float
    ] ;
    hdmap:hasDataSource [
      a hdmap:DataSource ;
      hdmap:usedDataSources "procedural generation"
    ]
  ] .

# --- Asset 6: Swiss mountain pass ---

<did:web:provider6.net:HdMap:gotthard-pass> a hdmap:HdMap ;
  rdfs:label "Gotthard Pass Mountain Road"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "Gotthard Pass Mountain Road" ;
    gx:description "HD map of the Gotthard Pass road with extreme elevation changes, tight curves, and tunnels." ;
    gx:version "1.1.0" ;
    gx:license "CC-BY-NC-4.0" ;
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
      hdmap:roadTypes "rural" ;
      hdmap:laneTypes "driving" ;
      hdmap:levelOfDetail "pole" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "22.5"^^xsd:float ;
      hdmap:elevationRange "850.0"^^xsd:float ;
      hdmap:numberIntersections "2"^^xsd:integer ;
      hdmap:numberTrafficLights "0"^^xsd:integer ;
      hdmap:numberTrafficSigns "120"^^xsd:integer ;
      hdmap:numberObjects "95"^^xsd:integer ;
      hdmap:numberOutlines "15"^^xsd:integer ;
      hdmap:rangeOfModeling "10.0"^^xsd:float ;
      hdmap:speedLimit [
        a hdmap:Range2D ;
        hdmap:min "40.0"^^xsd:float ;
        hdmap:max "80.0"^^xsd:float
      ]
    ] ;
    hdmap:hasQuality [
      a hdmap:Quality ;
      hdmap:precision "0.03"^^xsd:float ;
      hdmap:accuracyLaneModel2d "0.2"^^xsd:float ;
      hdmap:accuracyLaneModelHeight "0.3"^^xsd:float
    ] ;
    hdmap:hasDataSource [
      a hdmap:DataSource ;
      hdmap:usedDataSources "lidar" ;
      hdmap:measurementSystem "Airborne LiDAR"
    ] ;
    hdmap:hasGeoreference [
      a georeference:Georeference ;
      georeference:hasProjectLocation [
        a georeference:ProjectLocation ;
        georeference:country "CH" ;
        georeference:state "CH-UR" ;
        georeference:region "Uri" ;
        georeference:city "Andermatt" ;
        georeference:hasBoundingBox [
          a georeference:BoundingBox ;
          georeference:xMin "8.571"^^xsd:float ;
          georeference:yMin "46.573"^^xsd:float ;
          georeference:xMax "8.651"^^xsd:float ;
          georeference:yMax "46.652"^^xsd:float
        ]
      ]
    ]
  ] .

# --- Asset 7: Japanese urban map (left-hand traffic) ---

<did:web:provider7.net:HdMap:tokyo-shibuya> a hdmap:HdMap ;
  rdfs:label "Tokyo Shibuya Crossing Area"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "Tokyo Shibuya Crossing Area" ;
    gx:description "HD map of the Shibuya crossing area in Tokyo with complex multi-lane intersections and left-hand traffic." ;
    gx:version "1.0.0" ;
    gx:license "Apache-2.0" ;
    gx:containsPII false
  ] ;
  hdmap:hasDomainSpecification [
    a hdmap:DomainSpecification ;
    hdmap:hasFormat [
      a hdmap:Format ;
      hdmap:formatType "ASAM OpenDRIVE" ;
      hdmap:version "1.8"
    ] ;
    hdmap:hasContent [
      a hdmap:Content ;
      hdmap:roadTypes "town" ;
      hdmap:laneTypes "driving" , "walking" , "biking" ;
      hdmap:levelOfDetail "crosswalk" ;
      hdmap:trafficDirection "left-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "0.8"^^xsd:float ;
      hdmap:elevationRange "3.0"^^xsd:float ;
      hdmap:numberIntersections "8"^^xsd:integer ;
      hdmap:numberTrafficLights "32"^^xsd:integer ;
      hdmap:numberTrafficSigns "67"^^xsd:integer ;
      hdmap:numberObjects "520"^^xsd:integer ;
      hdmap:numberOutlines "180"^^xsd:integer ;
      hdmap:rangeOfModeling "30.0"^^xsd:float ;
      hdmap:speedLimit [
        a hdmap:Range2D ;
        hdmap:min "20.0"^^xsd:float ;
        hdmap:max "40.0"^^xsd:float
      ]
    ] ;
    hdmap:hasQuality [
      a hdmap:Quality ;
      hdmap:precision "0.005"^^xsd:float ;
      hdmap:accuracyLaneModel2d "0.05"^^xsd:float ;
      hdmap:accuracyLaneModelHeight "0.05"^^xsd:float ;
      hdmap:accuracySignals "0.03"^^xsd:float ;
      hdmap:accuracyObjects "0.05"^^xsd:float
    ] ;
    hdmap:hasDataSource [
      a hdmap:DataSource ;
      hdmap:usedDataSources "scanner" ;
      hdmap:measurementSystem "Mobile Mapping System"
    ] ;
    hdmap:hasGeoreference [
      a georeference:Georeference ;
      georeference:hasProjectLocation [
        a georeference:ProjectLocation ;
        georeference:country "JP" ;
        georeference:region "Kanto" ;
        georeference:city "Tokyo" ;
        georeference:hasBoundingBox [
          a georeference:BoundingBox ;
          georeference:xMin "139.698"^^xsd:float ;
          georeference:yMin "35.658"^^xsd:float ;
          georeference:xMax "139.703"^^xsd:float ;
          georeference:yMax "35.662"^^xsd:float
        ]
      ]
    ]
  ] .

# --- Asset 8: Large-scale German Autobahn map ---

<did:web:provider8.net:HdMap:a5-frankfurt-karlsruhe> a hdmap:HdMap ;
  rdfs:label "A5 Frankfurt-Karlsruhe Autobahn"@en ;
  hdmap:hasResourceDescription [
    a envited-x:ResourceDescription ;
    gx:name "A5 Frankfurt-Karlsruhe Autobahn" ;
    gx:description "Large-scale HD map covering 180km of the A5 Autobahn between Frankfurt and Karlsruhe, including rest areas and construction zones." ;
    gx:version "3.0.0" ;
    gx:license "CC-BY-4.0" ;
    gx:containsPII false
  ] ;
  hdmap:hasDomainSpecification [
    a hdmap:DomainSpecification ;
    hdmap:hasFormat [
      a hdmap:Format ;
      hdmap:formatType "ASAM OpenDRIVE" ;
      hdmap:version "1.8"
    ] ;
    hdmap:hasContent [
      a hdmap:Content ;
      hdmap:roadTypes "motorway" ;
      hdmap:laneTypes "driving" , "shoulder" , "parking" ;
      hdmap:levelOfDetail "lane" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasQuantity [
      a hdmap:Quantity ;
      hdmap:length "180.0"^^xsd:float ;
      hdmap:elevationRange "250.0"^^xsd:float ;
      hdmap:numberIntersections "15"^^xsd:integer ;
      hdmap:numberTrafficLights "8"^^xsd:integer ;
      hdmap:numberTrafficSigns "1200"^^xsd:integer ;
      hdmap:numberObjects "5000"^^xsd:integer ;
      hdmap:numberOutlines "800"^^xsd:integer ;
      hdmap:rangeOfModeling "60.0"^^xsd:float ;
      hdmap:speedLimit [
        a hdmap:Range2D ;
        hdmap:min "60.0"^^xsd:float ;
        hdmap:max "130.0"^^xsd:float
      ]
    ] ;
    hdmap:hasQuality [
      a hdmap:Quality ;
      hdmap:precision "0.01"^^xsd:float ;
      hdmap:accuracyLaneModel2d "0.1"^^xsd:float ;
      hdmap:accuracyLaneModelHeight "0.15"^^xsd:float ;
      hdmap:accuracySignals "0.1"^^xsd:float ;
      hdmap:accuracyObjects "0.15"^^xsd:float
    ] ;
    hdmap:hasDataSource [
      a hdmap:DataSource ;
      hdmap:usedDataSources "lidar" ;
      hdmap:measurementSystem "Mobile Mapping System"
    ] ;
    hdmap:hasGeoreference [
      a georeference:Georeference ;
      georeference:hasProjectLocation [
        a georeference:ProjectLocation ;
        georeference:country "DE" ;
        georeference:state "DE-HE" ;
        georeference:region "Hesse" ;
        georeference:city "Frankfurt" ;
        georeference:hasBoundingBox [
          a georeference:BoundingBox ;
          georeference:xMin "8.385"^^xsd:float ;
          georeference:yMin "48.992"^^xsd:float ;
          georeference:xMax "8.682"^^xsd:float ;
          georeference:yMax "50.110"^^xsd:float
        ]
      ]
    ]
  ] .
`

/**
 * Load sample data into the SPARQL store for development/testing.
 */
export async function loadSampleData(store: SparqlStore): Promise<void> {
  await store.loadTurtle(SAMPLE_DATA_TURTLE)
}
