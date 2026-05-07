'use client'

import { Mermaid } from '@/components/Mermaid'

export default function DocsArchitecture() {
  return (
    <>
      <h1>System Architecture</h1>
      <p>
        The system follows a layered architecture with clear separation between
        the UI, AI agent, and knowledge graph layers.
      </p>

      <h2>High-Level Overview</h2>
      <Mermaid
        chart={`graph TB
    subgraph Client["Browser (React)"]
      UI[Search UI]
      HR[History & Export]
    end

    subgraph Server["Next.js API Routes"]
      API["/api/search"]
      STATS["/api/stats"]
    end

    subgraph Agent["LLM Agent Layer"]
      SK[skill.md<br/>System Prompt]
      LLM[LLM Provider<br/>Copilot / Ollama]
      T1[validate_sparql]
      T2[execute_sparql]
      T3[submit_answer]
    end

    subgraph Data["Knowledge Graph"]
      OX[Oxigraph WASM]
      TTL[Sample Assets<br/>100 HD Maps]
      ONT[hdmap v6 Ontology]
    end

    UI -->|POST /api/search| API
    UI -->|GET /api/stats| STATS
    API --> SK
    SK --> LLM
    LLM -->|tool call| T1
    LLM -->|tool call| T2
    LLM -->|tool call| T3
    T1 -->|sparqljs parser| T1
    T2 --> OX
    OX --- TTL
    OX --- ONT
    STATS --> OX

    style Client fill:#f0f9ff,stroke:#798bb3
    style Agent fill:#f5f3ff,stroke:#848ab7
    style Data fill:#f0fdf4,stroke:#22c55e`}
      />

      <h2>Component Responsibilities</h2>

      <h3>Frontend (Client)</h3>
      <ul>
        <li>React SPA with server-rendered initial page load</li>
        <li>Search bar with query history (localStorage)</li>
        <li>Progressive disclosure: interpretation → gaps → SPARQL → results</li>
        <li>Export to CSV / JSON-LD</li>
      </ul>

      <h3>API Layer (Next.js Route Handlers)</h3>
      <ul>
        <li>
          <code>POST /api/search</code> — Receives NL query, invokes agent,
          returns structured response
        </li>
        <li>
          <code>GET /api/stats</code> — Returns total asset count from graph
        </li>
      </ul>

      <h3>LLM Agent</h3>
      <ul>
        <li>System prompt with full ontology vocabulary embedded</li>
        <li>
          Tool-calling loop using Vercel AI SDK (<code>generateText</code> +{' '}
          <code>tools</code>)
        </li>
        <li>Max 5 steps to prevent runaway loops</li>
        <li>Structured output via <code>submit_answer</code> tool</li>
      </ul>

      <h3>Knowledge Graph</h3>
      <ul>
        <li>Oxigraph WASM store loaded at first request</li>
        <li>100 diverse HD map assets in Turtle (TTL) format</li>
        <li>SPARQL 1.1 query execution</li>
        <li>Production path: Apache Jena Fuseki (remote SPARQL endpoint)</li>
      </ul>

      <h2>Deployment Modes</h2>
      <Mermaid
        chart={`graph LR
    subgraph Dev["Development (Default)"]
      D1[Ollama local LLM]
      D2[Oxigraph WASM in-memory]
      D3[Sample TTL data]
    end

    subgraph Enterprise["Enterprise"]
      E1[Copilot SDK via CLI]
      E2[Apache Jena Fuseki]
      E3[ENVITED-X Registry]
    end

    style Dev fill:#f0fdf4,stroke:#22c55e
    style Enterprise fill:#f0f9ff,stroke:#798bb3`}
      />
    </>
  )
}
