# @ontology-search/core

> Foundation utilities — Zod config, structured logging, errors, RDF prefixes/IRI helpers, MIME constants, SSE, GraphQL enum helpers, and a generic LRU cache.

**Layer:** the bottom of the dependency layering (`core ← sparql, ontology ← search ← llm ← apps`). **Zero workspace dependencies** — every other package may depend on it, it depends on none.

## Purpose

Shared, dependency-light primitives used across the whole monorepo. It centralises cross-cutting concerns — environment configuration, logging, typed errors, RDF/IRI manipulation, the SSE wire format, and caching — so that no two packages reimplement (and drift on) the same low-level behaviour. Keeping these here, with no workspace dependencies, is what lets the layering above it stay acyclic.

## Public interface

| Subpath          | Purpose                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------- |
| `./config`       | Zod-validated environment configuration, loaded and frozen once at startup                  |
| `./logging`      | Structured logger (use instead of `console.log`) and request `TimingEntry` recording        |
| `./errors`       | Typed application error classes (e.g. `OntologySourcesError`)                               |
| `./graphql/enum` | GraphQL enum-name helpers (`isGraphQLEnumName`, `enumEncodableValues`) shared by web/search |
| `./rdf/prefixes` | Canonical RDF prefix map (`RDF_PREFIXES`, from `@zazuko/prefixes`) and `iri()` builder      |
| `./rdf/iri`      | IRI decomposition (`extractLocalName`, `extractDomain`) — the inverse of `iri()`            |
| `./http/mime`    | MIME-type constants / helpers                                                               |
| `./sse/events`   | Server-Sent Events type definitions (the event names and payload shapes)                    |
| `./sse/parser`   | SSE stream parser (client side)                                                             |
| `./cache/lru`    | Generic LRU cache with optional TTL                                                         |

## Requirements & invariants

- **Zero workspace dependencies.** This package must never import another `@ontology-search/*` package; CI enforces the acyclic layering.
- `./config` validates the environment with Zod at startup and fails fast on invalid input; consumers receive an already-validated, typed config object.
- `RDF_PREFIXES` is the single source of truth for namespace IRIs — the SPARQL policy allowlist and the compiler both derive from it, so they cannot drift.
- GraphQL enum helpers guarantee reversibility: a value is only enum-encodable when it round-trips verbatim to the original slot value.
- Use the structured logger or `console.warn`/`console.error` — `console.log` is disallowed by repo lint rules.

## How to interface

```ts
import { getConfig } from '@ontology-search/core/config'
import { extractLocalName } from '@ontology-search/core/rdf/iri'

const config = getConfig()
const name = extractLocalName('http://example.org/ontology#AssetClass') // "AssetClass"
```

## See also

- [Root README](../../README.md) — overall architecture and the search pipeline.
- [`@ontology-search/sparql`](../sparql/README.md) and [`@ontology-search/ontology`](../ontology/README.md) — the first consumers of this layer.
