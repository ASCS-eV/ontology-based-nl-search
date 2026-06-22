/**
 * Schema queries — domain & asset discovery (ADR 0003). Discovers property→domain
 * mappings and asset domains from the SHACL/RDFS graph. Owns the shared
 * `extractDomainFromRegistry` helper (exported for the sibling query families).
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { extractDomain, extractLocalName } from '@ontology-search/core/rdf/iri'
import { sparqlPrefixes } from '@ontology-search/core/rdf/prefixes'
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SparqlStore } from '@ontology-search/sparql/types'

import { SCHEMA_GRAPH } from './schema-loader.js'

const log = createComponentLogger('schema-queries')

/** Tracks which domain mismatches have already been warned about (emit once). */
const warnedDomainMismatches = new Set<string>()

/** Property-domain association from SHACL shapes */
export interface PropertyDomainInfo {
  /** Property local name */
  localName: string
  /** Full property IRI */
  iri: string
  /** Domain that defines this property */
  domain: string
  /** Target class IRI */
  targetClass: string
}

/** Asset domain discovered from rdfs:subClassOf hierarchy */
export interface AssetDomainInfo {
  /** Domain name */
  domainName: string
  /** Asset class IRI */
  assetClass: string
}

/**
 * Extract domain name from IRI using the domain registry.
 *
 * Delegates to the shared `extractDomain` from core, passing the
 * registry's resolver function when available.
 */
export function extractDomainFromRegistry(iri: string, registry?: DomainRegistry): string {
  return extractDomain(iri, registry ? (i) => registry.domainForIri(i) : undefined)
}

/**
 * Query SHACL shapes for all property-domain associations.
 *
 * Returns one row per (property, domain) pair. Properties that exist in
 * multiple domains (the same local name in more than one domain) will have
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

  // Genericity hook: when the registry declares domains
  // but ZERO were discovered via `rdfs:subClassOf` — the signature of
  // a flat ontology with no shared asset superclass — surface every
  // registry-declared primary class. This lets a single-domain or
  // self-rooted ontology (no shared base type) work without forcing
  // it to add a shared superclass hierarchy.
  //
  // The fallback is gated on `discoveredDomains.size === 0` so it
  // does NOT inflate the result for multi-domain ontologies where
  // supporting domains intentionally are not asset classes.
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
