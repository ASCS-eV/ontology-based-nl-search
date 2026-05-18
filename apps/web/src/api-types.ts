/**
 * HTTP-boundary wire types re-exported from `@ontology-search/api-types`.
 *
 * The web client must not import from `@ontology-search/search` directly
 * (that package transitively pulls in Oxigraph WASM, Node `fs`, and the
 * SHACL validator). Going through the browser-safe `api-types` package
 * keeps the server and client on identical type declarations without
 * dragging server runtimes into the bundle.
 *
 * This file is intentionally a thin shim. New wire fields belong in
 * `packages/api-types/src/index.ts` — adding them here would
 * re-introduce drift between the server and client type declarations.
 */
export type {
  MappedTerm,
  OntologyGap,
  QueryInterpretation,
  ResultRow,
  SearchMeta,
  SearchResponse,
  StatsResponse,
  TimingEntry,
} from '@ontology-search/api-types'
