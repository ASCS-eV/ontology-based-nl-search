'use client'

import { Mermaid } from '@/components/Mermaid'

export default function DocsOntology() {
  return (
    <>
      <h1>Ontology Integration</h1>
      <p>
        The system uses the <strong>ENVITED-X hdmap v6</strong> ontology from the{' '}
        <a
          href="https://github.com/ASCS-eV/ontology-management-base"
          target="_blank"
          rel="noopener noreferrer"
        >
          ontology-management-base
        </a>{' '}
        repository as the knowledge schema for interpreting user queries.
      </p>

      <h2>Class Hierarchy</h2>
      <Mermaid
        chart={`graph TD
    HM[hdmap:HdMap] --> RD[envited-x:ResourceDescription]
    HM --> DS[hdmap:DomainSpecification]
    DS --> FMT[hdmap:Format]
    DS --> CNT[hdmap:Content]
    DS --> QTY[hdmap:Quantity]
    DS --> QLT[hdmap:Quality]
    DS --> SRC[hdmap:DataSource]
    DS --> GEO[georeference:Georeference]
    GEO --> LOC[georeference:ProjectLocation]
    LOC --> BB[georeference:BoundingBox]
    QTY --> SPD[hdmap:Range2D<br/>speedLimit]

    style HM fill:#848ab7,stroke:#5a6f9f,color:#fff
    style DS fill:#798bb3,stroke:#5a6f9f,color:#fff
    style GEO fill:#f0f9ff,stroke:#798bb3`}
      />

      <h2>Key Properties</h2>

      <h3>Content Properties</h3>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Allowed Values</th>
            <th>NL Mapping</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>hdmap:roadTypes</code>
            </td>
            <td>motorway, rural, town, motorway_entry, custom</td>
            <td>&quot;highway&quot; → motorway, &quot;city&quot; → town</td>
          </tr>
          <tr>
            <td>
              <code>hdmap:laneTypes</code>
            </td>
            <td>driving, shoulder, biking, walking, bus, parking, emergency</td>
            <td>&quot;bike lane&quot; → biking</td>
          </tr>
          <tr>
            <td>
              <code>hdmap:trafficDirection</code>
            </td>
            <td>right-hand, left-hand</td>
            <td>&quot;UK roads&quot; → left-hand</td>
          </tr>
          <tr>
            <td>
              <code>hdmap:levelOfDetail</code>
            </td>
            <td>lane, pole, crosswalk, flat-marking, wall, curb</td>
            <td>&quot;detailed&quot; → crosswalk or pole</td>
          </tr>
        </tbody>
      </table>

      <h3>Format Properties</h3>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Allowed Values</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>hdmap:formatType</code>
            </td>
            <td>ASAM OpenDRIVE, Lanelet2, NDS.Live, HERE HD Live Map, Shape, Road5</td>
          </tr>
          <tr>
            <td>
              <code>hdmap:version</code>
            </td>
            <td>1.4, 1.5, 1.6, 1.7, 1.8 (OpenDRIVE); 1.0, 1.1 (Lanelet2); etc.</td>
          </tr>
        </tbody>
      </table>

      <h3>Georeference Properties</h3>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Type</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>georeference:country</code>
            </td>
            <td>ISO 3166-1 alpha-2</td>
            <td>DE, US, JP, GB</td>
          </tr>
          <tr>
            <td>
              <code>georeference:state</code>
            </td>
            <td>ISO 3166-2</td>
            <td>DE-BY, US-CA</td>
          </tr>
          <tr>
            <td>
              <code>georeference:city</code>
            </td>
            <td>String</td>
            <td>Munich, Tokyo</td>
          </tr>
        </tbody>
      </table>

      <h2>How the Ontology Guides the LLM</h2>
      <p>
        The complete vocabulary is embedded in <code>skill.md</code> — the agent&apos;s system
        prompt. This means the LLM knows:
      </p>
      <ol>
        <li>
          All valid property paths (e.g., <code>hdmap:hasContent/hdmap:roadTypes</code>)
        </li>
        <li>All allowed values for each property</li>
        <li>Natural language → ontology term mappings</li>
        <li>The SPARQL patterns needed to query each property</li>
      </ol>

      <h2>Example Triple</h2>
      <pre>
        <code>{`<did:web:provider1.net:HdMap:munich-highway-001> a hdmap:HdMap ;
  rdfs:label "Munich Highway HD Map"@en ;
  hdmap:hasDomainSpecification [
    a hdmap:DomainSpecification ;
    hdmap:hasFormat [
      a hdmap:Format ;
      hdmap:formatType "ASAM OpenDRIVE" ;
      hdmap:version "1.6"
    ] ;
    hdmap:hasContent [
      a hdmap:Content ;
      hdmap:roadTypes "motorway" ;
      hdmap:laneTypes "driving" , "shoulder" ;
      hdmap:trafficDirection "right-hand"
    ]
  ] .`}</code>
      </pre>

      <h2>Ontology Gap Detection</h2>
      <p>
        When users search for concepts not in the ontology (e.g., &quot;roundabout with cats&quot;),
        the system identifies these gaps and reports them. This provides valuable feedback for
        ontology evolution — highlighting what real users expect but the schema doesn&apos;t yet
        cover.
      </p>

      <Mermaid
        chart={`graph LR
    U[User Query] --> M{Mapped?}
    M -->|Yes| T[Ontology Term<br/>+ Confidence]
    M -->|No| G[Gap Detected<br/>+ Suggestion]
    G --> F[Feedback for<br/>Ontology Improvement]

    style T fill:#f0fdf4,stroke:#22c55e
    style G fill:#fef3c7,stroke:#f59e0b
    style F fill:#f0f9ff,stroke:#798bb3`}
      />
    </>
  )
}
