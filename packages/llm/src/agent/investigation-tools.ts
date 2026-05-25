/**
 * Ontology Investigation Tools — let the LLM discover schema structure at runtime.
 *
 * These tools query the SHACL schema graph in Oxigraph to provide the LLM with
 * on-demand access to ontology structure. This eliminates the need for hardcoded
 * domain knowledge in the prompt — the LLM can discover domains, properties,
 * allowed values, and cross-domain connections dynamically.
 *
 * All queries target the schema named graph (`urn:graph:schema`) and are read-only.
 * No ontology-specific identifiers are embedded in this module.
 *
 * @see packages/search/src/schema-loader.ts — SCHEMA_GRAPH constant
 * @see packages/search/src/schema-queries.ts — Similar patterns for compiler use
 */
import { SCHEMA_GRAPH } from '@ontology-search/search'
import { escapeSparqlLiteral } from '@ontology-search/sparql/escape'
import type { SparqlStore } from '@ontology-search/sparql/types'
import { tool } from 'ai'
import { z } from 'zod'

// ─── Parameter Schemas ───────────────────────────────────────────────────────

const emptyParams = z.object({})

const domainParam = z.object({
  domain: z.string().describe('Domain name to inspect (from discover_domains results)'),
})

const valuesParams = z.object({
  propertyName: z.string().describe('Property local name (from discover_properties results)'),
  domain: z.string().describe('Domain to narrow the search (use empty string for all domains)'),
})

const connectionsParams = z.object({
  domain: z
    .string()
    .describe('Filter connections for a specific domain (use empty string for all)'),
})

const schemaQueryParams = z.object({
  sparql: z
    .string()
    .describe(
      'A SPARQL SELECT query. Use standard prefixes (sh:, rdfs:, rdf:, owl:, xsd:). ' +
        'The query runs against the schema graph containing SHACL shapes and OWL definitions.'
    ),
})

// ─── Result types ────────────────────────────────────────────────────────────

interface DomainsResult {
  domains: Array<{ domain: string; classIri: string }>
  count: number
  error?: string
}

interface PropertiesResult {
  domain: string
  properties: Array<{
    localName: string
    path: string
    datatype: string
    name: string
    description: string
    hasEnumeratedValues: boolean
  }>
  count: number
  error?: string
}

interface ValuesResult {
  propertyName: string
  domain: string
  values: string[]
  count: number
  error?: string
}

interface ConnectionsResult {
  connections: Array<{ from: string; to: string; fromClass: string; toClass: string }>
  count: number
  error?: string
}

interface SchemaQueryResult {
  variables?: string[]
  results: Record<string, string>[]
  count?: number
  error?: string
}

/**
 * Create investigation tools bound to a specific Oxigraph store instance.
 *
 * The returned tools allow the LLM to explore the ontology schema dynamically
 * before filling slots. Each tool executes a targeted SPARQL query and returns
 * structured results the LLM can reason over.
 */
export function createInvestigationTools(store: SparqlStore) {
  return {
    discover_domains: tool<z.infer<typeof emptyParams>, DomainsResult>({
      description:
        'List all available asset domains (types of searchable resources). ' +
        'Returns domain names and their RDF class IRIs. Use this to understand what can be searched.',
      inputSchema: emptyParams,
      execute: async () => {
        const query = `
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          PREFIX sh: <http://www.w3.org/ns/shacl#>
          SELECT DISTINCT ?domain ?classIri WHERE {
            GRAPH <${SCHEMA_GRAPH}> {
              ?shape a sh:NodeShape ;
                     sh:targetClass ?classIri .
              ?classIri rdfs:subClassOf ?superClass .
            }
            BIND(REPLACE(STR(?classIri), "^.*/([^/]+)/v[0-9]+/.*$", "$1") AS ?domain)
            FILTER(?domain != STR(?classIri))
          }
          ORDER BY ?domain
        `
        try {
          const results = await store.query(query)
          const domains = results.results.bindings.map((b) => ({
            domain: b['domain']?.value ?? '',
            classIri: b['classIri']?.value ?? '',
          }))
          return { domains, count: domains.length }
        } catch (err) {
          return {
            domains: [],
            count: 0,
            error: `Query failed: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
      },
    }),

    discover_properties: tool<z.infer<typeof domainParam>, PropertiesResult>({
      description:
        'List all filterable properties for a specific domain. ' +
        'Returns property local names, data types, and whether they have enumerated values (sh:in). ' +
        'Use this to understand what filters are available for a domain.',
      inputSchema: domainParam,
      execute: async ({ domain }) => {
        const query = `
          PREFIX sh: <http://www.w3.org/ns/shacl#>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
          SELECT ?localName ?path ?datatype ?name ?description ?hasEnum WHERE {
            GRAPH <${SCHEMA_GRAPH}> {
              ?shape a sh:NodeShape ;
                     sh:targetClass ?cls .
              ?shape (sh:property/sh:node?)*/sh:property ?propShape .
              ?propShape sh:path ?path .
              OPTIONAL { ?propShape sh:datatype ?datatype }
              OPTIONAL { ?propShape sh:name ?name }
              OPTIONAL { ?propShape sh:description ?description }
              BIND(EXISTS { ?propShape sh:in ?list } AS ?hasEnum)
            }
            FILTER(CONTAINS(LCASE(STR(?cls)), "${escapeSparqlLiteral(domain.toLowerCase())}"))
            BIND(REPLACE(STR(?path), "^.*/", "") AS ?localName)
          }
          ORDER BY ?localName
        `
        try {
          const results = await store.query(query)
          const properties = results.results.bindings.map((b) => ({
            localName: b['localName']?.value ?? '',
            path: b['path']?.value ?? '',
            datatype: b['datatype']?.value?.replace(/.*#/, '') ?? 'unknown',
            name: b['name']?.value ?? '',
            description: b['description']?.value ?? '',
            hasEnumeratedValues: b['hasEnum']?.value === 'true',
          }))
          return { domain, properties, count: properties.length }
        } catch (err) {
          return {
            domain,
            properties: [],
            count: 0,
            error: `Query failed: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
      },
    }),

    discover_values: tool<z.infer<typeof valuesParams>, ValuesResult>({
      description:
        'Get the allowed values (sh:in enumeration) for a specific property. ' +
        'Returns the exact values that can be used as filter values. ' +
        'Only works for properties that have sh:in constraints.',
      inputSchema: valuesParams,
      execute: async ({ propertyName, domain }) => {
        const domainFilter = domain
          ? `FILTER(CONTAINS(LCASE(STR(?cls)), "${escapeSparqlLiteral(domain.toLowerCase())}"))`
          : ''
        const query = `
          PREFIX sh: <http://www.w3.org/ns/shacl#>
          PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
          SELECT ?value WHERE {
            GRAPH <${SCHEMA_GRAPH}> {
              ?shape a sh:NodeShape ;
                     sh:targetClass ?cls .
              ?shape (sh:property/sh:node?)*/sh:property ?propShape .
              ?propShape sh:path ?path .
              ?propShape sh:in ?list .
              ?list rdf:rest*/rdf:first ?value .
            }
            ${domainFilter}
            FILTER(STRENDS(STR(?path), "/${escapeSparqlLiteral(propertyName)}") || STRENDS(STR(?path), "#${escapeSparqlLiteral(propertyName)}"))
          }
          ORDER BY ?value
        `
        try {
          const results = await store.query(query)
          const values = results.results.bindings.map((b) => b['value']?.value ?? '')
          return { propertyName, domain: domain || 'all', values, count: values.length }
        } catch (err) {
          return {
            propertyName,
            domain: domain || 'all',
            values: [],
            count: 0,
            error: `Query failed: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
      },
    }),

    discover_connections: tool<z.infer<typeof connectionsParams>, ConnectionsResult>({
      description:
        'Find cross-domain reference relationships. ' +
        'Shows which domains can reference (link to) other domains via manifest artifacts. ' +
        'Use this to understand how different asset types relate to each other.',
      inputSchema: connectionsParams,
      execute: async ({ domain }) => {
        const domainFilter = domain
          ? `FILTER(CONTAINS(LCASE(STR(?parentClass)), "${escapeSparqlLiteral(domain.toLowerCase())}") || CONTAINS(LCASE(STR(?childClass)), "${escapeSparqlLiteral(domain.toLowerCase())}"))`
          : ''
        const query = `
          PREFIX sh: <http://www.w3.org/ns/shacl#>
          PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
          SELECT DISTINCT ?parentDomain ?childDomain ?parentClass ?childClass WHERE {
            GRAPH <${SCHEMA_GRAPH}> {
              ?parentShape a sh:NodeShape ;
                           sh:targetClass ?parentClass .
              ?parentShape (sh:property/sh:node?)*/sh:property ?refProp .
              ?refProp sh:node ?refNode .
              ?refNode sh:property ?innerProp .
              ?innerProp sh:class ?childClass .
              ?childClass rdfs:subClassOf ?super .
            }
            ${domainFilter}
            BIND(REPLACE(STR(?parentClass), "^.*/([^/]+)/v[0-9]+/.*$", "$1") AS ?parentDomain)
            BIND(REPLACE(STR(?childClass), "^.*/([^/]+)/v[0-9]+/.*$", "$1") AS ?childDomain)
            FILTER(?parentDomain != ?childDomain)
          }
          ORDER BY ?parentDomain ?childDomain
        `
        try {
          const results = await store.query(query)
          const connections = results.results.bindings.map((b) => ({
            from: b['parentDomain']?.value ?? '',
            to: b['childDomain']?.value ?? '',
            fromClass: b['parentClass']?.value ?? '',
            toClass: b['childClass']?.value ?? '',
          }))
          return { connections, count: connections.length }
        } catch (err) {
          return {
            connections: [],
            count: 0,
            error: `Query failed: ${err instanceof Error ? err.message : String(err)}`,
          }
        }
      },
    }),

    investigate_schema: tool<z.infer<typeof schemaQueryParams>, SchemaQueryResult>({
      description:
        'Run a custom read-only SPARQL SELECT query against the schema graph. ' +
        'The query automatically targets the schema named graph. ' +
        'Use this for ad-hoc exploration when other discovery tools are insufficient. ' +
        'Only SELECT queries are allowed — no INSERT/DELETE/UPDATE.',
      inputSchema: schemaQueryParams,
      execute: async ({ sparql }) => {
        // Security: only allow SELECT queries on schema graph
        const normalized = sparql.trim().toUpperCase()
        if (!normalized.startsWith('SELECT') && !normalized.startsWith('PREFIX')) {
          return { error: 'Only SELECT queries are allowed', results: [] }
        }
        if (/\b(INSERT|DELETE|DROP|CLEAR|CREATE|LOAD)\b/i.test(sparql)) {
          return { error: 'Write operations are not allowed', results: [] }
        }
        // Reject GRAPH clauses targeting non-schema graphs and FROM/FROM NAMED
        // clauses that could redirect the query to instance data.
        // Match as SPARQL keywords (followed by whitespace), not within IRIs.
        if (/\bGRAPH\s/i.test(sparql)) {
          return {
            error: 'GRAPH clauses are not allowed — queries are scoped to the schema graph',
            results: [],
          }
        }
        if (/\bFROM\s/i.test(sparql)) {
          return {
            error:
              'FROM/FROM NAMED clauses are not allowed — queries are scoped to the schema graph',
            results: [],
          }
        }

        // Always scope the query to the schema graph
        const wrappedQuery = sparql.replace(/\bWHERE\b/i, `FROM <${SCHEMA_GRAPH}> WHERE`)

        try {
          const results = await store.query(wrappedQuery)
          const bindings = results.results.bindings.slice(0, 50).map((b) => {
            const row: Record<string, string> = {}
            for (const [key, val] of Object.entries(b)) {
              row[key] = val.value
            }
            return row
          })
          return { variables: results.head.vars, results: bindings, count: bindings.length }
        } catch (err) {
          return {
            error: `Query failed: ${err instanceof Error ? err.message : String(err)}`,
            results: [],
          }
        }
      },
    }),
  }
}

export type InvestigationTools = ReturnType<typeof createInvestigationTools>
