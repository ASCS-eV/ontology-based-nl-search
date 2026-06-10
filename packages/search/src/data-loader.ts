import { getDataSources } from '@ontology-search/ontology/sources'
import type { SparqlStore } from '@ontology-search/sparql/types'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, '..', 'data')

/**
 * Load a data file by absolute path.
 * Returns the raw file content, or empty string on read failure.
 */
function loadDataFile(filePath: string): string {
  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

/**
 * Empty fallback data. If sample data files are missing, the store loads
 * an empty graph. This ensures the system works with any ontology — no
 * hardcoded domain names or ENVITED-X assumptions.
 *
 * Production systems should always have sample files present, so this
 * fallback is primarily for development/troubleshooting.
 */
const FALLBACK_TURTLE = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
# Empty graph — load sample data files for populated results
`

/** Built-in sample data shipped with the search package (OMB demo data). */
const BUILTIN_JSONLD = [
  'sample-hdmap.jsonld',
  'sample-scenarios.jsonld',
  'sample-ositrace.jsonld',
  'sample-environment-models.jsonld',
  'sample-surface-models.jsonld',
]

const BUILTIN_TTL = [
  'sample-assets.ttl',
  'sample-scenarios.ttl',
  'sample-ositrace.ttl',
  'sample-environment-models.ttl',
  'sample-surface-models.ttl',
]

/**
 * Find all *.context.jsonld files in an artifacts directory tree and build
 * a map from their declared `@context["@base"]` or filename-derived IRI to
 * the parsed context object. Used to inline remote contexts locally.
 */
function buildContextMap(artifactsDir: string): Map<string, unknown> {
  const map = new Map<string, unknown>()
  if (!existsSync(artifactsDir)) return map

  for (const domain of readdirSync(artifactsDir)) {
    const domainDir = join(artifactsDir, domain)
    try {
      const files = readdirSync(domainDir)
      for (const file of files) {
        if (!file.endsWith('.context.jsonld')) continue
        const content = loadDataFile(join(domainDir, file))
        if (!content) continue
        try {
          const ctx = JSON.parse(content)
          // The context file's @context object is what we want to inline
          if (ctx['@context']) {
            // Index by any @import or @base IRI, or by the namespace pattern
            // Typically the context IRI matches the ontology namespace
            const ctxObj = ctx['@context']
            if (typeof ctxObj === 'object' && ctxObj['@vocab']) {
              map.set(ctxObj['@vocab'], ctxObj)
            }
            // Also index by common URL patterns (with/without trailing slash)
            if (typeof ctxObj === 'object' && ctxObj['@base']) {
              map.set(ctxObj['@base'], ctxObj)
              map.set(ctxObj['@base'].replace(/\/$/, ''), ctxObj)
            }
          }
        } catch {
          // skip unparseable context files
        }
      }
    } catch {
      // skip non-directories
    }
  }
  return map
}

/**
 * Resolve a remote @context reference to a local inline context.
 * Returns the modified JSON string with the context inlined, or the
 * original string if no local context matches.
 */
function resolveLocalContext(jsonContent: string, contextMap: Map<string, unknown>): string {
  if (contextMap.size === 0) return jsonContent

  try {
    const doc = JSON.parse(jsonContent)
    if (typeof doc['@context'] !== 'string') return jsonContent

    const remoteUrl = doc['@context']
    // Try exact match, then with/without trailing slash
    const localCtx =
      contextMap.get(remoteUrl) ??
      contextMap.get(remoteUrl + '/') ??
      contextMap.get(remoteUrl.replace(/\/$/, ''))

    if (!localCtx) return jsonContent

    // Replace remote URL with inline context
    doc['@context'] = localCtx
    return JSON.stringify(doc)
  } catch {
    return jsonContent
  }
}

/**
 * Load instance data from explicit `data` directories declared in
 * `ontology-sources.json`. For each source, resolves remote @context URLs
 * to local context files from the corresponding artifacts directory.
 *
 * Returns the number of files successfully loaded.
 */
async function loadFromDataSources(
  store: SparqlStore,
  sources: { dataDir: string; artifactsDir: string }[]
): Promise<number> {
  let loaded = 0
  for (const { dataDir, artifactsDir } of sources) {
    if (!existsSync(dataDir)) continue
    const contextMap = buildContextMap(artifactsDir)
    const files = readdirSync(dataDir)
    for (const file of files) {
      const path = join(dataDir, file)
      const content = loadDataFile(path)
      if (!content) continue
      if (file.endsWith('.jsonld') || file.endsWith('.json')) {
        const resolved = resolveLocalContext(content, contextMap)
        await store.loadJsonLd(resolved)
        loaded++
      } else if (file.endsWith('.ttl')) {
        await store.loadTurtle(content)
        loaded++
      }
    }
  }
  return loaded
}

/**
 * Load instance data into the SPARQL store.
 *
 * Strategy:
 * - If `ontology-sources.json` declares `data` paths → load ONLY from those
 *   (exercise/submodule mode — isolates instance data to the declared scope)
 * - Otherwise → load built-in sample data (standalone OMB demo mode)
 */
export async function loadSampleData(store: SparqlStore): Promise<void> {
  const dataSources = getDataSources()

  // When explicit data directories are declared, use ONLY those.
  if (dataSources.length > 0) {
    const loaded = await loadFromDataSources(store, dataSources)
    if (loaded === 0) {
      await store.loadTurtle(FALLBACK_TURTLE)
    }
    return
  }

  // Fallback: built-in sample data (OMB demo assets).
  let loaded = 0

  for (const file of BUILTIN_JSONLD) {
    const data = loadDataFile(join(DATA_DIR, file))
    if (data) {
      await store.loadJsonLd(data)
      loaded++
    }
  }

  if (loaded === 0) {
    for (const file of BUILTIN_TTL) {
      const data = loadDataFile(join(DATA_DIR, file))
      if (data) {
        await store.loadTurtle(data)
        loaded++
      }
    }
  }

  if (loaded === 0) {
    await store.loadTurtle(FALLBACK_TURTLE)
  }
}
