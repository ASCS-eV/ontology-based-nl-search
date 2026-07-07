/**
 * Prompt Builder — generates the LLM system prompt from raw SHACL ontology shapes.
 *
 * Instead of extracting vocabulary into flattened tables, this module injects
 * the raw SHACL Turtle content directly into the system prompt. The LLM reads
 * the native SHACL shapes and resolves synonyms, patterns, and constraints
 * on its own — no manual vocabulary extraction or synonym tables needed.
 *
 * The ontology IS the vocabulary. The LLM IS the synonym resolver.
 */
import type { ShaclDomainContent } from '@ontology-search/search/shacl-reader'

import { EXAMPLES, PREAMBLE, RULES, STATIC_SECTIONS } from './prompt-builder-templates.js'

/**
 * Build the complete LLM system prompt from raw SHACL domain content.
 *
 * The prompt embeds the full Turtle content of each domain's SHACL file,
 * letting the LLM read property definitions, sh:in enumerations, sh:pattern
 * constraints, and sh:description annotations natively.
 */
export function buildSystemPrompt(shaclContent: ShaclDomainContent[]): string {
  const sections: string[] = [PREAMBLE]

  // SHACL reference section
  sections.push('## Ontology Reference — SHACL Shape Definitions\n')
  sections.push('The following SHACL shapes define ALL filterable properties for each domain.')
  sections.push(
    'Read the Turtle carefully — look for `sh:in` (allowed values), `sh:pattern` (regex), `sh:datatype` (type), `sh:path` (property name), `sh:name` (label), and `sh:description` (meaning).\n'
  )

  for (const { domain, content } of shaclContent) {
    sections.push(`### ${formatDomainHeader(domain)} domain\n`)
    sections.push('```turtle')
    sections.push(content.trim())
    sections.push('```\n')
  }

  // Static sections (location, license, domains)
  sections.push(STATIC_SECTIONS)

  // Rules
  sections.push(RULES)

  // Examples
  sections.push(EXAMPLES)

  return sections.join('\n')
}

/**
 * Format a domain id (kebab-case, e.g. `environment-model`) into a
 * human-readable section header (`Environment Model`).
 *
 * Mechanical transformation only — we deliberately do NOT consult a
 * hand-maintained domain-to-label map. The previous implementation
 * embedded ~13 ontology-specific label overrides which had to be edited
 * every time the SHACL added a new domain. Deriving labels from SHACL
 * `rdfs:label` was also considered and rejected: the ontologies we ship
 * with use `"Ontology definition for X"@en` as the label, which is not a
 * display string. Mechanical kebab→Title conversion gives sensible
 * results for any well-named domain and stays ontology-agnostic.
 *
 * Exported so the retrieval-mode composer emits the same section headers
 * as full mode (one formatting rule, no drift).
 */
export function formatDomainHeader(domain: string): string {
  return domain
    .split(/[-_]/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
