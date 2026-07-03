/**
 * Back-compat re-export. The slot IR moved to its own leaf package
 * `@ontology-search/slots` (ADR 0003, decomposition step 2). This file keeps
 * the `@ontology-search/search/slots` subpath and the intra-package
 * `./slots.js` imports working unchanged; consumers may import from
 * `@ontology-search/slots/slots` directly.
 */
export * from '@ontology-search/slots/slots'
