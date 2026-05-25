import { existsSync, readdirSync, statSync } from 'fs'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

import { getProjectRoot } from './paths.js'

// Re-export vocabulary index (still used by domain-registry)
export type { VocabularyIndex, VocabularyProperty } from './vocabulary-index.js'
export { buildVocabularyIndex, resetVocabularyIndex } from './vocabulary-index.js'

const CACHE_DIR = path.join(getProjectRoot(), '.ontology-cache')
const CONTEXT_FILE = path.join(CACHE_DIR, 'context.txt')
const ONTOLOGY_FILES_DIR = path.join(CACHE_DIR, 'files')

/** Path to local submodule containing ontology-management-base */
const LOCAL_OMB_PATH = path.join(
  getProjectRoot(),
  'submodules',
  'hd-map-asset-example',
  'submodules',
  'sl-5-8-asset-tools',
  'submodules',
  'ontology-management-base'
)

/**
 * Ontology artifacts to load (relative to OMB root).
 * Discovered dynamically from the file system — loads ALL .owl.ttl files found
 * under the artifacts directory. No hardcoded domain paths.
 */
function discoverOntologyArtifacts(ombRoot: string): string[] {
  const artifactsDir = path.join(ombRoot, 'artifacts')
  if (!existsSync(artifactsDir)) return []

  const artifacts: string[] = []
  for (const domain of readdirSync(artifactsDir)) {
    const domainDir = path.join(artifactsDir, domain)
    if (!statSync(domainDir).isDirectory()) continue
    for (const file of readdirSync(domainDir)) {
      if (file.endsWith('.owl.ttl')) {
        artifacts.push(`artifacts/${domain}/${file}`)
      }
    }
  }
  return artifacts
}

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

  // Prefer local submodule path — discover all OWL files dynamically
  if (existsSync(LOCAL_OMB_PATH)) {
    const artifacts = discoverOntologyArtifacts(LOCAL_OMB_PATH)
    if (artifacts.length === 0) {
      console.warn(`No .owl.ttl artifacts found under: ${LOCAL_OMB_PATH}/artifacts`)
    }
    for (const artifact of artifacts) {
      const fullPath = path.join(LOCAL_OMB_PATH, artifact)
      if (existsSync(fullPath)) {
        const content = await readFile(fullPath, 'utf-8')
        ontologyContents.push(content)
      }
    }
  } else {
    // Fallback: fetch from GitHub (uses first discovered artifact)
    const { getConfig } = await import('@ontology-search/core/config')
    const config = getConfig()
    const repo = config.ONTOLOGY_REPO
    const branch = config.ONTOLOGY_BRANCH

    // Fetch the artifacts directory listing is not feasible via raw GitHub;
    // log a warning and skip — production should use local submodule path.
    console.warn(
      `Local OMB path not found: ${LOCAL_OMB_PATH}. ` +
        `Cannot discover ontology artifacts dynamically from GitHub. ` +
        `Run 'git submodule update --init --recursive' to populate.`
    )
    void repo
    void branch
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
