'use client'

import { Mermaid } from '@/components/Mermaid'

export default function DocsFlow() {
  return (
    <>
      <h1>Query Flow</h1>
      <p>
        When a user submits a natural language query, it passes through a multi-step agentic
        pipeline before results are returned.
      </p>

      <h2>Sequence Diagram</h2>
      <Mermaid
        chart={`sequenceDiagram
    participant U as User
    participant UI as React UI
    participant API as /api/search
    participant Agent as LLM Agent
    participant LLM as AI Model
    participant Val as validate_sparql
    participant Exec as execute_sparql
    participant Sub as submit_answer

    U->>UI: Types NL query
    UI->>API: POST {query}
    API->>Agent: generateStructuredSearch(query)
    Agent->>LLM: System prompt + user query

    Note over LLM: Agent reads skill.md with<br/>full ontology vocabulary

    LLM->>Val: tool call: validate_sparql(query)
    Val-->>LLM: {valid: true, variables: [...]}

    LLM->>Exec: tool call: execute_sparql(query)
    Exec-->>LLM: {results: [...], count: N}

    LLM->>Sub: tool call: submit_answer(structured)
    Sub-->>Agent: Final structured response

    Agent-->>API: SearchResponse
    API-->>UI: JSON response
    UI-->>U: Render interpretation + results`}
      />

      <h2>Step-by-Step Breakdown</h2>

      <h3>1. Query Submission</h3>
      <p>
        The user types a query like{' '}
        <em>&quot;German highway with 3 lanes in OpenDRIVE format&quot;</em>. The React frontend
        sends this to the API route.
      </p>

      <h3>2. Agent Initialization</h3>
      <p>
        The agent loads <code>skill.md</code> as the system prompt. This contains the complete hdmap
        v6 vocabulary — all property paths, allowed values, and natural language mapping hints. This
        eliminates the need for a separate &quot;lookup&quot; step.
      </p>

      <h3>3. SPARQL Generation &amp; Validation</h3>
      <p>
        The LLM generates a SPARQL query based on its understanding of the ontology and calls{' '}
        <code>validate_sparql</code>. The sparqljs parser checks syntax. If invalid, the LLM gets
        error feedback and retries.
      </p>

      <h3>4. Query Execution</h3>
      <p>
        Once validated, <code>execute_sparql</code> runs the query against the Oxigraph store and
        returns matching triples.
      </p>

      <h3>5. Structured Answer</h3>
      <p>
        The LLM calls <code>submit_answer</code> with the final structured response including:
      </p>
      <ul>
        <li>Mapped terms (user concept → ontology property, with confidence)</li>
        <li>Ontology gaps (concepts not found in schema)</li>
        <li>The validated SPARQL query</li>
        <li>Formatted results</li>
      </ul>

      <h2>Error Handling</h2>
      <Mermaid
        chart={`stateDiagram-v2
    [*] --> GenerateSPARQL
    GenerateSPARQL --> Validate
    Validate --> Execute: valid
    Validate --> GenerateSPARQL: invalid (retry)
    Execute --> Submit: results
    Execute --> Submit: empty results
    Submit --> [*]

    note right of Validate: sparqljs parser\\nchecks syntax
    note right of Execute: Oxigraph WASM\\nruns SPARQL 1.1`}
      />

      <h2>Performance Characteristics</h2>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Typical Duration</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>LLM inference (per step)</td>
            <td>3–8s</td>
            <td>Depends on model and provider</td>
          </tr>
          <tr>
            <td>SPARQL validation</td>
            <td>&lt;5ms</td>
            <td>Local sparqljs parse</td>
          </tr>
          <tr>
            <td>SPARQL execution</td>
            <td>&lt;50ms</td>
            <td>Oxigraph WASM, 100 assets</td>
          </tr>
          <tr>
            <td>Total (optimized, 2 steps)</td>
            <td>8–15s</td>
            <td>validate + submit</td>
          </tr>
        </tbody>
      </table>
    </>
  )
}
