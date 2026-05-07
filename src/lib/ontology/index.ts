import { existsSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

// Re-export new ontology-driven modules
export type { ConceptGap, ConceptMatch, MatchResult } from './concept-matcher'
export { jaroWinklerDistance, matchConcepts, resetConceptMatcher } from './concept-matcher'
export type { SkosConcept, SkosIndex } from './skos-loader'
export { loadSkosIndex, resetSkosIndex } from './skos-loader'
export type { VocabularyIndex, VocabularyProperty } from './vocabulary-index'
export { buildVocabularyIndex, resetVocabularyIndex } from './vocabulary-index'

const CACHE_DIR = path.join(process.cwd(), '.ontology-cache')
const CONTEXT_FILE = path.join(CACHE_DIR, 'context.txt')
const ONTOLOGY_FILES_DIR = path.join(CACHE_DIR, 'files')

/** Path to local submodule containing ontology-management-base */
const LOCAL_OMB_PATH = path.join(
  process.cwd(),
  'submodules',
  'hd-map-asset-example',
  'submodules',
  'sl-5-8-asset-tools',
  'submodules',
  'ontology-management-base'
)

/** Ontology artifacts to load (relative to OMB root) */
const ONTOLOGY_ARTIFACTS = ['artifacts/hdmap/hdmap.owl.ttl']

/**
 * Get the ontology context string for LLM prompting.
 * Reads from local submodule if available, otherwise fetches from GitHub.
 * Results are cached for performance.
 */
export async function getOntologyContext(): Promise<string> {
  if (existsSync(CONTEXT_FILE)) {
    return readFile(CONTEXT_FILE, 'utf-8')
  }

  const context = await buildOntologyContext()
  return context
}

/**
 * Force refresh of the ontology cache.
 */
export async function refreshOntologyCache(): Promise<string> {
  return buildOntologyContext()
}

async function buildOntologyContext(): Promise<string> {
  await mkdir(ONTOLOGY_FILES_DIR, { recursive: true })

  const ontologyContents: string[] = []

  // Prefer local submodule path
  if (existsSync(LOCAL_OMB_PATH)) {
    for (const artifact of ONTOLOGY_ARTIFACTS) {
      const fullPath = path.join(LOCAL_OMB_PATH, artifact)
      if (existsSync(fullPath)) {
        const content = await readFile(fullPath, 'utf-8')
        ontologyContents.push(content)
      } else {
        console.warn(`Ontology artifact not found locally: ${fullPath}`)
      }
    }
  } else {
    // Fallback: fetch from GitHub
    const { getConfig } = await import('@/lib/config')
    const config = getConfig()
    const repo = config.ONTOLOGY_REPO
    const branch = config.ONTOLOGY_BRANCH

    for (const artifact of ONTOLOGY_ARTIFACTS) {
      try {
        const url = `https://raw.githubusercontent.com/${repo}/${branch}/${artifact}`
        const response = await fetch(url)

        if (!response.ok) {
          console.warn(`Failed to fetch ontology: ${url} (${response.status})`)
          continue
        }

        const content = await response.text()
        const localPath = path.join(ONTOLOGY_FILES_DIR, path.basename(artifact))
        await writeFile(localPath, content, 'utf-8')
        ontologyContents.push(content)
      } catch (error) {
        console.warn(`Error fetching ontology ${artifact}:`, error)
      }
    }
  }

  const context = buildContextFromOntologies(ontologyContents)

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
  const objectProperties: string[] = []
  const dataProperties: string[] = []

  for (const content of ontologyContents) {
    // Extract prefixes
    const prefixMatches = content.matchAll(/@prefix\s+(\S+)\s+<([^>]+)>\s*\./g)
    for (const match of prefixMatches) {
      prefixes.push(`PREFIX ${match[1]} <${match[2]}>`)
    }

    // Extract class definitions with their comments
    const classMatches = content.matchAll(
      /(\S+)\s+a\s+owl:Class\s*;[^.]*?rdfs:comment\s+"([^"]+)"/g
    )
    for (const match of classMatches) {
      classes.push(`${match[1] ?? ''} — ${match[2] ?? ''}`)
    }

    // Also capture classes without comments
    const simpleClassMatches = content.matchAll(/(\S+)\s+a\s+owl:Class\s*;/g)
    for (const match of simpleClassMatches) {
      const className = match[1] ?? ''
      if (!classes.some((c) => c.startsWith(className))) {
        classes.push(className)
      }
    }

    // Extract object properties with domain/range
    const objPropMatches = content.matchAll(
      /(\S+)\s+a\s+owl:ObjectProperty\s*;[^.]*?rdfs:domain\s+(\S+)\s*;[^.]*?rdfs:range\s+([^;.]+)/g
    )
    for (const match of objPropMatches) {
      objectProperties.push(
        `${match[1] ?? ''} (${(match[2] ?? '').trim()} → ${(match[3] ?? '').trim()})`
      )
    }

    // Extract data properties
    const dataPropMatches = content.matchAll(
      /(\S+)\s+a\s+owl:DatatypeProperty\s*;[^.]*?rdfs:domain\s+(\S+)/g
    )
    for (const match of dataPropMatches) {
      dataProperties.push(`${match[1] ?? ''} (domain: ${(match[2] ?? '').trim()})`)
    }
  }

  // If regex extraction yielded nothing, provide raw content (truncated)
  if (classes.length === 0 && objectProperties.length === 0 && ontologyContents.length > 0) {
    const rawContent = ontologyContents.join('\n\n')
    const maxLength = 8000
    return rawContent.length > maxLength
      ? rawContent.substring(0, maxLength) + '\n\n... (truncated)'
      : rawContent
  }

  return [
    '## SPARQL Prefixes',
    ...prefixes,
    '',
    '## Classes',
    ...classes.map((c) => `- ${c}`),
    '',
    '## Object Properties (relationships)',
    ...objectProperties.map((p) => `- ${p}`),
    '',
    '## Data Properties (literal values)',
    ...dataProperties.map((p) => `- ${p}`),
  ].join('\n')
}
