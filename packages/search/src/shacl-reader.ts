/**
 * SHACL Reader — reads raw SHACL Turtle files from the ontology source directories.
 *
 * Instead of extracting and flattening vocabulary into tables, this module
 * provides the raw SHACL content so the LLM can read the full shape definitions
 * natively. The LLM understands Turtle/SHACL and can resolve synonyms,
 * patterns, and constraints directly from the source.
 *
 * Domains excluded:
 * - gx: 2.3 MB file, only 7 properties used by envited-x (which re-declares them)
 */
import { discoverShapeFiles } from '@ontology-search/ontology/sources'
import { readFileSync } from 'fs'
import { basename } from 'path'

/** A single SHACL file's content with its domain metadata */
export interface ShaclDomainContent {
  /** Domain name (e.g., "hdmap", "scenario") */
  domain: string
  /** Raw Turtle content of the .shacl.ttl file */
  content: string
  /** File name */
  fileName: string
  /** Content size in bytes */
  sizeBytes: number
}

/**
 * Domains excluded from raw SHACL injection into the LLM prompt.
 *
 * gx.shacl.ttl is 2.3 MB (~572K tokens) — far too large.
 * envited-x.shacl.ttl already re-declares the 7 gx: properties it uses
 * (gx:name, gx:description, gx:license, gx:copyrightOwnedBy, etc.)
 * with their constraints, so the LLM still sees them.
 */
const EXCLUDED_DOMAINS = new Set(['gx'])

/**
 * Read all SHACL files from ontology sources, excluding oversized domains.
 *
 * Returns an array of domain content objects sorted by domain name.
 * Each entry contains the raw Turtle content of the .shacl.ttl file.
 */
export function readShaclFiles(): ShaclDomainContent[] {
  const files = discoverShapeFiles({ exclude: EXCLUDED_DOMAINS })
  const results: ShaclDomainContent[] = []

  for (const { path: filePath, domain } of files) {
    try {
      const content = readFileSync(filePath, 'utf-8')
      results.push({
        domain,
        content,
        fileName: basename(filePath),
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
      })
    } catch (err) {
      console.warn(`[shacl-reader] Failed to read ${basename(filePath)}: ${err}`)
    }
  }

  results.sort((a, b) => a.domain.localeCompare(b.domain))

  const totalSize = results.reduce((sum, r) => sum + r.sizeBytes, 0)
  console.info(
    `[shacl-reader] Read ${results.length} SHACL files from ${new Set(results.map((r) => r.domain)).size} domains (${(totalSize / 1024).toFixed(0)} KB total)`
  )

  return results
}

/** Cached SHACL content — read once at startup, reused for all requests */
let cachedShaclContent: ShaclDomainContent[] | null = null

/**
 * Get SHACL content with caching. Reads files on first call, returns cached result after.
 */
export function getShaclContent(): ShaclDomainContent[] {
  if (!cachedShaclContent) {
    cachedShaclContent = readShaclFiles()
  }
  return cachedShaclContent
}

/** Reset the cache (for testing) */
export function resetShaclCache(): void {
  cachedShaclContent = null
}
