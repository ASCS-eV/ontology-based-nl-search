'use client'

import { Mermaid } from '@/components/Mermaid'

export default function DocsOverview() {
  return (
    <>
      <h1>Ontology-Based Natural Language Search</h1>

      <div className="not-prose rounded-lg border border-blue-100 bg-blue-50 p-4 mb-6">
        <p className="text-sm text-blue-900">
          <strong>Proof of Concept</strong> — Demonstrating how ontology-guided AI can bridge the
          gap between natural language and structured simulation asset metadata in the ENVITED-X
          Data Space.
        </p>
      </div>

      <h2>What is this?</h2>
      <p>
        This tool allows users to search for HD map simulation assets using plain language. Instead
        of requiring users to know SPARQL query syntax or the exact structure of the ENVITED-X
        metadata schema, an AI agent translates natural language into precise SPARQL queries.
      </p>

      <h2>Why does it matter?</h2>
      <p>
        The ENVITED-X Data Space contains simulation assets described with rich, ontology-based
        metadata (road types, lane configurations, geographic locations, quality measures, etc.).
        However, this metadata is only useful if users can actually query it effectively.
      </p>

      <Mermaid
        chart={`graph LR
    A[User: Natural Language] --> B[AI Agent]
    B --> C[SPARQL Query]
    C --> D[Knowledge Graph]
    D --> E[Matching Assets]
    style A fill:#f0f9ff,stroke:#798bb3
    style B fill:#848ab7,stroke:#5a6f9f,color:#fff
    style E fill:#f0fdf4,stroke:#22c55e`}
      />

      <h2>Key Capabilities</h2>
      <ul>
        <li>
          <strong>Ontology-aware interpretation</strong> — Maps user concepts to ontology terms with
          confidence scoring
        </li>
        <li>
          <strong>Gap detection</strong> — Identifies concepts the user asked about that don&apos;t
          exist in the ontology (feedback for ontology improvement)
        </li>
        <li>
          <strong>SPARQL generation &amp; validation</strong> — Generates syntactically valid SPARQL
          1.1 queries with automated validation
        </li>
        <li>
          <strong>Agentic tool-use</strong> — LLM uses structured tools rather than generating
          free-form text
        </li>
        <li>
          <strong>Export</strong> — Results exportable as CSV or JSON-LD
        </li>
      </ul>

      <h2>Target Audience</h2>
      <p>
        Simulation engineers, data consumers, and CCAM researchers who need to find specific HD map
        assets within a growing catalogue of ENVITED-X simulation resources — without needing to
        understand RDF, SPARQL, or the underlying ontology structure.
      </p>

      <h2>Technology Stack</h2>
      <table>
        <thead>
          <tr>
            <th>Layer</th>
            <th>Technology</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Frontend</td>
            <td>Next.js 14, React 18, TailwindCSS</td>
          </tr>
          <tr>
            <td>LLM</td>
            <td>Vercel AI SDK + Copilot SDK (enterprise) / Ollama (local)</td>
          </tr>
          <tr>
            <td>Knowledge Graph</td>
            <td>Oxigraph (WASM, in-memory) / Apache Jena Fuseki (production)</td>
          </tr>
          <tr>
            <td>Ontology</td>
            <td>ENVITED-X hdmap v6 (from ontology-management-base)</td>
          </tr>
          <tr>
            <td>Validation</td>
            <td>sparqljs (SPARQL 1.1 parser)</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}
