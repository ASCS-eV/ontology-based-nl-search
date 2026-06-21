# @ontology-search/api-types

> HTTP-boundary wire types shared between the API server and the web client.

**Layer:** a leaf contract package with **zero workspace dependencies** — browser-safe, imported by both `apps/api` and `apps/web` without coupling them (`core ← sparql, ontology ← search ← llm ← apps`).

## Purpose

The single source of truth for the request/response/SSE-event JSON shapes that cross the network boundary between the API server (`apps/api`) and the web client (`apps/web`). Keeping these declarations in their own dependency-free package lets both sides type-check against the exact same contract — the web app cannot transitively pull in Oxigraph WASM, Node `fs`, or the SHACL validator — so drift between client and server is impossible by construction.

## Public interface

| Subpath | Purpose                                                                                                                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`     | All wire types — `SearchResponse`, `RefineResponse`, `StatsResponse`, `TraceabilityResponse`, `AssetMetadata`, `DomainGroupAggregate`, SSE `SearchMeta`/`TimingEntry`, `OntologyGap`/`GapKind`, `QueryInterpretation`, and supporting row/trace types |

## Requirements & invariants

- **Zero workspace dependencies — browser-safe.** Must never import another `@ontology-search/*` package or any Node-only/server-only code.
- These are wire-format types only; they carry no ontology-specific identifiers, so the ontology-name budget (criterion 9b) does not apply.
- The shapes are exchanged as `[RFC8259]` JSON over `[RFC9110]` HTTP, with the streaming search results delivered as `[SSE]` `data:` frames; field changes here are observable on the wire and must stay backward-compatible (e.g. `OntologyGap.kind` defaults to `unmapped` when absent).
- Server-internal extensions re-use these types as their HTTP surface rather than redefining them.

## How to interface

```ts
import type { SearchResponse, OntologyGap } from '@ontology-search/api-types'

function renderGaps(res: SearchResponse): OntologyGap[] {
  return res.gaps
}
```

## See also

- [Root README](../../README.md) — the SSE streaming search flow these types describe.
- `apps/api` (producer) and `apps/web` (consumer) — both sides of this contract.
