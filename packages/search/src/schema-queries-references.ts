/**
 * Schema queries — cross-domain reference discovery (ADR 0003). Finds
 * parent→child asset reference relationships declared in SHACL.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { isIri } from '@ontology-search/sparql/escape'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'
import { extractDomainFromRegistry } from './schema-queries-domains.js'

const log = createComponentLogger('schema-queries')

/** A discovered cross-domain reference: a parent asset domain that links to a child asset domain. */
export interface DomainReferenceInfo {
  /** Parent domain that references others */
  parentDomain: string
  /** Child domain being referenced */
  childDomain: string
}

/**
 * Query for cross-domain reference relationships (parent asset domain →
 * referenced child asset domain).
 *
 * Ontology-agnostic: a cross-domain reference is ANY property shape whose value
 * resolves to a **known asset class in a different domain** — there is no
 * dependency on any specific reference domain or predicate name. The
 * asset-class + different-domain filters are what identify a genuine
 * reference; the predicate carrying it is irrelevant. Two SHACL value-shapes
 * are recognized:
 *
 * 1. **Direct `sh:class`** — the property's value is typed directly as the
 *    referenced asset class.
 * 2. **Nested disjunction** — `sh:node → sh:or → rdf:list → sh:node →
 *    sh:targetClass` declares a set of permitted referenced asset types (the
 *    open-IRI "manifest" pattern in the demo, but matched structurally).
 *
 * Parent discovery uses fallback strategies because the constraint shape owning
 * the reference property may not carry `sh:targetClass` itself:
 *   A. Direct targetClass on the constraint shape
 *   B. Walk up through `sh:and` conjunction list to the domain shape
 *   C. Walk up through `sh:or` disjunction list to the domain shape
 *
 * Both the asset-class membership and the parent/child-domain check are applied
 * in TS against the known asset-domain set.
 */
export async function queryDomainReferences(
  store: SparqlStore,
  registry?: DomainRegistry,
  knownAssetClasses?: Set<string>
): Promise<DomainReferenceInfo[]> {
  const references: DomainReferenceInfo[] = []
  const seen = new Set<string>()

  const addReference = (parentClass: string, childClass: string): void => {
    const parentDomain = extractDomainFromRegistry(parentClass, registry)
    const childDomain = extractDomainFromRegistry(childClass, registry)
    const key = `${parentDomain}:${childDomain}`
    if (parentDomain && childDomain && parentDomain !== childDomain && !seen.has(key)) {
      seen.add(key)
      references.push({ parentDomain, childDomain })
    }
  }

  // Strategy 1: any property shape whose value is directly typed (`sh:class`)
  // as another asset class. The asset-class + cross-domain filters below select
  // genuine references; the predicate name is irrelevant.
  const directSparql = `
    ${sparqlPrefixes('sh', 'rdfs')}

    SELECT DISTINCT ?parentClass ?childClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?parentClass .
        ?shape sh:property ?propShape .
        ?propShape sh:class ?childClass .
        FILTER(isIRI(?parentClass) && isIRI(?childClass))
      }
    }
  `
  const directResult = await store.query(directSparql)
  for (const row of directResult.results.bindings) {
    const parentClass = row['parentClass']?.value
    const childClass = row['childClass']?.value
    if (parentClass && childClass) {
      if (
        isAssetClass(parentClass, knownAssetClasses) &&
        isAssetClass(childClass, knownAssetClasses)
      ) {
        addReference(parentClass, childClass)
      }
    }
  }

  // Strategy 2: any property whose value-shape is a nested disjunction of
  // permitted referenced types — `sh:node → sh:or → rdf:list → sh:node →
  // sh:targetClass`. This is the open-IRI reference pattern (the demo's manifest
  // shape), matched structurally rather than by predicate name.
  const nestedChildSparql = `
    ${sparqlPrefixes('sh', 'rdfs', 'rdf')}

    SELECT DISTINCT ?constraintShape ?childClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?constraintShape sh:property ?propShape .
        ?propShape sh:node ?wrapper .
        ?wrapper sh:or ?orList .
        ?orList rdf:rest*/rdf:first ?item .
        ?item sh:node ?childShape .
        ?childShape sh:targetClass ?childClass .
        FILTER(isIRI(?childClass))
      }
    }
  `
  const nestedResult = await store.query(nestedChildSparql)
  const constraintToChildren = new Map<string, string[]>()
  for (const row of nestedResult.results.bindings) {
    const cs = row['constraintShape']?.value
    const cc = row['childClass']?.value
    if (!cs || !cc) continue
    if (knownAssetClasses && !isAssetClass(cc, knownAssetClasses)) continue
    if (!constraintToChildren.has(cs)) constraintToChildren.set(cs, [])
    constraintToChildren.get(cs)!.push(cc)
  }

  // Phase B: For each constraint shape, discover its parent domain.
  for (const [constraintIri, childClasses] of constraintToChildren) {
    const parentClass = await resolveParentDomain(store, constraintIri, knownAssetClasses)
    if (parentClass) {
      for (const childClass of childClasses) {
        addReference(parentClass, childClass)
      }
    }
  }

  return references
}

/**
 * Check whether a class IRI is a known asset class.
 * When no set is provided (no pre-computed asset classes), all classes pass.
 */
function isAssetClass(classIri: string, knownAssetClasses?: Set<string>): boolean {
  if (!knownAssetClasses || knownAssetClasses.size === 0) return true
  return knownAssetClasses.has(classIri)
}

/**
 * Resolve the parent asset domain for a SHACL constraint shape.
 *
 * Tries multiple strategies in order:
 *   A. Constraint itself has sh:targetClass that is a known asset class
 *   B. Constraint is nested in an sh:and conjunction list of a domain shape
 *   C. Constraint is nested in an sh:or disjunction list of a domain shape
 *
 * Post-filters results against known asset classes when available.
 */
async function resolveParentDomain(
  store: SparqlStore,
  constraintIri: string,
  knownAssetClasses?: Set<string>
): Promise<string | null> {
  // Validate IRI before interpolation into SPARQL to prevent injection
  // from malformed RDF data in the schema graph.
  if (!isIri(constraintIri)) {
    log.warn('Skipping invalid constraint IRI', { iri: constraintIri })
    return null
  }

  // Strategy A: Constraint shape directly has sh:targetClass
  const directSparql = `
    ${sparqlPrefixes('sh', 'rdfs')}
    SELECT ?parentClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        <${constraintIri}> sh:targetClass ?parentClass .
        FILTER(isIRI(?parentClass))
      }
    } LIMIT 10
  `
  const directResult = await store.query(directSparql)
  for (const binding of directResult.results.bindings) {
    const parentClass = binding['parentClass']?.value
    if (parentClass && isAssetClass(parentClass, knownAssetClasses)) {
      return parentClass
    }
  }

  // Strategy B: Walk up through sh:and conjunction list.
  const andListSparql = `
    ${sparqlPrefixes('sh', 'rdf', 'rdfs')}
    SELECT DISTINCT ?parentClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?nodeRef sh:node <${constraintIri}> .
        ?andList rdf:rest*/rdf:first ?nodeRef .
        ?andItem sh:and ?andList .
        ?orList rdf:rest*/rdf:first ?andItem .
        ?propParent sh:or ?orList .
        ?topShape sh:property ?propParent .
        ?topShape sh:targetClass ?parentClass .
        FILTER(isIRI(?parentClass))
      }
    } LIMIT 10
  `
  const andResult = await store.query(andListSparql)
  for (const binding of andResult.results.bindings) {
    const parentClass = binding['parentClass']?.value
    if (parentClass && isAssetClass(parentClass, knownAssetClasses)) {
      return parentClass
    }
  }

  // Strategy C: Walk up through sh:or disjunction list directly.
  const orListSparql = `
    ${sparqlPrefixes('sh', 'rdf', 'rdfs')}
    SELECT DISTINCT ?parentClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?nodeRef sh:node <${constraintIri}> .
        ?orList rdf:rest*/rdf:first ?nodeRef .
        ?propParent sh:or ?orList .
        ?topShape sh:property ?propParent .
        ?topShape sh:targetClass ?parentClass .
        FILTER(isIRI(?parentClass))
      }
    } LIMIT 10
  `
  const orResult = await store.query(orListSparql)
  for (const binding of orResult.results.bindings) {
    const parentClass = binding['parentClass']?.value
    if (parentClass && isAssetClass(parentClass, knownAssetClasses)) {
      return parentClass
    }
  }

  return null
}
