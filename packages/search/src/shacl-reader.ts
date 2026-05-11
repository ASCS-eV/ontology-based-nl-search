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
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
 * Resolve workspace root by walking up from this package.
 */
function findWorkspaceRoot(): string {
  if (process.env['ONTOLOGY_ROOT']) return process.env['ONTOLOGY_ROOT']

  let dir = join(__dirname, '..', '..', '..')
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  return process.cwd()
}

/**
 * Get ontology artifact root directories from ontology-sources.json.
 */
function getArtifactRoots(): string[] {
  const root = findWorkspaceRoot()
  const configPath = join(root, 'ontology-sources.json')

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const sources = config.sources || []
      return sources.map((s: { path: string }) => join(root, s.path))
    } catch {
      // Fall through to default
    }
  }

  return [
    join(
      root,
      'submodules',
      'hd-map-asset-example',
      'submodules',
      'sl-5-8-asset-tools',
      'submodules',
      'ontology-management-base',
      'artifacts'
    ),
  ]
}

/**
 * Read all SHACL files from ontology sources, excluding oversized domains.
 *
 * Returns an array of domain content objects sorted by domain name.
 * Each entry contains the raw Turtle content of the .shacl.ttl file.
 */
export function readShaclFiles(): ShaclDomainContent[] {
  const roots = getArtifactRoots()
  const results: ShaclDomainContent[] = []

  for (const root of roots) {
    if (!existsSync(root)) continue

    for (const entry of readdirSync(root)) {
      if (EXCLUDED_DOMAINS.has(entry)) continue

      const domainDir = join(root, entry)
      if (!statSync(domainDir).isDirectory()) continue

      for (const file of readdirSync(domainDir)) {
        if (!file.endsWith('.shacl.ttl')) continue

        const filePath = join(domainDir, file)
        try {
          const content = readFileSync(filePath, 'utf-8')
          results.push({
            domain: entry,
            content,
            fileName: file,
            sizeBytes: Buffer.byteLength(content, 'utf-8'),
          })
        } catch (err) {
          console.warn(`[shacl-reader] Failed to read ${basename(filePath)}: ${err}`)
        }
      }
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
