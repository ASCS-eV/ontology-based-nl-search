/**
 * Back-compat re-export. The Zod slot wire schemas moved to the leaf package
 * `@ontology-search/slots` (ADR 0003, decomposition step 2). This file keeps
 * the `@ontology-search/search/slot-wire-schema` subpath working unchanged;
 * consumers may import from `@ontology-search/slots/slot-wire-schema` directly.
 */
export * from '@ontology-search/slots/slot-wire-schema'
