/**
 * SPARQL store capability probe.
 *
 * The compiler emits SPARQL 1.1 property-path expressions
 * (`rdfs:subClassOf*`, `skos:broaderTransitive*`) to expand
 * hierarchical filter values to their subclasses. Stores that do not
 * honour property paths will silently return only the literal value
 * — a "broad" query like "give me all vehicles" then comes back
 * empty even when subclasses are present in the data.
 *
 * This probe runs a tiny SELECT with a `rdfs:subClassOf*` term at
 * startup. If the store rejects the query or returns no bindings for
 * a graph that DOES contain a reflexive `rdfs:subClassOf` self-edge
 * (which property paths must yield by definition), we throw a
 * {@link StoreCapabilityError} so the operator sees a loud,
 * actionable failure instead of debugging silent empty results.
 *
 * @see https://www.w3.org/TR/sparql11-query/#propertypaths
 */
import { StoreCapabilityError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'

import type { SparqlStore } from './types.js'

const log = createComponentLogger('capability-probe')

/** Marker IRI loaded into the probe's named graph so we own every triple it queries. */
const PROBE_GRAPH = 'urn:graph:capability-probe'
const PROBE_CLASS_A = 'urn:probe:ClassA'
const PROBE_CLASS_B = 'urn:probe:ClassB'

const PROBE_TURTLE = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<${PROBE_CLASS_B}> rdfs:subClassOf <${PROBE_CLASS_A}> .
`

/**
 * Run the property-path probe against `store`.
 *
 * Loads a 2-class hierarchy into a dedicated named graph, runs
 * `?x rdfs:subClassOf* <ClassA>` and expects to bind both A and B.
 * Anything else (rejected query, zero bindings, only A) is treated as
 * a capability mismatch.
 *
 * The probe graph is loaded once per call and is intentionally NOT
 * cleaned up afterwards — the marker IRIs (`urn:probe:*`) live in
 * `urn:graph:capability-probe` and never appear in real search
 * patterns. Re-running the probe is idempotent.
 *
 * @throws StoreCapabilityError when the store rejects property paths
 *         or returns the wrong cardinality of bindings.
 */
export async function probePropertyPathSupport(store: SparqlStore): Promise<void> {
  try {
    await store.loadTurtle(PROBE_TURTLE, PROBE_GRAPH)
  } catch (cause) {
    throw new StoreCapabilityError(
      `SPARQL store rejected the property-path probe data load: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause }
    )
  }

  const query = `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?cls WHERE {
      GRAPH <${PROBE_GRAPH}> {
        ?cls rdfs:subClassOf* <${PROBE_CLASS_A}> .
      }
    }
  `

  let result
  try {
    result = await store.query(query)
  } catch (cause) {
    throw new StoreCapabilityError(
      `SPARQL store rejected the property-path probe query (rdfs:subClassOf*). ` +
        `The compiler emits property-path expressions for hierarchical filter ` +
        `expansion — a store without property-path support silently returns ` +
        `empty results for broad queries. ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
      { cause }
    )
  }

  const bound = new Set<string>()
  for (const row of result.results.bindings) {
    const cls = row['cls']?.value
    if (cls) bound.add(cls)
  }

  // The reflexive-transitive closure must include both A (the term
  // itself) and B (the subclass). Anything less means the store is
  // not honouring the `*` operator.
  if (!bound.has(PROBE_CLASS_A) || !bound.has(PROBE_CLASS_B)) {
    throw new StoreCapabilityError(
      `SPARQL store does not support rdfs:subClassOf* property paths. ` +
        `Probe expected {<${PROBE_CLASS_A}>, <${PROBE_CLASS_B}>} but got ` +
        `${bound.size === 0 ? '{}' : `{${[...bound].join(', ')}}`}. ` +
        `Configure a SPARQL 1.1 compliant store (Oxigraph, Fuseki, Stardog, …) ` +
        `or disable hierarchical filter expansion.`
    )
  }

  log.info('Property-path support probe passed', { boundClasses: bound.size })
}
