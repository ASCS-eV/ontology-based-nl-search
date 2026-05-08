/**
 * Schema Loader — loads ontology OWL + SHACL files into a named graph.
 *
 * The ontology schema (class hierarchies, property definitions, sh:in
 * enumerations) lives in a dedicated named graph so it can be queried
 * separately from instance data.
 *
 * @see https://www.w3.org/TR/sparql11-query/#namedGraphs
 */
import type { SparqlStore } from '@ontology-search/sparql/types'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** Named graph IRI for ontology schema triples */
export const SCHEMA_GRAPH = 'urn:graph:schema'

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
 * Discover all *.shacl.ttl and *.owl.ttl files from configured ontology sources.
 * Each subdirectory represents a domain (hdmap, georeference, scenario, etc.)
 */
function discoverSchemaFiles(): { path: string; domain: string }[] {
  const roots = getArtifactRoots()
  const results: { path: string; domain: string }[] = []

  for (const root of roots) {
    if (!existsSync(root)) continue

    for (const entry of readdirSync(root)) {
      const domainDir = join(root, entry)
      if (!statSync(domainDir).isDirectory()) continue

      for (const file of readdirSync(domainDir)) {
        if (file.endsWith('.shacl.ttl') || file.endsWith('.owl.ttl')) {
          results.push({ path: join(domainDir, file), domain: entry })
        }
      }
    }
  }

  return results
}

/**
 * Load all ontology schema files (OWL + SHACL) into the store's schema named graph.
 * Called once at startup. Returns metadata about what was loaded.
 */
export async function loadSchemaGraph(
  store: SparqlStore
): Promise<{ domains: string[]; fileCount: number }> {
  const files = discoverSchemaFiles()
  const domains = new Set<string>()
  let fileCount = 0

  for (const { path: filePath, domain } of files) {
    try {
      const ttl = readFileSync(filePath, 'utf-8')
      await store.loadTurtle(ttl, SCHEMA_GRAPH)
      domains.add(domain)
      fileCount++
    } catch (err) {
      console.warn(`[schema-loader] Failed to load ${basename(filePath)}: ${err}`)
    }
  }

  console.log(
    `[schema-loader] Loaded ${fileCount} schema files from ${domains.size} domains into <${SCHEMA_GRAPH}>`
  )

  return { domains: [...domains], fileCount }
}
