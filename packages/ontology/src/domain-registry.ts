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

import { getArtifactRoots } from './sources.js'

/** Metadata for a single ontology domain (e.g., hdmap, scenario) */
export interface DomainDescriptor {
  /** Short domain name (directory name, e.g., "hdmap") */
  name: string
  /** Full namespace IRI (e.g., "https://w3id.org/ascs-ev/envited-x/hdmap/v6/") */
  namespace: string
  /** SPARQL prefix alias (e.g., "hdmap") */
  prefix: string
  /** OWL target class for assets (e.g., "hdmap:HdMap") */
  targetClass: string
  /** Full IRI of the target class */
  targetClassIri: string
  /** Version extracted from namespace (e.g., "v6") */
  version: string
  /** Shape names that define sub-structures (Content, Format, Quantity, Quality, DataSource) */
  shapes: string[]
  /** Whether this domain has georeference support */
  hasGeoreference: boolean
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
 * Extract all @prefix declarations from a TTL file.
 * Returns a map of prefix → namespace IRI.
 */
function extractPrefixes(ttlContent: string): Record<string, string> {
  const result: Record<string, string> = {}
  const regex = /@prefix\s+([\w-]+):\s*<([^>]+)>/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(ttlContent)) !== null) {
    if (match[1] && match[2]) {
      result[match[1]] = match[2]
    }
  }
  return result
}

/**
 * Extract namespace IRI from an OWL or SHACL TTL file by finding the ontology declaration
 * or the dominant @prefix with the directory name.
 */
function extractNamespace(ttlContent: string, domainName: string): string | null {
  // Look for @prefix with the domain name
  const prefixRegex = new RegExp(`@prefix\\s+${domainName}:\\s*<([^>]+)>`, 'i')
  const match = ttlContent.match(prefixRegex)
  if (match && match[1]) return match[1]

  // Fallback: look for owl:Ontology IRI
  const ontologyMatch = ttlContent.match(/<([^>]+)>\s+a\s+owl:Ontology/)
  if (ontologyMatch && ontologyMatch[1]) return ontologyMatch[1]

  return null
}

/**
 * Extract target classes from SHACL file using regex (fast, no SPARQL needed).
 * Pattern: `sh:targetClass domain:ClassName`
 */
function extractTargetClasses(
  ttlContent: string,
  namespace: string,
  prefix: string
): { localName: string; iri: string }[] {
  const results: { localName: string; iri: string }[] = []
  const regex = new RegExp(`sh:targetClass\\s+${prefix}:(\\w+)`, 'g')
  let match: RegExpExecArray | null

  while ((match = regex.exec(ttlContent)) !== null) {
    const localName = match[1]
    if (!localName) continue
    results.push({
      localName,
      iri: namespace + localName,
    })
  }

  return results
}

/**
 * Extract version from namespace IRI (e.g., "v6" from ".../hdmap/v6/")
 */
function extractVersion(namespace: string): string {
  const match = namespace.match(/\/(v\d+)\/?$/)
  return match?.[1] ?? 'unknown'
}

/**
 * Determine the primary asset class for a domain.
 * Convention: The class named after the domain in PascalCase is the asset class.
 * E.g., hdmap → HdMap, scenario → Scenario, surface-model → SurfaceModel
 */
function findPrimaryAssetClass(
  targetClasses: { localName: string; iri: string }[],
  domainName: string
): { localName: string; iri: string } | null {
  // Convert domain-name to PascalCase variants to match
  const pascalCase = domainName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

  // Known domain specification sub-shapes to exclude
  const subShapes = new Set([
    'Content',
    'Format',
    'Quantity',
    'Quality',
    'DataSource',
    'DomainSpecification',
    'Georeference',
  ])

  // Prefer exact PascalCase match
  const exact = targetClasses.find((tc) => tc.localName === pascalCase)
  if (exact) return exact

  // Fallback: first class that isn't a known sub-shape
  const primary = targetClasses.find((tc) => !subShapes.has(tc.localName))
  return primary || targetClasses[0] || null
}

/**
 * Check if a domain has georeference support by inspecting owl:imports
 */
function hasGeoreferenceImport(owlContent: string): boolean {
  return owlContent.includes('georeference')
}

/**
 * Build the domain registry by scanning all artifact directories.
 */
export async function buildDomainRegistry(): Promise<DomainRegistry> {
  if (cachedRegistry) return cachedRegistry

  const roots = getArtifactRoots()
  const domains = new Map<string, DomainDescriptor>()

  for (const root of roots) {
    if (!existsSync(root)) continue

    let entries: string[]
    try {
      entries = readdirSync(root)
    } catch {
      // intentional: root directory unreadable — skip silently, other roots may work
      continue
    }

    for (const entry of entries) {
      const domainDir = join(root, entry)
      try {
        if (!statSync(domainDir).isDirectory()) continue
      } catch {
        // intentional: stat failure on single entry — skip, don't crash all discovery
        continue
      }

      // Find SHACL and OWL files
      let files: string[]
      try {
        files = readdirSync(domainDir)
      } catch {
        // intentional: unreadable domain directory — skip
        continue
      }
      const shaclFile = files.find((f) => f.endsWith('.shacl.ttl'))
      const owlFile = files.find((f) => f.endsWith('.owl.ttl'))

      if (!shaclFile) continue // Skip domains without SHACL shapes

      let shaclContent: string
      let owlContent: string
      try {
        shaclContent = readFileSync(join(domainDir, shaclFile), 'utf-8')
        owlContent = owlFile ? readFileSync(join(domainDir, owlFile), 'utf-8') : ''
      } catch {
        // intentional: unreadable SHACL/OWL file — skip this domain
        continue
      }

      // Collect all @prefix declarations from this domain's files
      const filePrefixes = {
        ...extractPrefixes(shaclContent),
        ...extractPrefixes(owlContent),
      }

      // Extract namespace
      const namespace = extractNamespace(shaclContent, entry) || extractNamespace(owlContent, entry)
      if (!namespace) continue

      // Extract target classes
      const targetClasses = extractTargetClasses(shaclContent, namespace, entry)
      if (targetClasses.length === 0) continue

      // Find primary asset class
      const primaryClass = findPrimaryAssetClass(targetClasses, entry)
      if (!primaryClass) continue

      const version = extractVersion(namespace)
      const shapes = targetClasses.map((tc) => tc.localName)

      domains.set(entry, {
        name: entry,
        namespace,
        prefix: entry,
        targetClass: `${entry}:${primaryClass.localName}`,
        targetClassIri: primaryClass.iri,
        version,
        shapes,
        hasGeoreference: hasGeoreferenceImport(owlContent || shaclContent),
        declaredPrefixes: filePrefixes,
      })
    }
  }

  const domainNames = [...domains.keys()].sort()

  const registry: DomainRegistry = {
    domains,
    domainNames,
    prefixesFor(domain: string): string {
      const desc = domains.get(domain)
      if (!desc) return ''

      // Combine standard prefixes with all prefixes declared in this domain's files.
      // This naturally includes cross-domain imports (e.g., georeference in hdmap)
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
 * a specific domain in source. This deliberately replaces the legacy
 * `?? 'hdmap'` literal fallbacks that pinned the project to a single
 * ontology in production code paths.
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
