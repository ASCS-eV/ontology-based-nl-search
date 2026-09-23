/**
 * Drift gate: the instance data may only use terms the loaded ontology declares.
 *
 * An ontology bump can retire a property — the OMB 0.5.0 bump dropped eleven of
 * them from one domain alone. Nothing in the pipeline notices: the compiler
 * discovers properties from SHACL, so a predicate no shape declares simply
 * stops being reachable. The data still loads, queries still run, and the
 * property is silently absent from every prompt, facet and filter. That makes
 * it precisely the kind of regression a review of a pin bump misses, which is
 * why it is asserted here rather than re-checked by hand each time.
 *
 * Ontology-independent by construction. The expected set is whatever the loaded
 * schema declares, and which namespaces are in scope is derived from that same
 * set — so no term, domain, prefix or namespace of any particular ontology is
 * named here, and the gate travels unchanged to any OWL + SHACL ontology the
 * engine is pointed at.
 *
 * A term counts as declared when some shape routes to it (`sh:path`) or some
 * ontology declares it a property — the two ways this codebase can reach one.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL] §2.3 (property shapes)
 * @see https://www.w3.org/TR/owl2-syntax/ — [OWL2] §5 (property declarations)
 */
import { describe, expect, it } from 'vitest'

import { getInitializedStore } from '../init.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'

const PREFIXES = `
PREFIX sh: <http://www.w3.org/ns/shacl#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
`

/** Namespace of an IRI: everything up to and including the last `/` or `#`. */
const namespaceOf = (iri: string): string => iri.replace(/[^/#]*$/, '')

describe('instance data stays grounded in the loaded ontology', () => {
  it('uses no predicate the loaded schema leaves undeclared', async () => {
    const store = await getInitializedStore()
    const select = async (sparql: string, variable: string): Promise<string[]> => {
      const { results } = await store.query(sparql)
      return results.bindings.map((binding) => binding[variable]?.value ?? '')
    }

    // Instance data lives in the default graph, the schema in its named graph.
    const dataPredicates = await select(`SELECT DISTINCT ?p WHERE { ?s ?p ?o }`, 'p')

    // Blank-node paths are SHACL path expressions (sequence/alternative/…),
    // not terms the data can carry, so only IRI paths are registrations.
    const shapePaths = await select(
      `${PREFIXES} SELECT DISTINCT ?term WHERE {
         GRAPH <${SCHEMA_GRAPH}> { ?shape sh:path ?term }
         FILTER(isIRI(?term))
       }`,
      'term'
    )
    const declaredProperties = await select(
      `${PREFIXES} SELECT DISTINCT ?term WHERE {
         GRAPH <${SCHEMA_GRAPH}> {
           VALUES ?kind { owl:DatatypeProperty owl:ObjectProperty owl:AnnotationProperty rdf:Property }
           ?term a ?kind
         }
       }`,
      'term'
    )

    expect(dataPredicates.length).toBeGreaterThan(0)
    expect(shapePaths.length).toBeGreaterThan(0)

    const declared = new Set([...shapePaths, ...declaredProperties])

    // Which namespaces this gate governs is itself discovered: a namespace the
    // schema declares terms in is one the data is expected to stay inside. A
    // namespace the schema never mentions is a foreign vocabulary the data may
    // carry freely (generic RDF annotations, identifiers), and demanding a
    // declaration for those would assert something this ontology never said.
    const governedNamespaces = new Set([...declared].map(namespaceOf))

    const undeclared = dataPredicates
      .filter((predicate) => governedNamespaces.has(namespaceOf(predicate)))
      .filter((predicate) => !declared.has(predicate))
      .sort()

    // Named in the failure, never in the assertion: the message carries the
    // offending IRIs so a bump that retires a term says which one, while the
    // expectation itself stays free of any ontology's vocabulary.
    expect(
      undeclared,
      undeclared.length === 0
        ? ''
        : `the instance data uses ${undeclared.length} predicate(s) that no loaded shape routes to ` +
            `and no loaded ontology declares, in namespaces the schema otherwise governs:\n` +
            undeclared.map((iri) => `  - ${iri}`).join('\n') +
            `\n\nEither the pinned ontology retired them (migrate the data to the terms its ` +
            `shapes now declare) or the data was authored against terms that never existed.`
    ).toEqual([])
  }, 180_000)
})
