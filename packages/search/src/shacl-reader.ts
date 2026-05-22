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
import { discoverShapeFiles } from '@ontology-search/ontology/sources'
import { readFileSync, statSync } from 'fs'
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
        console.info(
          `[shacl-reader] Skipping ${basename(filePath)} (${(fileSize / 1024).toFixed(0)} KB) — exceeds ${(MAX_SHACL_SIZE_BYTES / 1024).toFixed(0)} KB threshold`
        )
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
