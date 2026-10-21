/**
 * Built-in / declared instance-data loader.
 *
 * STANDARDS — the loaded files conform to:
 *   [JSON-LD11] JSON-LD 1.1 — docs/specs/references/json-ld11.md
 *               https://www.w3.org/TR/json-ld11/  (`*.jsonld`, `@context` resolution)
 *   [TURTLE]    RDF 1.1 Turtle — docs/specs/references/turtle.md
 *               https://www.w3.org/TR/turtle/      (`*.ttl` instance + fallback data)
 * `@context` URLs are resolved to local context files before `loadJsonLd`, per
 * [JSON-LD11] §3.1 (the Context).
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import {
  type ArtifactRoot,
  getDataSources,
  isDomainSelected,
} from '@ontology-search/ontology/sources'
import type { SparqlStore } from '@ontology-search/sparql/types'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { withDocumentBase } from './schema-loader.js'

const log = createComponentLogger('data-loader')

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
 * hardcoded domain assumptions.
 *
 * Production systems should always have sample files present, so this
 * fallback is primarily for development/troubleshooting.
 */
const FALLBACK_TURTLE = `
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
# Empty graph — load sample data files for populated results
`

/**
 * Discover built-in sample data files from the package's data/ directory.
 * No hardcoded filenames — any .jsonld, .json, or .ttl files present are loaded.
 */
function discoverBuiltinDataFiles(): { jsonld: string[]; ttl: string[] } {
  if (!existsSync(DATA_DIR)) return { jsonld: [], ttl: [] }
  const files = readdirSync(DATA_DIR)
  return {
    jsonld: files.filter((f) => f.endsWith('.jsonld') || f.endsWith('.json')),
    ttl: files.filter((f) => f.endsWith('.ttl')),
  }
}

/**
 * Find the *.context.jsonld files of an artifact root and build a map from
 * their declared `@vocab` / `@base` IRI to the parsed context object. Used to
 * inline remote contexts locally.
 *
 * Every domain's contexts are read, including those the source's `domains` /
 * `excludeDomains` selection leaves out: a context only tells the parser how
 * to read a data file, and instance data may well use the context of an
 * unselected bundle (an umbrella bundle left out so its shapes do not load
 * twice). Where two contexts claim the same IRI, a selected domain's wins —
 * selected domains are read last, each tier in sorted order, so the winner
 * never depends on directory order.
 */
function buildContextMap(artifacts: ArtifactRoot): Map<string, unknown> {
  const map = new Map<string, unknown>()
  if (!existsSync(artifacts.path)) return map

  const domains = readdirSync(artifacts.path).sort()
  const selectedLast = [
    ...domains.filter((d) => !isDomainSelected(artifacts, d)),
    ...domains.filter((d) => isDomainSelected(artifacts, d)),
  ]
  for (const domain of selectedLast) {
    const domainDir = join(artifacts.path, domain)
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
    const localCtx = contextUrlCandidates(remoteUrl)
      .map((url) => contextMap.get(url))
      .find((ctx) => ctx !== undefined)

    if (!localCtx) return jsonContent

    // Replace remote URL with inline context
    doc['@context'] = localCtx
    return JSON.stringify(doc)
  } catch {
    return jsonContent
  }
}

/**
 * Keys a remote `@context` URL may be indexed under: the URL itself with and
 * without a trailing slash, plus — for the `<ontology>/context` / `<ontology>#context`
 * form that OMB-style catalogs publish — the ontology namespace it names: the
 * base followed by the separator the URL uses (`<ontology>#` for a hash
 * namespace), then with a slash, then bare.
 */
export function contextUrlCandidates(remoteUrl: string): string[] {
  const candidates = [remoteUrl, remoteUrl + '/', remoteUrl.replace(/\/$/, '')]
  const base = remoteUrl.replace(/[/#]context\/?$/, '')
  if (base !== remoteUrl) {
    const separator = remoteUrl.charAt(base.length)
    candidates.push(base + separator, base + '/', base)
  }
  return [...new Set(candidates)]
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
  sources: { dataDir: string; artifacts: ArtifactRoot }[]
): Promise<number> {
  let loaded = 0
  for (const { dataDir, artifacts } of sources) {
    if (!existsSync(dataDir)) continue
    const contextMap = buildContextMap(artifacts)
    const files = readdirSync(dataDir)
    const sourceName = basename(dataDir)
    for (const file of files) {
      const path = join(dataDir, file)
      const content = loadDataFile(path)
      if (!content) continue
      if (file.endsWith('.jsonld') || file.endsWith('.json')) {
        const resolved = resolveLocalContext(content, contextMap)
        await store.loadJsonLd(resolved)
        loaded++
        log.debug('Loaded data file', { source: sourceName, file })
      } else if (file.endsWith('.ttl')) {
        await store.loadTurtle(withDocumentBase(content, path))
        loaded++
        log.debug('Loaded data file', { source: sourceName, file })
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
    log.info('Loading data from declared sources', {
      sourceCount: dataSources.length,
      directories: dataSources.map((s) => basename(s.dataDir)),
    })
    const loaded = await loadFromDataSources(store, dataSources)
    log.info('Data loading complete', { fileCount: loaded, mode: 'manifest' })
    if (loaded === 0) {
      await store.loadTurtle(FALLBACK_TURTLE)
    }
    return
  }

  // Fallback: built-in sample data from the package's data/ directory.
  log.info('No data sources in manifest — loading built-in sample data from data/')
  let loaded = 0
  const builtin = discoverBuiltinDataFiles()

  for (const file of builtin.jsonld) {
    const data = loadDataFile(join(DATA_DIR, file))
    if (data) {
      await store.loadJsonLd(data)
      loaded++
      log.debug('Loaded built-in data file', { file })
    }
  }

  if (loaded === 0) {
    for (const file of builtin.ttl) {
      const path = join(DATA_DIR, file)
      const data = loadDataFile(path)
      if (data) {
        await store.loadTurtle(withDocumentBase(data, path))
        loaded++
        log.debug('Loaded built-in data file', { file })
      }
    }
  }

  log.info('Built-in data loading complete', { fileCount: loaded })
  if (loaded === 0) {
    await store.loadTurtle(FALLBACK_TURTLE)
  }
}
