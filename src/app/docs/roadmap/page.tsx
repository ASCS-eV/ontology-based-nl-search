'use client'

import { Mermaid } from '@/components/Mermaid'

export default function DocsRoadmap() {
  return (
    <>
      <h1>Roadmap &amp; Next Steps</h1>

      <h2>What This POC Proves</h2>
      <div className="not-prose grid gap-4 sm:grid-cols-2 my-6">
        {[
          {
            title: 'NL → SPARQL Translation',
            desc: 'LLMs can reliably generate valid SPARQL from natural language when guided by ontology context.',
          },
          {
            title: 'Ontology-Guided AI',
            desc: 'Embedding the full vocabulary in the system prompt gives the LLM precise knowledge without extra lookups.',
          },
          {
            title: 'Quality Gates',
            desc: 'SPARQL validation as a tool ensures only syntactically correct queries reach the store.',
          },
          {
            title: 'Gap Detection',
            desc: 'The system identifies when users search for concepts not in the ontology — feedback for schema evolution.',
          },
          {
            title: 'Agentic Reliability',
            desc: 'Tool-use patterns produce structured, predictable output vs. fragile text parsing.',
          },
          {
            title: 'Enterprise Integration',
            desc: 'Works with enterprise LLM providers (Copilot SDK) and local models (Ollama) interchangeably.',
          },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
            <p className="text-sm text-gray-600">{item.desc}</p>
          </div>
        ))}
      </div>

      <h2>Production Integration Path</h2>
      <Mermaid
        chart={`graph LR
    subgraph POC["Current POC"]
      P1[Oxigraph WASM]
      P2[100 sample assets]
      P3[Copilot SDK / Ollama]
    end

    subgraph Production["Production Target"]
      T1[Apache Jena Fuseki]
      T2[ENVITED-X Registry<br/>real assets]
      T3[Enterprise LLM API]
      T4[SSO / OIDC Auth]
      T5[Streaming responses]
    end

    P1 -.->|replace| T1
    P2 -.->|connect| T2
    P3 -.->|configure| T3

    style POC fill:#fef3c7,stroke:#f59e0b
    style Production fill:#f0fdf4,stroke:#22c55e`}
      />

      <h2>Short-Term (Next Sprint)</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
            <th>Impact</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Streaming API</td>
            <td>Progressive disclosure — show interpretation while SPARQL executes</td>
            <td>Better perceived performance</td>
          </tr>
          <tr>
            <td>Query refinement</td>
            <td>Allow users to edit the interpreted query and re-run</td>
            <td>User control</td>
          </tr>
          <tr>
            <td>Apache Jena connector</td>
            <td>SPARQL Protocol client for remote Fuseki endpoint</td>
            <td>Production data source</td>
          </tr>
          <tr>
            <td>More ontologies</td>
            <td>Add scenario, environment, vehicle ontologies from OMB</td>
            <td>Broader search scope</td>
          </tr>
        </tbody>
      </table>

      <h2>Medium-Term</h2>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>OIDC authentication</td>
            <td>Integrate with ENVITED-X identity provider for access control</td>
          </tr>
          <tr>
            <td>Query analytics</td>
            <td>Track what users search for, identify frequent gaps → ontology improvement</td>
          </tr>
          <tr>
            <td>Faceted search</td>
            <td>Combine NL with structured filters (country dropdown, format picker)</td>
          </tr>
          <tr>
            <td>Asset preview</td>
            <td>Show map thumbnail / 3D preview for matching assets</td>
          </tr>
          <tr>
            <td>Multi-ontology</td>
            <td>Search across HD maps, scenarios, sensor models simultaneously</td>
          </tr>
        </tbody>
      </table>

      <h2>Long-Term Vision</h2>
      <Mermaid
        chart={`graph TD
    subgraph DataSpace["ENVITED-X Data Space"]
      REG[Asset Registry]
      ONT[Ontology Management]
      NLS[NL Search Service]
      AUTH[Identity & Access]
    end

    subgraph Users["Users"]
      ENG[Simulation Engineers]
      RES[Researchers]
      OEM[OEM Partners]
    end

    subgraph AI["AI Layer"]
      LLM[Enterprise LLM]
      EMB[Embeddings Index]
      FB[Feedback Loop]
    end

    ENG --> NLS
    RES --> NLS
    OEM --> NLS
    NLS --> REG
    NLS --> LLM
    LLM --> ONT
    NLS --> FB
    FB --> ONT

    style DataSpace fill:#f0f9ff,stroke:#798bb3
    style AI fill:#f5f3ff,stroke:#848ab7`}
      />

      <h2>Integration with SYNERGIES</h2>
      <p>
        As part of the SYNERGIES project, this tool contributes to the
        <strong> federated Scenario Dataspace</strong> by demonstrating how
        ontology-based metadata can be made searchable through AI. The approach
        can be extended to:
      </p>
      <ul>
        <li>Scenario databases across European partners</li>
        <li>Cross-domain asset discovery (maps + scenarios + sensor data)</li>
        <li>Standardized metadata quality feedback loops</li>
      </ul>
    </>
  )
}
