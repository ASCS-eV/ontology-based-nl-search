'use client'

import { Mermaid } from '@/components/Mermaid'

export default function DocsAgent() {
  return (
    <>
      <h1>Agentic LLM Design</h1>
      <p>
        Instead of generating SPARQL as plain text (fragile, unvalidated), we use an{' '}
        <strong>agentic tool-use pattern</strong> where the LLM communicates exclusively through
        structured tool calls.
      </p>

      <h2>Why Not Naive Prompting?</h2>
      <table>
        <thead>
          <tr>
            <th>Approach</th>
            <th>Pros</th>
            <th>Cons</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Naive text generation</strong>
            </td>
            <td>Simple, one LLM call</td>
            <td>
              No validation, brittle parsing, hallucinated properties, no structured output
              guarantee
            </td>
          </tr>
          <tr>
            <td>
              <strong>Agentic tool-use ✓</strong>
            </td>
            <td>Validated SPARQL, structured output, self-correcting, observable pipeline</td>
            <td>Multiple LLM calls (2–3 typical)</td>
          </tr>
        </tbody>
      </table>

      <h2>Tool-Use Architecture</h2>
      <Mermaid
        chart={`stateDiagram-v2
    [*] --> ReadPrompt: User query arrives
    ReadPrompt --> GenerateQuery: skill.md loaded with vocabulary
    GenerateQuery --> ValidateSPARQL: LLM calls validate_sparql

    state ValidateSPARQL {
      [*] --> Parse
      Parse --> Valid: sparqljs OK
      Parse --> Invalid: syntax error
      Invalid --> ReturnError
    }

    ValidateSPARQL --> ExecuteQuery: valid
    ValidateSPARQL --> GenerateQuery: invalid (retry)
    ExecuteQuery --> SubmitAnswer: results available
    SubmitAnswer --> [*]: structured response returned`}
      />

      <h2>The Tools</h2>

      <h3>
        <code>validate_sparql</code>
      </h3>
      <p>
        Parses the SPARQL query using <code>sparqljs</code> (SPARQL 1.1 compliant parser). Returns
        validity, extracted variables, and error messages if invalid. This is the{' '}
        <strong>quality gate</strong> — syntactically broken queries never reach the store.
      </p>

      <h3>
        <code>execute_sparql</code>
      </h3>
      <p>
        Runs the validated query against the Oxigraph WASM store. Returns result bindings as JSON.
      </p>

      <h3>
        <code>submit_answer</code>
      </h3>
      <p>
        The &quot;return&quot; tool. The LLM calls this with the final structured answer
        (interpretation, gaps, SPARQL, confidence scores). This guarantees a well-typed response
        regardless of LLM behavior.
      </p>

      <h3>
        <code>lookup_ontology_terms</code> (deprecated)
      </h3>
      <p>
        Originally used for the LLM to search the ontology index. Now unnecessary because the full
        vocabulary is embedded directly in <code>skill.md</code>, saving one LLM round-trip.
      </p>

      <h2>skill.md — The Agent&apos;s Brain</h2>
      <p>
        The system prompt (<code>src/lib/llm/agent/skill.md</code>) contains:
      </p>
      <ol>
        <li>Task description and output format specification</li>
        <li>Complete ontology vocabulary (all property paths + allowed values)</li>
        <li>Natural language → ontology term mapping hints</li>
        <li>SPARQL pattern templates</li>
        <li>Constraints (never invent properties, always validate first)</li>
      </ol>

      <div className="not-prose rounded-lg border border-yellow-200 bg-yellow-50 p-4">
        <p className="text-sm text-yellow-800">
          <strong>Design decision:</strong> Embedding the full vocabulary in the system prompt adds
          ~2KB but eliminates one LLM round-trip (the &quot;lookup&quot; step), reducing total
          latency by 30–50%.
        </p>
      </div>

      <h2>Vercel AI SDK Integration</h2>
      <pre>
        <code>{`const result = await generateText({
  model: provider(modelId),
  system: skillPrompt,
  prompt: userQuery,
  tools: { validate_sparql, execute_sparql, submit_answer },
  toolChoice: 'required',
  maxSteps: 5,
})`}</code>
      </pre>
      <p>
        The <code>toolChoice: &apos;required&apos;</code> constraint ensures the LLM never generates
        raw text — it must always call a tool. This gives us predictable, parseable responses every
        time.
      </p>

      <h2>Observability</h2>
      <p>
        Every tool call is logged with timing. The response includes{' '}
        <code>meta.executionTimeMs</code> so users (and developers) can see exactly how long the
        pipeline took. Future work: OpenTelemetry traces for each agent step.
      </p>
    </>
  )
}
