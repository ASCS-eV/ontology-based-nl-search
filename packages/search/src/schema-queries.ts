/**
 * Schema Queries — SPARQL queries against the ontology schema graph.
 *
 * This module queries the SHACL shapes graph to extract ontology structure:
 * - Property-domain mappings (which domains define which properties)
 * - Asset domain discovery (primary target classes per domain)
 * - Domain references (which domains reference which other domains)
 * - Property shape group classification (Content, Format, Quantity, etc.)
 * - Range2D property detection
 * - SKOS concept-scheme membership + instance-value distributions
 *
 * Architecture: Query the graph, don't hardcode metadata. All domain
 * knowledge comes from SPARQL queries + the domain registry, not from
 * hardcoded namespace patterns or class names.
 *
 * Size note: each query is a focused SPARQL string plus a small
 * post-processor specific to that query's row shape. Splitting per
 * query into separate files would mean a `schema-queries/` directory
 * of ~8 single-export files that all share the same imports, prefix
 * helpers, and `extractDomain`/`extractLocalName` utilities. Keeping
 * them co-located documents the shared contract (every query reads
 * from `<urn:graph:schema>` and emits `{ domain, localName, … }`-shaped
 * rows) and gives the compiler a single import surface.
 *
 * @see https://www.w3.org/TR/sparql11-query/
 * @see https://www.w3.org/TR/shacl/
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { extractDomain, extractLocalName } from '@ontology-search/core/rdf/iri'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { isIri } from '@ontology-search/sparql/escape'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'

const log = createComponentLogger('schema-queries')

/** Tracks which domain mismatches have already been warned about (emit once). */
const warnedDomainMismatches = new Set<string>()

/** Property-domain association from SHACL shapes */
export interface PropertyDomainInfo {
  /** Property local name (e.g., "roadTypes") */
  localName: string
  /** Full property IRI (e.g., "https://w3id.org/.../hdmap/v6/roadTypes") */
  iri: string
  /** Domain that defines this property (e.g., "hdmap") */
  domain: string
  /** Target class IRI (e.g., "https://w3id.org/.../hdmap/v6/HDMap") */
  targetClass: string
}

/** Asset domain discovered from rdfs:subClassOf hierarchy */
export interface AssetDomainInfo {
  /** Domain name (e.g., "hdmap", "scenario") */
  domainName: string
  /** Asset class IRI (e.g., "https://w3id.org/.../hdmap/v6/HDMap") */
  assetClass: string
}

/** A discovered cross-domain reference: a parent asset domain that links to a child asset domain. */
export interface DomainReferenceInfo {
  /** Parent domain that references others (e.g., "scenario") */
  parentDomain: string
  /** Child domain being referenced (e.g., "hdmap") */
  childDomain: string
}

/** Property shape group classification from SHACL nesting structure */
export interface PropertyShapeGroupInfo {
  /** Property local name (e.g., "roadTypes") */
  localName: string
  /** Domain that defines this property (e.g., "hdmap") */
  domain: string
  /** Shape group from rdfs:subClassOf hierarchy (e.g., "Content", "Format", "Quantity") */
  shapeGroup: string
}

/** Property that uses a Range2D structure (min/max sub-properties) */
export interface Range2DPropertyInfo {
  /** Property local name (e.g., "speedLimit") */
  localName: string
  /** Domain that defines this property (e.g., "hdmap") */
  domain: string
  /** Full IRI of the lower-bound sub-predicate (the leaf bearing sh:lessThanOrEquals). */
  minPredicate: string
  /** Full IRI of the upper-bound sub-predicate (the sh:lessThanOrEquals target). */
  maxPredicate: string
}

/**
 * Extract domain name from IRI using the domain registry.
 *
 * Delegates to the shared `extractDomain` from core, passing the
 * registry's resolver function when available.
 */
function extractDomainFromRegistry(iri: string, registry?: DomainRegistry): string {
  return extractDomain(iri, registry ? (i) => registry.domainForIri(i) : undefined)
}

/**
 * Query SHACL shapes for all property-domain associations.
 *
 * Returns one row per (property, domain) pair. Properties that exist in
 * multiple domains (e.g., roadTypes in both hdmap and ositrace) will have
 * multiple rows.
 */
export async function queryPropertyDomains(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<PropertyDomainInfo[]> {
  const sparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?iri ?targetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?targetClass .
        ?shape sh:property ?propShape .
        ?propShape sh:path ?iri .
        FILTER(isIRI(?iri))
      }
    }
    ORDER BY ?iri ?targetClass
  `

  const result = await store.query(sparql)
  const properties: PropertyDomainInfo[] = []
  const seen = new Set<string>()

  for (const row of result.results.bindings) {
    const iri = row['iri']?.value
    const targetClass = row['targetClass']?.value
    if (!iri || !targetClass) continue

    const localName = extractLocalName(iri)
    const domain = extractDomainFromRegistry(targetClass, registry)
    const key = `${localName}:${domain}`

    if (localName && domain && !seen.has(key)) {
      seen.add(key)
      properties.push({ localName, iri, domain, targetClass })
    }
  }

  return properties
}

/**
 * Query for all asset domains via rdfs:subClassOf hierarchy.
 *
 * Discovers asset types by finding cross-domain rdfs:subClassOf
 * relationships where the subclass is a known primary target class
 * from the domain registry. This is ontology-agnostic — it works
 * with any ontology structure where domain classes inherit from
 * base asset classes in a different domain.
 */
export async function queryAssetDomains(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<AssetDomainInfo[]> {
  const sparql = `
    ${sparqlPrefixes('rdfs')}

    SELECT DISTINCT ?subClass ?superClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?subClass rdfs:subClassOf ?superClass .
        FILTER(isIRI(?subClass) && isIRI(?superClass))
      }
    }
    ORDER BY ?subClass
  `

  const result = await store.query(sparql)
  const domains: AssetDomainInfo[] = []
  const seen = new Set<string>()

  // Collect primary target class IRIs from the registry
  const primaryIris = new Set<string>()
  if (registry) {
    for (const desc of registry.domains.values()) {
      primaryIris.add(desc.targetClassIri)
    }
  }

  for (const row of result.results.bindings) {
    const subClass = row['subClass']?.value
    const superClass = row['superClass']?.value
    if (!subClass || !superClass) continue

    const subDomain = extractDomainFromRegistry(subClass, registry)
    const superDomain = extractDomainFromRegistry(superClass, registry)

    // Cross-domain inheritance: subclass is in a different domain than superclass
    // AND the subclass must be the primary target class for its domain
    // (this filters out sub-shapes like Content, Format, etc.)
    if (
      subDomain &&
      superDomain &&
      subDomain !== superDomain &&
      !seen.has(subDomain) &&
      (primaryIris.size === 0 || primaryIris.has(subClass))
    ) {
      seen.add(subDomain)
      domains.push({ domainName: subDomain, assetClass: subClass })
    }
  }

  // Genericity hook (task 21e): when the registry declares domains
  // but ZERO were discovered via `rdfs:subClassOf` — the signature of
  // a flat ontology with no shared asset superclass — surface every
  // registry-declared primary class. This lets a single-domain or
  // self-rooted ontology (no shared base type) work without forcing
  // it to add an ENVITED-X-style superclass hierarchy.
  //
  // The fallback is gated on `discoveredDomains.size === 0` so it
  // does NOT inflate the result for multi-domain ontologies (like
  // ENVITED-X) where supporting domains (georeference, manifest)
  // intentionally are not asset classes.
  if (registry && registry.domains.size > 0) {
    if (domains.length === 0) {
      for (const [name, desc] of registry.domains) {
        if (desc.targetClassIri) {
          domains.push({ domainName: name, assetClass: desc.targetClassIri })
        }
      }
    } else {
      // Multi-domain workspace: registry domains that didn't surface via
      // cross-domain `rdfs:subClassOf` are non-asset "supporting"
      // ontologies (codelists, cross-reference infra like manifest /
      // georeference, base vocabularies). That's the EXPECTED case, so
      // we emit ONE aggregated info line listing them rather than a
      // WARN per domain — seven warn lines for a normal condition is
      // alarm fatigue. A genuinely missing `sh:targetClass` shows up as
      // an unexpected name in this list. Logged once per process via the
      // module-level guard.
      const discoveredDomains = new Set(domains.map((d) => d.domainName))
      const nonAsset = [...registry.domains.keys()]
        .filter((name) => !discoveredDomains.has(name))
        .sort()
      const unlogged = nonAsset.filter((name) => !warnedDomainMismatches.has(name))
      if (unlogged.length > 0) {
        for (const name of unlogged) warnedDomainMismatches.add(name)
        log.info(
          'Non-asset support domains (no cross-domain rdfs:subClassOf) — expected for codelists / cross-reference vocabularies; verify none is a typo or a missing sh:targetClass',
          { count: nonAsset.length, domains: nonAsset }
        )
      }
    }
  }

  return domains
}

/**
 * Query for cross-domain reference relationships (parent asset domain →
 * referenced child asset domain).
 *
 * Ontology-agnostic: a cross-domain reference is ANY property shape whose value
 * resolves to a **known asset class in a different domain** — there is no
 * dependency on a "manifest" domain or a `hasReferencedArtifacts` predicate
 * name. The asset-class + different-domain filters are what identify a genuine
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

/**
 * Query SHACL shape nesting to classify properties into shape groups.
 *
 * Uses rdfs:subClassOf to determine which abstract shape group each property
 * belongs to (Content, Format, Quantity, Quality, DataSource). This is the
 * graph-driven replacement for hardcoded property classification.
 *
 * Detects cross-domain inheritance: a domain-specific class inherits from
 * a base class in a different domain. The superclass local name is the
 * shape group label (e.g., "Content", "Format").
 */
export async function queryPropertyShapeGroups(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<PropertyShapeGroupInfo[]> {
  const sparql = `
    ${sparqlPrefixes('sh', 'rdfs')}

    SELECT DISTINCT ?propIri ?targetClass ?superclass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?targetClass .
        ?shape sh:property ?propShape .
        ?propShape sh:path ?propIri .
        FILTER(isIRI(?propIri))

        ?targetClass rdfs:subClassOf ?superclass .
        FILTER(isIRI(?superclass))
      }
    }
    ORDER BY ?propIri
  `

  const result = await store.query(sparql)
  const groups: PropertyShapeGroupInfo[] = []
  const seen = new Set<string>()

  for (const row of result.results.bindings) {
    const propIri = row['propIri']?.value
    const targetClass = row['targetClass']?.value
    const superclass = row['superclass']?.value
    if (!propIri || !targetClass || !superclass) continue

    const localName = extractLocalName(propIri)
    const domain = extractDomainFromRegistry(targetClass, registry)
    const superDomain = extractDomainFromRegistry(superclass, registry)
    const shapeGroup = extractLocalName(superclass)
    const key = `${localName}:${domain}`

    // Only include cross-domain inheritance (property's class inherits from
    // a base class in a different domain). Same-domain subClassOf is just
    // internal OWL structuring, not a shape group classification.
    if (
      localName &&
      domain &&
      superDomain &&
      domain !== superDomain &&
      shapeGroup &&
      !seen.has(key)
    ) {
      seen.add(key)
      groups.push({ localName, domain, shapeGroup })
    }
  }

  return groups
}

/**
 * Query for properties that wrap a numeric min/max interval.
 *
 * Detected STRUCTURALLY, not by class name: a property whose `sh:node`
 * points to a shape with two scalar leaves where one leaf declares
 * `sh:lessThanOrEquals <other>` — the SHACL constraint that semantically
 * marks the lower bound (its value must be ≤ the other leaf's value). The
 * `sh:lessThanOrEquals` target identifies the upper-bound predicate, and the
 * bearing leaf's own `sh:path` identifies the lower-bound predicate. Both
 * sub-predicate IRIs are returned so the compiler emits the discovered
 * predicates rather than literal `:min`/`:max`.
 *
 * Replaces the prior `CONTAINS(STR(?rangeClass), "Range2D")` match and the
 * hardcoded `min`/`max` local names — an ontology that names its interval
 * wrapper `Interval`/`BoundingRange` with `lowerBound`/`upperBound` sub-
 * properties is now detected identically (criterion 9 / 9b).
 */
export async function queryRange2DProperties(
  store: SparqlStore,
  registry?: DomainRegistry
): Promise<Range2DPropertyInfo[]> {
  const sparql = `
    ${sparqlPrefixes('sh')}

    SELECT DISTINCT ?propIri ?minPred ?maxPred WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:property ?propShape .
        ?propShape sh:path ?propIri .
        ?propShape sh:node ?rangeShape .
        ?rangeShape sh:property ?minLeaf .
        ?minLeaf sh:path ?minPred .
        ?minLeaf sh:lessThanOrEquals ?maxPred .
        ?rangeShape sh:property ?maxLeaf .
        ?maxLeaf sh:path ?maxPred .
        FILTER(isIRI(?propIri))
      }
    }
    ORDER BY ?propIri
  `

  const result = await store.query(sparql)
  const properties: Range2DPropertyInfo[] = []

  for (const row of result.results.bindings) {
    const propIri = row['propIri']?.value
    const minPredicate = row['minPred']?.value
    const maxPredicate = row['maxPred']?.value
    if (!propIri || !minPredicate || !maxPredicate) continue

    const localName = extractLocalName(propIri)
    const domain = extractDomainFromRegistry(propIri, registry)

    if (localName && domain) {
      properties.push({ localName, domain, minPredicate, maxPredicate })
    }
  }

  return properties
}

// ─── Phase 2: Generic hierarchical-vocabulary discovery ──────────────────────

/**
 * SKOS concept scheme membership: a concept IRI together with the scheme it
 * belongs to. Discovered generically — we don't assume any particular scheme
 * exists, we just find whatever is declared via skos:inScheme in any graph.
 */
export interface SkosConceptInfo {
  /** Full IRI of the concept (e.g. an ISO country code IRI) */
  iri: string
  /** IRI of the skos:ConceptScheme this concept is a member of */
  scheme: string
  /** Preferred label (skos:prefLabel) if any, language-agnostic first match */
  prefLabel?: string
}

/**
 * Class hierarchy edge discovered via rdfs:subClassOf.
 * Used by the compiler to expand a class-typed filter value to all its
 * subclasses (e.g. {SedanCar} → {SedanCar, CompactSedan, …}).
 */
export interface SubClassEdge {
  /** Subclass IRI */
  sub: string
  /** Superclass IRI */
  super: string
}

/**
 * Distribution of distinct literal values actually used for a property in
 * the instance data. Powers data-driven gap suggestions.
 */
export interface PropertyValueDistribution {
  /** Property IRI */
  property: string
  /** Distinct literal values observed for the property */
  values: string[]
}

/**
 * Discover all SKOS concepts and their containing scheme(s) across the entire
 * store (default graph + named graphs). Generic — no scheme IRIs are hardcoded.
 *
 * @returns one row per (concept, scheme) — concepts in multiple schemes appear
 * multiple times.
 */
export async function querySkosConcepts(store: SparqlStore): Promise<SkosConceptInfo[]> {
  const sparql = `
    ${sparqlPrefixes('skos')}

    SELECT DISTINCT ?iri ?scheme ?prefLabel WHERE {
      {
        ?iri a skos:Concept ;
             skos:inScheme ?scheme .
        OPTIONAL { ?iri skos:prefLabel ?prefLabel }
      }
      UNION
      {
        GRAPH ?g {
          ?iri a skos:Concept ;
               skos:inScheme ?scheme .
          OPTIONAL { ?iri skos:prefLabel ?prefLabel }
        }
      }
    }
    ORDER BY ?scheme ?iri
  `

  const result = await store.query(sparql)
  const out: SkosConceptInfo[] = []
  const seen = new Set<string>()

  for (const row of result.results.bindings) {
    const iri = row['iri']?.value
    const scheme = row['scheme']?.value
    if (!iri || !scheme) continue
    const key = `${iri}|${scheme}`
    if (seen.has(key)) continue
    seen.add(key)

    const prefLabel = row['prefLabel']?.value
    out.push(prefLabel ? { iri, scheme, prefLabel } : { iri, scheme })
  }

  return out
}

/**
 * Discover the rdfs:subClassOf edges declared anywhere in the store.
 * The compiler walks this transitively via SPARQL property paths; we
 * pre-extract the edges so callers can introspect available hierarchies.
 */
export async function querySubClassEdges(store: SparqlStore): Promise<SubClassEdge[]> {
  const sparql = `
    ${sparqlPrefixes('rdfs')}

    SELECT DISTINCT ?sub ?super WHERE {
      { ?sub rdfs:subClassOf ?super . FILTER(isIRI(?super)) }
      UNION
      { GRAPH ?g { ?sub rdfs:subClassOf ?super . FILTER(isIRI(?super)) } }
    }
  `

  const result = await store.query(sparql)
  const edges: SubClassEdge[] = []
  for (const row of result.results.bindings) {
    const sub = row['sub']?.value
    const sup = row['super']?.value
    if (!sub || !sup) continue
    edges.push({ sub, super: sup })
  }
  return edges
}

/**
 * For every distinct property used in the *instance* data (NOT the schema),
 * collect the distinct literal values observed. Generic — works regardless of
 * which domains exist or what the property names are.
 *
 * `propertyIris`, if provided, restricts the query to a known property set
 * to keep result size manageable on large stores. Pass undefined to scan
 * everything (only practical for small/medium datasets).
 */
export async function queryInstanceValueDistribution(
  store: SparqlStore,
  propertyIris?: string[]
): Promise<PropertyValueDistribution[]> {
  // Restrict by VALUES if a property list is supplied so the query stays cheap.
  const valuesClause =
    propertyIris && propertyIris.length > 0
      ? `VALUES ?p { ${propertyIris.map((iri) => `<${iri}>`).join(' ')} }`
      : ''

  const sparql = `
    SELECT DISTINCT ?p ?v WHERE {
      ${valuesClause}
      ?s ?p ?v .
      FILTER(isLiteral(?v))
    }
  `

  const result = await store.query(sparql)
  const map = new Map<string, Set<string>>()
  for (const row of result.results.bindings) {
    const p = row['p']?.value
    const v = row['v']?.value
    if (!p || v === undefined) continue
    const set = map.get(p) ?? new Set<string>()
    set.add(v)
    map.set(p, set)
  }

  return [...map.entries()].map(([property, values]) => ({
    property,
    values: [...values],
  }))
}
