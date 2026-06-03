# @ontology-search/core

Foundation utilities shared by every other package. **Zero workspace
dependencies** — this is the bottom of the dependency layering
(`core ← sparql, ontology ← search ← llm ← apps`).

## Exports

| Subpath          | Purpose                                               |
| ---------------- | ----------------------------------------------------- |
| `./config`       | Zod-validated environment configuration (loaded once) |
| `./logging`      | Structured logger (use instead of `console.log`)      |
| `./errors`       | Typed application error classes                       |
| `./rdf/prefixes` | Shared RDF prefix map (`@zazuko/prefixes`)            |
| `./http/mime`    | MIME-type constants/helpers                           |
| `./sse/events`   | Server-Sent Events type definitions                   |
| `./sse/parser`   | SSE stream parser (client side)                       |
| `./cache/lru`    | Generic LRU cache                                     |

See the [root README](../../README.md) for the overall architecture.
