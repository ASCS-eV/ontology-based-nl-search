# @ontology-search/api-types

HTTP-boundary wire types shared between the API server (`apps/api`) and the web
client (`apps/web`). **Zero workspace dependencies — browser-safe**, so the
frontend can import the contract without pulling in any server-only code.

This is the single source of truth for the request/response/SSE-event shapes
that cross the network boundary. Keeping it dependency-free is what lets both
sides type-check against the same contract without coupling.

## Exports

| Subpath | Purpose                                           |
| ------- | ------------------------------------------------- |
| `.`     | All wire types (search, refine, SSE events, gaps) |
