/**
 * Eval cases authored against the shipped ENVITED-X ontology set.
 *
 * This is FIXTURE DATA, not production code — naming real domains and
 * properties here is what grounds the eval (CLAUDE.md ontology-name
 * budget: tests may). Gating cases phrase queries with schema terminology
 * a motivated user would type; diagnostic cases capture synonym-heavy
 * phrasings the pure lexical ranker is not yet expected to resolve, so
 * their scores document the gap an embedding provider would close.
 */
import type { EvalCase } from './retrieval-eval.js'

export const ENVITED_EVAL_CASES: EvalCase[] = [
  {
    name: 'enum property + value',
    query: 'road types motorway',
    expectedDomains: ['hdmap'],
    expectedProperties: ['roadTypes'],
    gating: true,
  },
  {
    name: 'enum value only',
    query: 'maps with motorway sections',
    expectedDomains: ['hdmap'],
    expectedProperties: ['roadTypes'],
    gating: true,
  },
  {
    name: 'numeric property',
    query: 'number of intersections at least 5',
    expectedDomains: [],
    expectedProperties: ['numberIntersections'],
    gating: true,
  },
  {
    name: 'geo reference property',
    query: 'EPSG code 32632',
    expectedDomains: [],
    expectedProperties: ['codeEPSG'],
    gating: true,
  },
  {
    name: 'country filter',
    query: 'assets with country DE',
    expectedDomains: [],
    expectedProperties: ['country'],
    gating: true,
  },
  // ── Diagnostics: synonym phrasings, no schema terms ──────────────────────
  {
    name: 'synonyms: highways',
    query: 'German highways with 3 lanes',
    expectedDomains: ['hdmap'],
    expectedProperties: ['roadTypes', 'country'],
    gating: false,
  },
  {
    name: 'synonyms: rainy scenarios',
    query: 'rainy driving scenarios',
    expectedDomains: ['scenario'],
    expectedProperties: [],
    gating: false,
  },
  {
    name: 'synonyms: sensor recordings',
    query: 'sensor recordings from test drives',
    expectedDomains: ['ositrace'],
    expectedProperties: [],
    gating: false,
  },
]
