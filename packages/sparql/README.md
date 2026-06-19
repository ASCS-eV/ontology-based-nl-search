# @ontology-search/sparql

> SPARQL execution and security layer — Oxigraph WASM (in a worker thread) or a remote store, behind an LRU cache, plus the query policy gate and literal escaping.

**Layer:** sits just above `core` (`core ← sparql, ontology ← search ← llm ← apps`). Depends only on `@ontology-search/core`.

## Purpose

Provides a single `SparqlStore` abstraction over either an in-memory Oxigraph WASM engine — run in a dedicated **worker thread** so synchronous WASM queries never block the event loop — or a remote SPARQL endpoint (e.g. Fuseki), wrapped in an LRU query cache. It also owns the project's two lines of defence against SPARQL injection: the policy gate that allow-lists what may execute, and the escaping primitives that keep compiler-generated literals well-formed.

## Public interface

| Subpath    | Purpose                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `.`        | `getSparqlStore()` singleton factory — picks in-memory worker or remote store from config, wrapped in an LRU cache |
| `./types`  | `SparqlStore` interface and query-result types                                                                     |
| `./policy` | `enforceSparqlPolicy` / `registerPolicyNamespaces` — the query allow-list / sandbox gate                           |
| `./escape` | Literal- and IRI-escaping helpers for safe SPARQL construction                                                     |

## Requirements & invariants

- **Security-critical:** the policy gate is the sandbox boundary. The compiler must never emit SPARQL the gate would reject, and the gate's allowed prefixes derive from `core`'s `RDF_PREFIXES` plus ontology namespaces registered at warmup — so the allowlist cannot drift from the IRIs the compiler emits.
- Escaping follows the SPARQL 1.1 grammar (`STRING_LITERAL2`, `IRIREF`) and is the inner defence; it ensures generated queries are well-formed in the first place.
- `getSparqlStore()` is a process-wide singleton; the choice of in-memory vs. remote comes from validated config (`SPARQL_MODE`, `SPARQL_ENDPOINT`, cache size/TTL).
- WASM queries are executed off the main thread; callers must treat the store as async.
- Depends only on `@ontology-search/core`.

## How to interface

```ts
import { getSparqlStore } from '@ontology-search/sparql'

const store = getSparqlStore()
const rows = await store.query('SELECT * WHERE { ?s ?p ?o } LIMIT 10')
```

## See also

- [Root README](../../README.md) — the search pipeline and the "LLM never writes SPARQL" security model.
- [`@ontology-search/core`](../core/README.md) — config and `RDF_PREFIXES` it builds on.
- SPARQL reference docs under `apps/docs/`.
