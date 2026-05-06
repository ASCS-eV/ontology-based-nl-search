import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), '.ontology-cache')
const CONTEXT_FILE = path.join(CACHE_DIR, 'context.txt')
const ONTOLOGY_FILES_DIR = path.join(CACHE_DIR, 'files')

/**
 * Get the ontology context string for LLM prompting.
 * Fetches from GitHub if not cached, otherwise uses cache.
 */
export async function getOntologyContext(): Promise<string> {
  // Try cache first
  if (existsSync(CONTEXT_FILE)) {
    return readFile(CONTEXT_FILE, 'utf-8')
  }

  // Fetch and build context
  const context = await fetchAndBuildContext()
  return context
}

/**
 * Force refresh of the ontology cache.
 */
export async function refreshOntologyCache(): Promise<string> {
  return fetchAndBuildContext()
}

async function fetchAndBuildContext(): Promise<string> {
  await mkdir(ONTOLOGY_FILES_DIR, { recursive: true })

  const repo = process.env.ONTOLOGY_REPO || 'ASCS-eV/ontology-management-base'
  const branch = process.env.ONTOLOGY_BRANCH || 'main'

  // Fetch the SimulationAsset ontology files
  const ontologyPaths = [
    'ENVITED-X_Ontology/SimulationAsset/ENVITED-X_SimulationAsset.ttl',
  ]

  const ontologyContents: string[] = []

  for (const ontologyPath of ontologyPaths) {
    try {
      const url = `https://raw.githubusercontent.com/${repo}/${branch}/${ontologyPath}`
      const response = await fetch(url)

      if (!response.ok) {
        console.warn(`Failed to fetch ontology: ${url} (${response.status})`)
        continue
      }

      const content = await response.text()

      // Cache the file locally
      const localPath = path.join(ONTOLOGY_FILES_DIR, path.basename(ontologyPath))
      await writeFile(localPath, content, 'utf-8')

      ontologyContents.push(content)
    } catch (error) {
      console.warn(`Error fetching ontology ${ontologyPath}:`, error)
    }
  }

  // Build a summarized context for the LLM
  const context = buildContextFromOntologies(ontologyContents)

  // Cache the built context
  await writeFile(CONTEXT_FILE, context, 'utf-8')

  return context
}

/**
 * Parse Turtle ontology files and extract relevant classes,
 * properties, and prefixes for LLM context.
 */
function buildContextFromOntologies(ontologyContents: string[]): string {
  const prefixes: string[] = []
  const classes: string[] = []
  const properties: string[] = []

  for (const content of ontologyContents) {
    // Extract prefixes
    const prefixMatches = content.matchAll(/@prefix\s+(\S+)\s+<([^>]+)>\s*\./g)
    for (const match of prefixMatches) {
      prefixes.push(`PREFIX ${match[1]} <${match[2]}>`)
    }

    // Extract class definitions
    const classMatches = content.matchAll(/(\S+)\s+a\s+(?:owl:Class|rdfs:Class)/g)
    for (const match of classMatches) {
      classes.push(match[1])
    }

    // Extract properties
    const propMatches = content.matchAll(/(\S+)\s+a\s+(?:owl:(?:Object|Data|Annotation)Property|rdf:Property)/g)
    for (const match of propMatches) {
      properties.push(match[1])
    }
  }

  // If no structured data was extracted, provide the raw content (truncated)
  if (classes.length === 0 && properties.length === 0 && ontologyContents.length > 0) {
    const rawContent = ontologyContents.join('\n\n')
    // Truncate to fit in LLM context
    const maxLength = 8000
    return rawContent.length > maxLength
      ? rawContent.substring(0, maxLength) + '\n\n... (truncated)'
      : rawContent
  }

  return [
    '## Prefixes',
    ...prefixes,
    '',
    '## Classes',
    ...classes.map(c => `- ${c}`),
    '',
    '## Properties',
    ...properties.map(p => `- ${p}`),
  ].join('\n')
}
