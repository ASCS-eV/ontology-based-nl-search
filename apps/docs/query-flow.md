# Query Flow

## Overview

The search pipeline processes a natural language query through several stages, streaming results progressively.

## Phases

### 1. Interpretation

The LLM agent receives:

- The user's natural language query
- Ontology context (SKOS labels, SHACL property descriptions)
- Domain vocabulary (allowed values, glossary definitions)

It produces structured **SearchSlots**:

```json
{
  "domains": ["hdmap"],
  "filters": { "roadTypes": "motorway", "country": "DE" },
  "ranges": { "laneCount": { "min": 3 } },
  "location": { "country": "DE" }
}
```

### 2. Concept Matching

Each user term is matched against:

- SKOS `prefLabel` / `altLabel` (exact + fuzzy)
- Vocabulary index (SHACL `sh:in` values)
- Glossary definitions

Unmatched terms become **ontology gaps** — reported to the user.

### 3. Slot Compilation

The compiler takes SearchSlots and produces SPARQL:

- Deterministic — same input always produces same output
- Validated — only uses known properties and values
- Optimized — leverages graph patterns efficiently

### 4. Execution

SPARQL runs against the in-memory Oxigraph store:

- Pre-loaded with domain RDF data (TTL files)
- Cached query results for repeated queries
- Result count tracked for statistics

### 5. Streaming Response

Results are sent as Server-Sent Events (SSE):

```
event: status      → { phase: "interpreting" }
event: interpretation → { summary, mappedTerms }
event: gaps        → [{ term, reason, suggestions }]
event: sparql      → "SELECT ..."
event: status      → { phase: "executing" }
event: results     → { results: [...], error?: string }
event: meta        → { matchCount, executionTimeMs }
event: done        → {}
```
