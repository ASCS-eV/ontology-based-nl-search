/**
 * Auto-SKOS Generator — produces SKOS concept files from SHACL sh:in enumerations.
 *
 * Scientific basis: W3C SKOS (Simple Knowledge Organization System) provides
 * a standard model for expressing knowledge organization. This script extracts
 * enumerated values from SHACL shapes and generates SKOS concepts that enable
 * the natural language concept matcher to work with any ontology domain.
 *
 * Implementation: Uses Oxigraph (same as vocabulary-index) to load SHACL TTL
 * and SPARQL to extract sh:in lists. This is reliable for complex Turtle syntax
 * unlike regex approaches.
 *
 * Design: Produces one SKOS file per domain. Manual annotations (synonyms,
 * definitions) are stored in separate overlay files that are NOT overwritten.
 *
 * @see https://www.w3.org/TR/skos-reference/
 * @see https://www.w3.org/TR/shacl/#InConstraintComponent
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { basename, join } from 'path'

interface ExtractedValue {
  propertyIri: string
  propertyLocalName: string
  propertyLabel: string
  value: string
  domain: string
  namespace: string
}

/** Output directory for generated SKOS files */
const OUTPUT_DIR = join(process.cwd(), 'src', 'lib', 'ontology', 'generated')

/**
 * Get artifact roots from ontology-sources.json configuration.
 */
function getArtifactRoots(): string[] {
  const configPath = join(process.cwd(), 'ontology-sources.json')

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const sources = config.sources || []
      return sources.map((s: { path: string }) => join(process.cwd(), s.path))
    } catch {
      // Fall through
    }
  }

  return [
    join(
      process.cwd(),
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
 * Extract namespace from TTL content using @prefix declaration.
 */
function extractNamespace(content: string, domain: string): string | null {
  const regex = new RegExp(`@prefix\\s+${domain}:\\s*<([^>]+)>`, 'i')
  const match = content.match(regex)
  return match?.[1] ?? null
}

/**
 * Extract local name from IRI (after last / or #).
 */
function extractLocalName(iri: string): string {
  const hashIdx = iri.lastIndexOf('#')
  const slashIdx = iri.lastIndexOf('/')
  const idx = Math.max(hashIdx, slashIdx)
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

/**
 * Extract domain name from property IRI.
 */
function extractDomainFromIri(iri: string): string {
  const parts = iri.split('/')
  const versionIdx = parts.findIndex((p) => /^v\d+$/.test(p))
  if (versionIdx > 0) return parts[versionIdx - 1] ?? 'unknown'
  return 'unknown'
}

/**
 * Use Oxigraph SPARQL to extract all sh:in values from a SHACL file.
 * This is the proven approach used by vocabulary-index.ts.
 */
async function extractWithSparql(
  ttlContent: string,
  domain: string,
  namespace: string
): Promise<ExtractedValue[]> {
  const oxigraph = await import('oxigraph')
  const store = new oxigraph.Store()

  try {
    store.load(ttlContent, { format: 'text/turtle' })
  } catch (err) {
    console.warn(`  ⚠️  Failed to load ${domain}: ${err}`)
    return []
  }

  const sparql = `
    PREFIX sh: <http://www.w3.org/ns/shacl#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

    SELECT ?path ?name ?value WHERE {
      ?shape sh:property ?propShape .
      ?propShape sh:path ?path .
      OPTIONAL { ?propShape sh:name ?name }
      ?propShape sh:in ?list .
      ?list rdf:rest*/rdf:first ?value .
    }
    ORDER BY ?path ?value
  `

  const results = store.query(sparql) as Map<string, { value: string }>[]
  const extracted: ExtractedValue[] = []

  for (const row of results) {
    const pathTerm = row.get('path')
    const nameTerm = row.get('name')
    const valueTerm = row.get('value')

    if (!pathTerm || !valueTerm) continue

    const iri = pathTerm.value
    const propDomain = extractDomainFromIri(iri)

    // Only include properties from this domain or shared georeference
    if (propDomain !== domain && propDomain !== 'georeference') continue

    extracted.push({
      propertyIri: iri,
      propertyLocalName: extractLocalName(iri),
      propertyLabel: nameTerm?.value || extractLocalName(iri),
      value: valueTerm.value,
      domain,
      namespace,
    })
  }

  return extracted
}

/**
 * Generate a SKOS concept ID from a value string.
 */
function toConceptId(domain: string, property: string, value: string): string {
  const clean = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `${domain}-${property}-${clean}`
}

/**
 * Generate the SKOS TTL content for a domain.
 */
function generateSkosTtl(domain: string, namespace: string, values: ExtractedValue[]): string {
  const lines: string[] = []

  // Collect all unique prefixes needed
  const prefixes = new Map<string, string>()
  prefixes.set('skos', 'http://www.w3.org/2004/02/skos/core#')
  prefixes.set('rdfs', 'http://www.w3.org/2000/01/rdf-schema#')
  prefixes.set('nlsearch', 'https://w3id.org/ascs-ev/ontology-based-nl-search/concepts/')
  prefixes.set(domain, namespace)

  // Add georeference if any values reference it
  const hasGeoref = values.some((v) => v.propertyIri.includes('georeference'))
  if (hasGeoref) {
    prefixes.set('georeference', 'https://w3id.org/ascs-ev/envited-x/georeference/v5/')
  }

  for (const [prefix, iri] of prefixes) {
    lines.push(`@prefix ${prefix}: <${iri}> .`)
  }

  lines.push('')
  lines.push(`# ============================================================`)
  lines.push(`# Auto-generated SKOS concepts for domain: ${domain}`)
  lines.push(`# Generated from SHACL sh:in enumerations via Oxigraph SPARQL.`)
  lines.push(`# DO NOT EDIT — regenerate with: npm run ontology:generate-skos`)
  lines.push(`# Manual synonyms go in skos-annotations.ttl (overlay)`)
  lines.push(`# ============================================================`)
  lines.push('')
  lines.push(`nlsearch:${domain}Scheme a skos:ConceptScheme ;`)
  lines.push(`    rdfs:label "${domain} NL Search Vocabulary"@en ;`)
  lines.push(`    rdfs:comment "Auto-generated SKOS concepts for ${domain} ontology domain."@en .`)
  lines.push('')

  // Group by property for readability
  const byProperty = new Map<string, ExtractedValue[]>()
  for (const v of values) {
    const key = v.propertyIri
    if (!byProperty.has(key)) byProperty.set(key, [])
    byProperty.get(key)!.push(v)
  }

  for (const [, propValues] of byProperty) {
    const first = propValues[0]
    if (!first) continue

    const propDomain = extractDomainFromIri(first.propertyIri)
    const prefixedProp = `${propDomain}:${first.propertyLocalName}`

    lines.push(`# --- ${first.propertyLabel} (${prefixedProp}) ---`)
    lines.push('')

    for (const v of propValues) {
      const conceptId = toConceptId(domain, v.propertyLocalName, v.value)
      lines.push(`nlsearch:${conceptId} a skos:Concept ;`)
      lines.push(`    skos:inScheme nlsearch:${domain}Scheme ;`)
      lines.push(`    skos:prefLabel "${v.value}"@en ;`)
      lines.push(`    nlsearch:ontologyProperty ${prefixedProp} ;`)
      lines.push(`    nlsearch:ontologyValue "${v.value}" .`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Main: scan all SHACL files and generate SKOS per domain.
 */
export async function generateAllSkos(): Promise<
  { domain: string; path: string; conceptCount: number }[]
> {
  const roots = getArtifactRoots()
  const results: { domain: string; path: string; conceptCount: number }[] = []

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  for (const root of roots) {
    if (!existsSync(root)) continue

    for (const entry of readdirSync(root)) {
      const domainDir = join(root, entry)
      if (!statSync(domainDir).isDirectory()) continue

      const files = readdirSync(domainDir)
      const shaclFile = files.find((f) => f.endsWith('.shacl.ttl'))
      if (!shaclFile) continue

      const content = readFileSync(join(domainDir, shaclFile), 'utf-8')
      const namespace = extractNamespace(content, entry)
      if (!namespace) continue

      const values = await extractWithSparql(content, entry, namespace)
      if (values.length === 0) continue

      const ttl = generateSkosTtl(entry, namespace, values)
      const outputPath = join(OUTPUT_DIR, `skos-${entry}.ttl`)
      writeFileSync(outputPath, ttl, 'utf-8')

      results.push({ domain: entry, path: outputPath, conceptCount: values.length })
    }
  }

  return results
}

// CLI entry point
if (require.main === module) {
  ;(async () => {
    console.log('🔄 Generating SKOS concept files from SHACL...\n')
    const results = await generateAllSkos()

    if (results.length === 0) {
      console.log('⚠️  No domains with sh:in values found.')
    } else {
      let totalConcepts = 0
      for (const r of results) {
        console.log(`  ✅ ${r.domain}: ${r.conceptCount} concepts → ${basename(r.path)}`)
        totalConcepts += r.conceptCount
      }
      console.log(
        `\n✅ Generated ${results.length} SKOS files with ${totalConcepts} total concepts.`
      )
    }
  })()
}
