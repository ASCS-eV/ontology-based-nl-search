import type { SparqlStore } from '@ontology-search/sparql/types'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DATA_DIR = join(__dirname, '..', 'data')

/**
 * Load a sample data file for development/testing.
 * Returns the raw file content, or empty string if the file is missing.
 */
function loadDataFile(filename: string): string {
  try {
    return readFileSync(join(DATA_DIR, filename), 'utf-8')
  } catch {
    // intentional: graceful degradation — sample files are optional and
    // the caller falls back to FALLBACK_TURTLE when none load successfully
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

/**
 * Load sample data into the SPARQL store for development/testing.
 * Prefers JSON-LD files (`.jsonld`) and falls back to Turtle (`.ttl`).
 * Falls back to an empty graph if no sample files are present.
 * 
 * This function is ontology-agnostic: it loads whatever sample data files
 * exist without assuming any domain names or ontology structure.
 */
export async function loadSampleData(store: SparqlStore): Promise<void> {
  const jsonldFiles = [
    'sample-hdmap.jsonld',
    'sample-scenarios.jsonld',
    'sample-ositrace.jsonld',
    'sample-environment-models.jsonld',
    'sample-surface-models.jsonld',
  ]

  const ttlFiles = [
    'sample-assets.ttl',
    'sample-scenarios.ttl',
    'sample-ositrace.ttl',
    'sample-environment-models.ttl',
    'sample-surface-models.ttl',
  ]

  let loaded = 0

  // Try JSON-LD files first
  for (const file of jsonldFiles) {
    const data = loadDataFile(file)
    if (data) {
      await store.loadJsonLd(data)
      loaded++
    }
  }

  // Fall back to TTL files if no JSON-LD files were found
  if (loaded === 0) {
    for (const file of ttlFiles) {
      const data = loadDataFile(file)
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
