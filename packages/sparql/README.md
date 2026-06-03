# @ontology-search/sparql

SPARQL execution and security layer. Provides a single `SparqlStore`
abstraction over an in-memory Oxigraph WASM engine (run in a dedicated
**worker thread** so synchronous WASM queries never block the event loop)
or a remote SPARQL endpoint (e.g. Fuseki), wrapped in an LRU query cache.

**Layer:** depends only on `@ontology-search/core`.

## Exports

| Subpath    | Purpose                                                              |
| ---------- | -------------------------------------------------------------------- |
| `.`        | `getSparqlStore()` singleton factory (in-memory or remote by config) |
| `./types`  | `SparqlStore` interface and query result types                       |
| `./policy` | `enforceSparqlPolicy` — the query allow-list / sandbox gate          |
| `./escape` | Literal-escaping helpers for safe query construction                 |

The policy gate is security-critical: the compiler must never emit SPARQL
the gate would reject. See the [SPARQL reference](../../apps/docs/sparql-reference).
