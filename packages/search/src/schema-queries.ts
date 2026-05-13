/**
 * Schema Queries — SPARQL queries against the ontology schema graph.
 *
 * This module queries the SHACL shapes graph to extract ontology structure:
 * - Property-domain mappings (which domains define which properties)
 * - Asset domain discovery (all classes that are SimulationAssets)
 * - Domain references (which domains reference which other domains)
 * - Property shape group classification (Content, Format, Quantity, etc.)
 * - Range2D property detection
 *
 * Architecture: Query the graph, don't extract metadata.
 * All domain knowledge comes from SPARQL queries, not hardcoded maps.
 *
 * @see https://www.w3.org/TR/sparql11-query/
 * @see https://www.w3.org/TR/shacl/
 */
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'

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

/** Domain reference relationship (from manifest:hasReferencedArtifacts) */
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
}

/**
 * Extract domain name from IRI.
 *
 * Uses the ENVITED-X IRI convention: `.../domain/vN/ClassName`
 * Example: "https://w3id.org/.../hdmap/v6/HDMap" → "hdmap"
 */
function extractDomain(iri: string): string {
  const match = iri.match(/\/([^/]+)\/v\d+\//)
  return match?.[1] ?? ''
}

/** Extract local name from IRI (after last / or #) */
function extractLocalName(iri: string): string {
  const hashIdx = iri.lastIndexOf('#')
  const slashIdx = iri.lastIndexOf('/')
  const idx = Math.max(hashIdx, slashIdx)
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/**
 * Query SHACL shapes for all property-domain associations.
 *
 * Returns one row per (property, domain) pair. Properties that exist in
 * multiple domains (e.g., roadTypes in both hdmap and ositrace) will have
 * multiple rows.
 */
export async function queryPropertyDomains(store: SparqlStore): Promise<PropertyDomainInfo[]> {
  const sparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>

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
    const domain = extractDomain(targetClass)
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
 * Discovers asset types by finding classes whose superclass IRI
 * is in the envited-x base namespace (SimulationAsset, SoftwareAsset,
 * CodeAsset, ServiceAsset). Version-independent — matches any version
 * by filtering on the namespace path pattern.
 */
export async function queryAssetDomains(store: SparqlStore): Promise<AssetDomainInfo[]> {
  // Version-independent: match any class that is rdfs:subClassOf
  // something in the envited-x base ontology namespace
  const sparql = `
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT DISTINCT ?assetClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?assetClass rdfs:subClassOf ?superclass .
        FILTER(
          CONTAINS(STR(?superclass), "/envited-x/envited-x/") &&
          (
            STRENDS(STR(?superclass), "SimulationAsset") ||
            STRENDS(STR(?superclass), "SoftwareAsset") ||
            STRENDS(STR(?superclass), "CodeAsset") ||
            STRENDS(STR(?superclass), "ServiceAsset")
          )
        )
      }
    }
    ORDER BY ?assetClass
  `

  const result = await store.query(sparql)
  const domains: AssetDomainInfo[] = []
  const seen = new Set<string>()

  for (const row of result.results.bindings) {
    const assetClass = row['assetClass']?.value
    if (!assetClass) continue

    const domainName = extractDomain(assetClass)
    if (domainName && !seen.has(domainName)) {
      seen.add(domainName)
      domains.push({ domainName, assetClass })
    }
  }

  return domains
}

/**
 * SPARQL filter fragment: restricts a class to known ENVITED-X asset types
 * (SimulationAsset, SoftwareAsset, CodeAsset, ServiceAsset).
 * The variable `?cls` and `?super` must be substituted by the caller.
 */
const ASSET_DOMAIN_FILTER = (cls: string, sup: string) => `
  ?${cls} rdfs:subClassOf ?${sup} .
  FILTER(
    CONTAINS(STR(?${sup}), "/envited-x/envited-x/") &&
    (STRENDS(STR(?${sup}), "SimulationAsset") ||
     STRENDS(STR(?${sup}), "SoftwareAsset") ||
     STRENDS(STR(?${sup}), "CodeAsset") ||
     STRENDS(STR(?${sup}), "ServiceAsset"))
  )
`

/**
 * Query for domain reference relationships.
 *
 * Finds which domains reference other domains via manifest:hasReferencedArtifacts.
 * Uses a multi-strategy approach to handle different SHACL nesting patterns:
 *
 * 1. **Direct sh:class** — simple `sh:class` on the property shape (original pattern)
 * 2. **Nested SHACL walk** — `sh:node → sh:or → rdf:list → sh:node → sh:targetClass`
 *    (handles the actual scenario SHACL structure where referenced artifact types
 *     are declared in an sh:or disjunction list)
 *
 * Parent discovery uses fallback strategies because the constraint shape owning
 * `hasReferencedArtifacts` may not have `sh:targetClass` itself:
 *   A. Direct targetClass on the constraint shape
 *   B. Walk up through `sh:and` conjunction list to the domain shape
 *   C. Walk up through `sh:or` disjunction list to the domain shape
 *
 * Separate queries avoid Oxigraph WASM crashes from UNION + property path `*`.
 */
export async function queryDomainReferences(store: SparqlStore): Promise<DomainReferenceInfo[]> {
  const references: DomainReferenceInfo[] = []
  const seen = new Set<string>()

  const addReference = (parentClass: string, childClass: string): void => {
    const parentDomain = extractDomain(parentClass)
    const childDomain = extractDomain(childClass)
    const key = `${parentDomain}:${childDomain}`
    if (parentDomain && childDomain && parentDomain !== childDomain && !seen.has(key)) {
      seen.add(key)
      references.push({ parentDomain, childDomain })
    }
  }

  // Strategy 1: Direct sh:class on hasReferencedArtifacts property shape.
  // Handles simple SHACL patterns where the child class is declared directly.
  const directSparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/>

    SELECT DISTINCT ?parentClass ?childClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?parentClass .
        ?shape sh:property ?propShape .
        ?propShape sh:path manifest:hasReferencedArtifacts .
        ?propShape sh:class ?childClass .
        ${ASSET_DOMAIN_FILTER('parentClass', 'parentSuper')}
        ${ASSET_DOMAIN_FILTER('childClass', 'childSuper')}
      }
    }
  `
  const directResult = await store.query(directSparql)
  for (const row of directResult.results.bindings) {
    const parentClass = row['parentClass']?.value
    const childClass = row['childClass']?.value
    if (parentClass && childClass) addReference(parentClass, childClass)
  }

  // Strategy 2: Nested SHACL — walk sh:node → sh:or → rdf:list → sh:node → targetClass.
  // Phase A: Find (constraintShape, childClass) pairs from the nested structure.
  const nestedChildSparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX manifest: <https://w3id.org/ascs-ev/envited-x/manifest/v5/>

    SELECT DISTINCT ?constraintShape ?childClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?constraintShape sh:property ?propShape .
        ?propShape sh:path manifest:hasReferencedArtifacts .
        ?propShape sh:node ?wrapper .
        ?wrapper sh:or ?orList .
        ?orList rdf:rest*/rdf:first ?item .
        ?item sh:node ?childShape .
        ?childShape sh:targetClass ?childClass .
        ${ASSET_DOMAIN_FILTER('childClass', 'childSuper')}
      }
    }
  `
  const nestedResult = await store.query(nestedChildSparql)
  const constraintToChildren = new Map<string, string[]>()
  for (const row of nestedResult.results.bindings) {
    const cs = row['constraintShape']?.value
    const cc = row['childClass']?.value
    if (!cs || !cc) continue
    if (!constraintToChildren.has(cs)) constraintToChildren.set(cs, [])
    constraintToChildren.get(cs)!.push(cc)
  }

  // Phase B: For each constraint shape, discover its parent domain.
  for (const [constraintIri, childClasses] of constraintToChildren) {
    const parentClass = await resolveParentDomain(store, constraintIri)
    if (parentClass) {
      for (const childClass of childClasses) {
        addReference(parentClass, childClass)
      }
    }
  }

  return references
}

/**
 * Resolve the parent asset domain for a SHACL constraint shape.
 *
 * Tries multiple strategies in order:
 *   A. Constraint itself has sh:targetClass that is an asset domain
 *   B. Constraint is nested in an sh:and conjunction list of a domain shape
 *   C. Constraint is nested in an sh:or disjunction list of a domain shape
 */
async function resolveParentDomain(
  store: SparqlStore,
  constraintIri: string
): Promise<string | null> {
  // Strategy A: Constraint shape directly has sh:targetClass
  const directSparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT ?parentClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        <${constraintIri}> sh:targetClass ?parentClass .
        ${ASSET_DOMAIN_FILTER('parentClass', 'parentSuper')}
      }
    } LIMIT 1
  `
  const directResult = await store.query(directSparql)
  const directBinding = directResult.results.bindings[0]
  if (directBinding) {
    return directBinding['parentClass']?.value ?? null
  }

  // Strategy B: Walk up through sh:and conjunction list.
  // Pattern: domainShape → sh:property → prop → sh:or → list → item →
  //          sh:and → list → member → sh:node → constraintShape
  const andListSparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?parentClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?nodeRef sh:node <${constraintIri}> .
        ?andList rdf:rest*/rdf:first ?nodeRef .
        ?andItem sh:and ?andList .
        ?orList rdf:rest*/rdf:first ?andItem .
        ?propParent sh:or ?orList .
        ?topShape sh:property ?propParent .
        ?topShape sh:targetClass ?parentClass .
        ${ASSET_DOMAIN_FILTER('parentClass', 'parentSuper')}
      }
    } LIMIT 1
  `
  const andResult = await store.query(andListSparql)
  const andBinding = andResult.results.bindings[0]
  if (andBinding) {
    return andBinding['parentClass']?.value ?? null
  }

  // Strategy C: Walk up through sh:or disjunction list directly.
  // Pattern: domainShape → sh:property → prop → sh:or → list →
  //          member → sh:node → constraintShape
  const orListSparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    SELECT DISTINCT ?parentClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?nodeRef sh:node <${constraintIri}> .
        ?orList rdf:rest*/rdf:first ?nodeRef .
        ?propParent sh:or ?orList .
        ?topShape sh:property ?propParent .
        ?topShape sh:targetClass ?parentClass .
        ${ASSET_DOMAIN_FILTER('parentClass', 'parentSuper')}
      }
    } LIMIT 1
  `
  const orResult = await store.query(orListSparql)
  const orBinding = orResult.results.bindings[0]
  if (orBinding) {
    return orBinding['parentClass']?.value ?? null
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
 * SHACL structure: Shape → sh:targetClass → C, C rdfs:subClassOf envited-x:Content
 * The superclass local name ("Content", "Format", etc.) is the shape group.
 */
export async function queryPropertyShapeGroups(
  store: SparqlStore
): Promise<PropertyShapeGroupInfo[]> {
  const sparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT DISTINCT ?propIri ?targetClass ?superclass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:targetClass ?targetClass .
        ?shape sh:property ?propShape .
        ?propShape sh:path ?propIri .
        FILTER(isIRI(?propIri))

        ?targetClass rdfs:subClassOf ?superclass .
        FILTER(CONTAINS(STR(?superclass), "/envited-x/envited-x/"))
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
    const domain = extractDomain(targetClass)
    const shapeGroup = extractLocalName(superclass)
    const key = `${localName}:${domain}`

    if (localName && domain && shapeGroup && !seen.has(key)) {
      seen.add(key)
      groups.push({ localName, domain, shapeGroup })
    }
  }

  return groups
}

/**
 * Query for properties that use Range2D structure (min/max sub-properties).
 *
 * Detects properties where sh:node points to a shape whose targetClass
 * contains "Range2D". These require special SPARQL pattern generation
 * (property → blank node → min/max).
 */
export async function queryRange2DProperties(store: SparqlStore): Promise<Range2DPropertyInfo[]> {
  const sparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>

    SELECT DISTINCT ?propIri ?rangeClass WHERE {
      GRAPH <${SCHEMA_GRAPH}> {
        ?shape sh:property ?propShape .
        ?propShape sh:path ?propIri .
        ?propShape sh:node ?rangeShape .
        ?rangeShape sh:targetClass ?rangeClass .
        FILTER(isIRI(?propIri))
        FILTER(CONTAINS(STR(?rangeClass), "Range2D"))
      }
    }
    ORDER BY ?propIri
  `

  const result = await store.query(sparql)
  const properties: Range2DPropertyInfo[] = []

  for (const row of result.results.bindings) {
    const propIri = row['propIri']?.value
    if (!propIri) continue

    const localName = extractLocalName(propIri)
    const domain = extractDomain(propIri)

    if (localName && domain) {
      properties.push({ localName, domain })
    }
  }

  return properties
}
