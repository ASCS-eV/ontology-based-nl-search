/**
 * Domain Registry — auto-discovers asset domain metadata from SHACL shapes.
 *
 * Scientific basis: W3C SHACL `sh:targetClass` identifies which OWL classes
 * a NodeShape constrains. Combined with owl:imports and prefix declarations,
 * this provides complete domain metadata without manual configuration.
 *
 * Design: Reads all *.shacl.ttl + *.owl.ttl files from ontology-sources.json
 * and builds a structured registry of all asset domains, their target classes,
 * namespace prefixes, and SPARQL prefix declarations.
 *
 * @see https://www.w3.org/TR/shacl/#targetClass
 */
import { OntologySourcesError } from '@ontology-search/core/errors'
import { RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

import {
  computeComponentBases,
  extractNamespace,
  extractPrefixes,
  extractSubClassOfEdges,
  extractTargetClasses,
  extractVersion,
  findPrefixAlias,
  selectPrimaryAssetClass,
} from './domain-registry-parse.js'
import { getArtifactRoots } from './sources.js'

/** Metadata for a single ontology domain */
export interface DomainDescriptor {
  /** Short domain name (directory name) */
  name: string
  /** Full namespace IRI (e.g. ".../<domain>/<version>/") */
  namespace: string
  /** SPARQL prefix alias */
  prefix: string
  /** OWL target class for assets (e.g. "<prefix>:<Class>") */
  targetClass: string
  /** Full IRI of the target class */
  targetClassIri: string
  /** Version extracted from namespace (e.g., "v6") */
  version: string
  /** Shape names that define sub-structures (Content, Format, Quantity, Quality, DataSource) */
  shapes: string[]
  /** All @prefix declarations found in this domain's TTL files (prefix → namespace) */
  declaredPrefixes: Record<string, string>
}

/** Complete registry of all discovered domains */
export interface DomainRegistry {
  /** All discovered domains keyed by domain name */
  domains: Map<string, DomainDescriptor>
  /** Ordered list of domain names */
  domainNames: string[]
  /** Generate SPARQL PREFIX declarations for a specific domain */
  prefixesFor(domain: string): string
  /** Generate SPARQL PREFIX declarations for all domains */
  allPrefixes(): string
  /**
   * Resolve a domain by the IRI path-segment name.
   * Schema queries derive domain names from IRI path segments (e.g., "openlabel"
   * from `/openlabel/v2/`), which may differ from directory names (e.g., "openlabel-v2").
   * Returns the DomainDescriptor for the first registry entry whose namespace
   * contains `/{iriDomain}/v`.
   */
  resolveByIriDomain(iriDomain: string): DomainDescriptor | undefined
  /**
   * Reverse-lookup: map a full IRI to its owning domain name using
   * longest-prefix matching against known domain namespaces.
   * Returns `undefined` when the IRI does not start with any known namespace.
   */
  domainForIri(iri: string): string | undefined
  /**
   * Collect every namespace IRI from every domain (own namespace plus
   * all `@prefix` declarations from its files). Used to feed the
   * SPARQL policy allowlist at startup.
   */
  getAllNamespaces(): Set<string>
}

/**
 * Standard prefixes always included in every emitted SPARQL PREFIX
 * block. Sourced from the canonical RDF_PREFIXES so the compiler, the
 * policy, and the registry all see the same IRIs.
 */
const STANDARD_PREFIXES: Record<string, string> = {
  rdfs: RDF_PREFIXES.rdfs,
  xsd: RDF_PREFIXES.xsd,
  owl: RDF_PREFIXES.owl,
  sh: RDF_PREFIXES.sh,
  gx: RDF_PREFIXES.gx,
}

/** Cached singleton */
let cachedRegistry: DomainRegistry | null = null

/**
 * Build the domain registry by scanning all artifact directories.
 */
export async function buildDomainRegistry(): Promise<DomainRegistry> {
  if (cachedRegistry) return cachedRegistry

  const roots = getArtifactRoots()
  const domains = new Map<string, DomainDescriptor>()

  // Primary-asset-class selection is graph-driven and global: a domain's asset
  // class is defined by what it subclasses across the WHOLE ontology (an asset
  // base vs a shared sub-component base), so it cannot be decided one directory
  // at a time. Pass 1 reads each domain's text into a raw record (target
  // classes via regex — order-preserving — and rdfs:subClassOf edges via a real
  // RDF parse); pass 2 classifies the component bases globally and assigns each
  // domain's primary.
  interface RawDomain {
    entry: string
    namespace: string
    ttlPrefix: string
    filePrefixes: Record<string, string>
    targetClasses: { localName: string; iri: string }[]
    subClassEdges: { sub: string; super: string }[]
  }
  const raw: RawDomain[] = []

  for (const root of roots) {
    if (!existsSync(root.path)) continue

    let entries: string[]
    try {
      entries = readdirSync(root.path)
    } catch {
      // intentional: root directory unreadable — skip silently, other roots may work
      continue
    }

    for (const entry of entries) {
      if (root.domainAllowlist && !root.domainAllowlist.has(entry)) continue
      const domainDir = join(root.path, entry)
      // statSync and the inner readdirSync/readFileSync here are NOT wrapped
      // in try/catch on purpose: every call sits inside an artifact-root walk
      // we just listed, so a failure indicates a real environment problem
      // (broken submodule, permission corruption mid-startup). Letting it
      // throw surfaces the underlying issue via the warmup layer rather than
      // silently producing a half-built registry. CLAUDE.md §"Don't add error
      // handling for scenarios that can't happen" applies.
      if (!statSync(domainDir).isDirectory()) continue

      // Find SHACL and OWL files
      const files = readdirSync(domainDir)
      const shaclFile = files.find((f) => f.endsWith('.shacl.ttl'))
      const owlFile = files.find((f) => f.endsWith('.owl.ttl'))

      if (!shaclFile) continue // Skip domains without SHACL shapes

      const shaclContent = readFileSync(join(domainDir, shaclFile), 'utf-8')
      const owlContent = owlFile ? readFileSync(join(domainDir, owlFile), 'utf-8') : ''

      // Collect all @prefix declarations from this domain's files
      const filePrefixes = {
        ...extractPrefixes(shaclContent),
        ...extractPrefixes(owlContent),
      }

      // Extract namespace
      const namespace = extractNamespace(shaclContent, entry) || extractNamespace(owlContent, entry)
      if (!namespace) continue

      // Resolve the actual TTL prefix alias (may differ from directory name,
      // e.g., directory "openlabel-v2" uses TTL prefix "openlabel_v2").
      const prefixMatch = findPrefixAlias(filePrefixes, namespace)
      const ttlPrefix = prefixMatch?.alias ?? entry
      // Use the resolved namespace (with separator) when the prefix was found
      const resolvedNamespace = prefixMatch?.resolvedNs ?? namespace

      // Extract target classes using the actual TTL prefix
      const targetClasses = extractTargetClasses(shaclContent, resolvedNamespace, ttlPrefix)
      if (targetClasses.length === 0) continue

      // rdfs:subClassOf edges power the component-base signal. Parse both files
      // (OWL carries the hierarchy; SHACL occasionally does too) with a real
      // RDF parser so blank-node restrictions don't hide named superclasses.
      const subClassEdges = [
        ...extractSubClassOfEdges(owlContent),
        ...extractSubClassOfEdges(shaclContent),
      ]

      raw.push({
        entry,
        namespace: resolvedNamespace,
        ttlPrefix,
        filePrefixes,
        targetClasses,
        subClassEdges,
      })
    }
  }

  // Pass 2: classify component bases across the whole ontology, then pick each
  // domain's primary asset class structurally (no ontology-specific names).
  const targetClassDomain = new Map<string, string>()
  for (const d of raw) for (const tc of d.targetClasses) targetClassDomain.set(tc.iri, d.entry)

  const allEdges = raw.flatMap((d) => d.subClassEdges)
  const superOf = new Map<string, Set<string>>()
  for (const { sub, super: sup } of allEdges) {
    if (!superOf.has(sub)) superOf.set(sub, new Set())
    superOf.get(sub)!.add(sup)
  }
  const componentBases = computeComponentBases(allEdges, targetClassDomain)

  for (const d of raw) {
    const primaryClass = selectPrimaryAssetClass(d.targetClasses, d.entry, componentBases, superOf)
    if (!primaryClass) continue

    domains.set(d.entry, {
      name: d.entry,
      namespace: d.namespace,
      prefix: d.ttlPrefix,
      targetClass: `${d.ttlPrefix}:${primaryClass.localName}`,
      targetClassIri: primaryClass.iri,
      version: extractVersion(d.namespace),
      shapes: d.targetClasses.map((tc) => tc.localName),
      declaredPrefixes: d.filePrefixes,
    })
  }

  const domainNames = [...domains.keys()].sort()

  const registry: DomainRegistry = {
    domains,
    domainNames,
    prefixesFor(domain: string): string {
      const desc = domains.get(domain)
      if (!desc) return ''

      // Combine standard prefixes with all prefixes declared in this domain's files.
      // This naturally includes cross-domain imports (a supporting domain's
      // prefix used inside another domain's files)
      // without hard-coding any specific prefix names.
      const prefixes: Record<string, string> = {
        ...STANDARD_PREFIXES,
        ...desc.declaredPrefixes,
      }

      return Object.entries(prefixes)
        .map(([key, uri]) => `PREFIX ${key}: <${uri}>`)
        .join('\n')
    },
    allPrefixes(): string {
      const prefixes: Record<string, string> = {
        ...STANDARD_PREFIXES,
      }
      for (const desc of domains.values()) {
        Object.assign(prefixes, desc.declaredPrefixes)
      }
      return Object.entries(prefixes)
        .map(([key, uri]) => `PREFIX ${key}: <${uri}>`)
        .join('\n')
    },
    resolveByIriDomain(iriDomain: string): DomainDescriptor | undefined {
      // Direct match first (most domains: directory name === IRI path segment)
      const direct = domains.get(iriDomain)
      if (direct) return direct

      // Fallback: find a domain whose namespace contains `/{iriDomain}/v`
      const pattern = `/${iriDomain}/v`
      for (const desc of domains.values()) {
        if (desc.namespace.includes(pattern)) return desc
      }
      return undefined
    },
    domainForIri(iri: string): string | undefined {
      // Longest-prefix match: among all domain namespaces that are a
      // prefix of the IRI, pick the one with the longest namespace.
      // This avoids misclassification when one namespace is a prefix
      // of another (e.g. a base namespace vs a nested sub-namespace).
      let bestName: string | undefined
      let bestLen = 0
      for (const [name, desc] of domains) {
        if (iri.startsWith(desc.namespace) && desc.namespace.length > bestLen) {
          bestName = name
          bestLen = desc.namespace.length
        }
      }
      return bestName
    },
    getAllNamespaces(): Set<string> {
      const ns = new Set<string>()
      for (const desc of domains.values()) {
        ns.add(desc.namespace)
        for (const v of Object.values(desc.declaredPrefixes)) {
          ns.add(v)
        }
      }
      return ns
    },
  }

  cachedRegistry = registry
  return registry
}

/** Reset cached registry (for testing) */
export function resetDomainRegistry(): void {
  cachedRegistry = null
}

/**
 * Get a single domain descriptor by name.
 * Returns undefined if domain is not found.
 */
export async function getDomain(name: string): Promise<DomainDescriptor | undefined> {
  const registry = await buildDomainRegistry()
  return registry.domains.get(name)
}

/**
 * List all available domain names.
 */
export async function listDomains(): Promise<string[]> {
  const registry = await buildDomainRegistry()
  return registry.domainNames
}

/**
 * Resolve the primary domain to use when a caller has not specified one.
 *
 * The registry's `domainNames` is sorted lexicographically at build time,
 * so the choice is deterministic and ontology-agnostic — it never names
 * a specific domain in source.
 *
 * Throws `OntologySourcesError` when the registry exposes zero domains:
 * that condition is always a misconfiguration (missing artifacts, broken
 * manifest, empty submodule), and silently guessing a domain name would
 * mask the underlying problem.
 */
export async function getPrimaryDomain(): Promise<string> {
  const registry = await buildDomainRegistry()
  const first = registry.domainNames[0]
  if (!first) {
    throw new OntologySourcesError(
      'No ontology domains discovered — check ontology-sources.json or that the workspace artifacts directory contains at least one *.shacl.ttl file.'
    )
  }
  return first
}
