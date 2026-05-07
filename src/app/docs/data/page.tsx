'use client'

import { Mermaid } from '@/components/Mermaid'

export default function DocsData() {
  return (
    <>
      <h1>Data Model</h1>
      <p>
        The knowledge graph currently contains <strong>100 diverse HD map
        assets</strong> covering 27 countries, 14 road scenarios, and 6 map
        formats. This section explains the data structure and how to extend it.
      </p>

      <h2>Asset Structure</h2>
      <Mermaid
        chart={`graph TD
    A[hdmap:HdMap] -->|hasResourceDescription| RD[Resource Description]
    A -->|hasDomainSpecification| DS[Domain Specification]

    RD --> N[gx:name]
    RD --> D[gx:description]
    RD --> V[gx:version]
    RD --> L[gx:license]

    DS -->|hasFormat| F[Format]
    DS -->|hasContent| C[Content]
    DS -->|hasQuantity| Q[Quantity]
    DS -->|hasQuality| QL[Quality]
    DS -->|hasDataSource| SRC[DataSource]
    DS -->|hasGeoreference| G[Georeference]

    F --> FT[formatType]
    F --> FV[version]

    C --> RT[roadTypes]
    C --> LT[laneTypes]
    C --> TD2[trafficDirection]
    C --> LOD[levelOfDetail]

    Q --> LEN[length]
    Q --> INT[numberIntersections]
    Q --> TL[numberTrafficLights]
    Q --> SPD[speedLimit]

    G -->|hasProjectLocation| PL[ProjectLocation]
    PL --> CC[country]
    PL --> ST[state]
    PL --> CT[city]
    PL -->|hasBoundingBox| BB[BoundingBox]

    style A fill:#848ab7,stroke:#5a6f9f,color:#fff
    style DS fill:#798bb3,stroke:#5a6f9f,color:#fff`}
      />

      <h2>Dataset Coverage</h2>
      <table>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Count</th>
            <th>Examples</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Total assets</td>
            <td>100</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Countries</td>
            <td>27</td>
            <td>DE, US, JP, CN, GB, FR, KR, AU, SG, ...</td>
          </tr>
          <tr>
            <td>Road scenarios</td>
            <td>14</td>
            <td>highway, roundabout, tunnel, bridge, school-zone, ...</td>
          </tr>
          <tr>
            <td>Map formats</td>
            <td>6</td>
            <td>ASAM OpenDRIVE, Lanelet2, NDS.Live, HERE HD Live Map, ...</td>
          </tr>
          <tr>
            <td>Lane types</td>
            <td>7</td>
            <td>driving, shoulder, biking, walking, bus, parking, emergency</td>
          </tr>
        </tbody>
      </table>

      <h2>Turtle (TTL) Format</h2>
      <p>
        Assets are stored in Turtle format — the standard serialization for RDF
        data. Here&apos;s a simplified example:
      </p>
      <pre>
        <code>{`@prefix hdmap: <https://w3id.org/ascs-ev/envited-x/hdmap/v6/> .
@prefix georeference: <https://w3id.org/ascs-ev/envited-x/georeference/v5/> .
@prefix gx: <https://w3id.org/gaia-x/development#> .

<did:web:provider1.net:HdMap:munich-highway-001> a hdmap:HdMap ;
  hdmap:hasResourceDescription [
    gx:name "Munich A9 Highway HD Map" ;
    gx:license "CC-BY-4.0"
  ] ;
  hdmap:hasDomainSpecification [
    hdmap:hasFormat [
      hdmap:formatType "ASAM OpenDRIVE" ;
      hdmap:version "1.6"
    ] ;
    hdmap:hasContent [
      hdmap:roadTypes "motorway" ;
      hdmap:laneTypes "driving" , "shoulder" ;
      hdmap:trafficDirection "right-hand"
    ] ;
    hdmap:hasGeoreference [
      georeference:hasProjectLocation [
        georeference:country "DE" ;
        georeference:state "DE-BY" ;
        georeference:city "Munich"
      ]
    ]
  ] .`}</code>
      </pre>

      <h2>How Data is Loaded</h2>
      <Mermaid
        chart={`sequenceDiagram
    participant S as Server Start
    participant L as loader.ts
    participant F as sample-assets.ttl
    participant O as Oxigraph WASM

    S->>L: First request
    L->>F: readFileSync()
    F-->>L: 223KB TTL string
    L->>O: store.loadTurtle(ttl)
    O-->>L: 100 assets indexed
    Note over O: Ready for SPARQL queries`}
      />

      <h2>Adding More Data</h2>
      <ol>
        <li>
          Edit <code>scripts/generate-test-data.js</code> to add new scenarios
          or countries
        </li>
        <li>
          Run <code>node scripts/generate-test-data.js</code> to regenerate{' '}
          <code>src/lib/data/sample-assets.ttl</code>
        </li>
        <li>Restart the server — data is loaded on first request</li>
      </ol>
      <p>
        For production: connect to an Apache Jena Fuseki endpoint that serves
        the real ENVITED-X registry data via SPARQL protocol.
      </p>
    </>
  )
}
