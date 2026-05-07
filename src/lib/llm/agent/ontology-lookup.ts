import { getOntologyContext } from '@/lib/ontology'

export interface OntologyTermMatch {
  term: string
  found: boolean
  matches: Array<{
    property: string
    description: string
    type: 'class' | 'objectProperty' | 'dataProperty'
  }>
  suggestions: string[]
}

/** Cached structured ontology data */
let ontologyIndex: OntologyIndex | null = null

interface OntologyIndex {
  classes: Array<{ name: string; comment: string }>
  objectProperties: Array<{ name: string; domain: string; range: string }>
  dataProperties: Array<{ name: string; domain: string }>
  allTerms: string[]
}

/**
 * Build a searchable index from the ontology context.
 */
async function getOntologyIndex(): Promise<OntologyIndex> {
  if (ontologyIndex) return ontologyIndex

  const context = await getOntologyContext()
  const classes: OntologyIndex['classes'] = []
  const objectProperties: OntologyIndex['objectProperties'] = []
  const dataProperties: OntologyIndex['dataProperties'] = []

  // Parse the structured context
  const lines = context.split('\n')
  let section = ''

  for (const line of lines) {
    if (line.startsWith('## Classes')) {
      section = 'classes'
    } else if (line.startsWith('## Object Properties')) {
      section = 'objectProperties'
    } else if (line.startsWith('## Data Properties')) {
      section = 'dataProperties'
    } else if (line.startsWith('## ')) {
      section = ''
    } else if (line.startsWith('- ') && section) {
      const content = line.slice(2)
      if (section === 'classes') {
        const [name, ...rest] = content.split(' — ')
        classes.push({ name: name?.trim() ?? '', comment: rest.join(' — ').trim() })
      } else if (section === 'objectProperties') {
        const match = content.match(/^(\S+)\s+\((\S+)\s*→\s*(.+)\)$/)
        if (match?.[1] && match[2] && match[3]) {
          objectProperties.push({
            name: match[1],
            domain: match[2],
            range: match[3].trim(),
          })
        }
      } else if (section === 'dataProperties') {
        const match = content.match(/^(\S+)\s+\(domain:\s*(.+)\)$/)
        if (match?.[1] && match[2]) {
          dataProperties.push({ name: match[1], domain: match[2].trim() })
        }
      }
    }
  }

  const allTerms = [
    ...classes.map((c) => c.name),
    ...objectProperties.map((p) => p.name),
    ...dataProperties.map((p) => p.name),
  ]

  ontologyIndex = { classes, objectProperties, dataProperties, allTerms }
  return ontologyIndex
}

/**
 * Look up terms in the ontology. For each input term, returns whether
 * it was found and what it matched, or suggestions for nearest matches.
 */
export async function lookupOntologyTerms(terms: string[]): Promise<OntologyTermMatch[]> {
  const index = await getOntologyIndex()
  const results: OntologyTermMatch[] = []

  for (const term of terms) {
    const normalizedTerm = term.toLowerCase()
    const matches: OntologyTermMatch['matches'] = []

    // Search classes
    for (const cls of index.classes) {
      if (
        cls.name.toLowerCase().includes(normalizedTerm) ||
        cls.comment.toLowerCase().includes(normalizedTerm)
      ) {
        matches.push({
          property: cls.name,
          description: cls.comment || `Class: ${cls.name}`,
          type: 'class',
        })
      }
    }

    // Search object properties
    for (const prop of index.objectProperties) {
      if (prop.name.toLowerCase().includes(normalizedTerm)) {
        matches.push({
          property: prop.name,
          description: `${prop.domain} → ${prop.range}`,
          type: 'objectProperty',
        })
      }
    }

    // Search data properties
    for (const prop of index.dataProperties) {
      if (prop.name.toLowerCase().includes(normalizedTerm)) {
        matches.push({
          property: prop.name,
          description: `Domain: ${prop.domain}`,
          type: 'dataProperty',
        })
      }
    }

    // If no matches, find suggestions via fuzzy matching
    const suggestions: string[] = []
    if (matches.length === 0) {
      for (const t of index.allTerms) {
        const tLower = t.toLowerCase()
        // Simple similarity: shared substrings of 3+ chars
        if (
          normalizedTerm.length >= 3 &&
          (tLower.includes(normalizedTerm.slice(0, 3)) ||
            normalizedTerm.includes(
              tLower.slice(tLower.lastIndexOf(':') + 1, tLower.lastIndexOf(':') + 4)
            ))
        ) {
          suggestions.push(t)
        }
      }
      // If still nothing, provide some general data properties as suggestions
      if (suggestions.length === 0 && index.dataProperties.length > 0) {
        suggestions.push(...index.dataProperties.slice(0, 3).map((p) => p.name))
      }
    }

    results.push({
      term,
      found: matches.length > 0,
      matches,
      suggestions: suggestions.slice(0, 5),
    })
  }

  return results
}
