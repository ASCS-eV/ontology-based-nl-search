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

Each contract below is guarded by a named test. The first rows are repo-wide policy gates (`src/__tests__/repo-policy.test.ts`) that statically scan all production source; the rest are unit tests local to each module. This package is the bottom of the dependency layering, so its invariants underpin every package above it.

| #   | Requirement / invariant                                                                                                                         | Guarded by                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Zero workspace dependencies** — never imports another `@ontology-search/*` package                                                            | `scripts/check-layers.mjs` layer gate (`@ontology-search/core` ranked at layer 1; cross-package layering isn't an in-package unit test)           |
| C2  | **No intra-package import cycle** — the relative-import graph of every package is acyclic                                                       | `src/__tests__/repo-policy.test.ts` ("C6 — no intra-package circular dependency")                                                                 |
| C3  | **No `console.*` outside the structured logger** — every production `console.*` is in the logger or annotated/exempt                            | `src/__tests__/repo-policy.test.ts` ("C12 — no console.\* outside structured logger")                                                             |
| C4  | **`RDF_PREFIXES` is the single source of truth** — no inline W3C namespace IRI elsewhere in source                                              | `src/__tests__/repo-policy.test.ts` ("C3 — no inline W3C namespace IRI outside core/rdf/prefixes")                                                |
| C5  | **Config validates with Zod and fails fast** — invalid env (bad enum, non-positive int) throws before any consumer runs                         | `src/config/__tests__/config.test.ts` ("throws on invalid SPARQL_MODE", "rejects non-positive integers for the numeric keys")                     |
| C6  | **Config cross-field guards** — `remote` requires `SPARQL_ENDPOINT`; default limit ≤ max limit                                                  | `src/config/__tests__/config.test.ts` ("throws when remote mode lacks endpoint")                                                                  |
| C7  | **Fail-safe production posture** — prod + CORS `*` is rejected; prod with no `API_KEY`/opt-out refuses to start                                 | `src/config/__tests__/config.test.ts` ("rejects CORS_ALLOWED_ORIGINS=\"\*\" in production"; "refuses to start in production with no API_KEY…")    |
| C8  | **Config is parsed once and cached** — `getConfig()` returns the same frozen object on repeat calls                                             | `src/config/__tests__/config.test.ts` ("caches config after first call")                                                                          |
| C9  | **GraphQL enum reversibility** — a value is enum-encodable only if it is a valid, non-reserved GraphQL Name (round-trips)                       | `src/__tests__/graphql-enum.test.ts` ("isGraphQLEnumName", "enumEncodableValues")                                                                 |
| C10 | **IRI decomposition is the inverse of `iri()`** — `extractLocalName`/`extractDomain` split hash & versioned-path IRIs                           | `src/rdf/__tests__/iri.test.ts` ("extractLocalName", "extractDomain")                                                                             |
| C11 | **HTTP status derives from the error class, not the message** — rewording a message can't change the wire status/code                           | `src/errors/__tests__/errors.test.ts` ("derives httpStatus from class, not message content")                                                      |
| C12 | **`SSE_EVENT` / `MIME` are single sources of truth** — exact map shapes shared by producer and consumer                                         | `src/sse/__tests__/events.test.ts`, `src/http/__tests__/mime.test.ts`                                                                             |
| C13 | **SSE parsing is resilient** — a malformed `data:` line is dropped (warned) without killing the stream; pending events survive chunk boundaries | `src/sse/__tests__/parser.test.ts` ("drops a malformed JSON data line and continues parsing"; "preserves pending event across buffer boundaries") |
| C14 | **LRU cache is hard-bounded with LRU eviction and optional TTL** — overflow evicts least-recently-used; TTL evicts on read                      | `src/cache/__tests__/lru.test.ts` ("evicts the least-recently-used entry on overflow"; "treats entries older than ttlMs as misses on read")       |
| C15 | **Structured logger emits machine-parseable JSON with correlation IDs and level filtering**                                                     | `src/logging/__tests__/logging.test.ts` ("emits structured JSON when log level allows"; "suppresses logs below configured level")                 |

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
