/**
 * SHACL Reader — reads raw SHACL Turtle files from the ontology source directories.
 *
 * Instead of extracting and flattening vocabulary into tables, this module
 * provides the raw SHACL content so the LLM can read the full shape definitions
 * natively. The LLM understands Turtle/SHACL and can resolve synonyms,
 * patterns, and constraints directly from the source.
 *
 * Oversized SHACL files (>500 KB) are automatically excluded to avoid
 * exceeding the LLM's context window. This is ontology-agnostic — any
 * domain with a large SHACL file is excluded regardless of its name.
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { discoverShapeFiles } from '@ontology-search/ontology/sources'
import { readFileSync, statSync } from 'fs'
import { basename } from 'path'

const log = createComponentLogger('shacl-reader')

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
 * Maximum SHACL file size (in bytes) to include in the LLM prompt.
 * Files larger than this threshold are skipped to avoid exceeding
 * the LLM's context window. Ontology-agnostic — applies regardless
 * of which ontology is loaded.
 */
const MAX_SHACL_SIZE_BYTES = 500_000

/**
 * Read all SHACL files from ontology sources, excluding oversized files.
 *
 * Returns an array of domain content objects sorted by domain name.
 * Each entry contains the raw Turtle content of the .shacl.ttl file.
 */
export function readShaclFiles(): ShaclDomainContent[] {
  const files = discoverShapeFiles()
  const results: ShaclDomainContent[] = []

  for (const { path: filePath, domain } of files) {
    try {
      const fileSize = statSync(filePath).size
      if (fileSize > MAX_SHACL_SIZE_BYTES) {
        log.info('Skipping oversized SHACL file', {
          file: basename(filePath),
          sizeKb: Math.round(fileSize / 1024),
          thresholdKb: Math.round(MAX_SHACL_SIZE_BYTES / 1024),
        })
        continue
      }

      const content = readFileSync(filePath, 'utf-8')
      results.push({
        domain,
        content,
        fileName: basename(filePath),
        sizeBytes: Buffer.byteLength(content, 'utf-8'),
      })
    } catch (err) {
      log.warn('Failed to read SHACL file', { file: basename(filePath), error: String(err) })
    }
  }

  results.sort((a, b) => a.domain.localeCompare(b.domain))

  const totalSize = results.reduce((sum, r) => sum + r.sizeBytes, 0)
  const domainNames = [...new Set(results.map((r) => r.domain))].sort()
  log.info('Read SHACL files', {
    fileCount: results.length,
    domainCount: domainNames.length,
    domains: domainNames,
    totalKb: Math.round(totalSize / 1024),
  })

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
