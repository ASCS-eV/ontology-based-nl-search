/**
 * Generic `*.context.jsonld` reader — parses the per-ontology JSON-LD
 * contexts into a flat term → IRI (+ datatype) lexicon.
 *
 * The `@context` files are a curated, token-cheap alias dictionary
 * (`speedLimit → hdmap:speedLimit`, `codeEPSG → georeference:codeEPSG @
 * xsd:integer`) that the schema/vocabulary path never tapped before. The
 * term index (schema-index) layers these human-facing names on top of the
 * schema-graph harvest.
 *
 * Deliberately generic: no assumption about which prefixes exist, whether a
 * `@vocab` is declared, or how deeply term definitions nest. And
 * deliberately **enrichment, not source of truth** — the artifacts are
 * marked transitional (LinkML migration upstream), so a missing or
 * malformed context degrades to an empty lexicon with a warning, never a
 * throw.
 *
 * Implements the subset of JSON-LD 1.1 context processing the artifacts
 * use: term definitions ([JSON-LD11] §9.15.1), compact IRI expansion
 * ([JSON-LD11] §3.7), `@vocab`-relative IRIs ([JSON-LD11] §4.1.2), type
 * coercion ([JSON-LD11] §4.2.1), and scoped (nested) contexts
 * ([JSON-LD11] §4.8).
 *
 * @see https://www.w3.org/TR/json-ld11/#the-context — [JSON-LD11]
 */
import { readFileSync } from 'node:fs'

import { createComponentLogger } from '@ontology-search/core/logging'
import { discoverContextFiles } from '@ontology-search/ontology/sources'

const logger = createComponentLogger('context-reader')

/** One term mapping harvested from a domain's JSON-LD context. */
export interface ContextTerm {
  /** Human-facing key, e.g. "speedLimit" */
  term: string
  /** Expanded absolute IRI the term maps to */
  iri: string
  /**
   * Type coercion, when declared: the literal `'@id'` for object
   * references, otherwise the expanded datatype IRI (e.g.
   * `http://www.w3.org/2001/XMLSchema#integer`).
   */
  datatype?: string
  /** Domain (artifact directory) the context file belongs to */
  domain: string
  /**
   * Best-effort classification. A JSON-LD context cannot reliably say
   * whether a term names a class or a property, so this is only set when
   * the definition proves it: a `@type` coercion marks a property. The
   * term index (03) classifies the rest against the schema graph.
   */
  kind?: 'property' | 'class'
}

/** Prefix + vocab environment a (possibly nested) context is parsed under. */
interface ContextEnv {
  prefixes: Map<string, string>
  vocab?: string
}

/** Cached singleton — context files are static per loaded ontology set. */
let cachedTerms: ContextTerm[] | null = null

/**
 * Read and parse every discovered `*.context.jsonld` into a flat term list.
 * Cached; per-file failures are logged and skipped (fail-soft).
 */
export function readContextTerms(): ContextTerm[] {
  if (cachedTerms) return cachedTerms

  const terms: ContextTerm[] = []
  for (const file of discoverContextFiles()) {
    try {
      const doc: unknown = JSON.parse(readFileSync(file.path, 'utf-8'))
      terms.push(...parseContextTerms(doc, file.domain))
    } catch (error) {
      logger.warn('Skipping unreadable context file', {
        path: file.path,
        domain: file.domain,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  cachedTerms = terms
  return cachedTerms
}

/** Terms of a single domain (artifact directory name). */
export function readContextTermsForDomain(domain: string): ContextTerm[] {
  return readContextTerms().filter((t) => t.domain === domain)
}

/** Reset the cached term list (for testing). */
export function resetContextTerms(): void {
  cachedTerms = null
}

/**
 * Parse one JSON-LD document's `@context` into terms. Pure — exported for
 * direct unit testing of the fail-soft contract. A document without a
 * usable `@context` yields an empty list.
 */
export function parseContextTerms(doc: unknown, domain: string): ContextTerm[] {
  if (!isRecord(doc)) return []
  const context = doc['@context']
  // [JSON-LD11] §9.15: a context may be a single definition or an array of
  // definitions applied in order.
  const definitions = Array.isArray(context) ? context.filter(isRecord) : [context]

  const terms: ContextTerm[] = []
  const seen = new Set<string>()
  const env: ContextEnv = { prefixes: new Map() }
  for (const definition of definitions) {
    if (!isRecord(definition)) continue
    collectEnv(definition, env)
    parseDefinition(definition, domain, env, terms, seen)
  }
  return terms
}

/**
 * First pass: gather prefix declarations (string mappings to absolute
 * namespace IRIs — [JSON-LD11] §3.7) and `@vocab` ([JSON-LD11] §4.1.2)
 * into the environment, so term expansion in the second pass is
 * order-independent.
 */
function collectEnv(definition: Record<string, unknown>, env: ContextEnv): void {
  for (const [key, value] of Object.entries(definition)) {
    if (key === '@vocab' && typeof value === 'string' && isAbsoluteIri(value)) {
      env.vocab = value
    } else if (!key.startsWith('@') && typeof value === 'string' && isAbsoluteIri(value)) {
      env.prefixes.set(key, value)
    }
  }
}

/** Second pass: turn term definitions into `ContextTerm`s, recursing into scoped contexts. */
function parseDefinition(
  definition: Record<string, unknown>,
  domain: string,
  env: ContextEnv,
  terms: ContextTerm[],
  seen: Set<string>
): void {
  for (const [key, value] of Object.entries(definition)) {
    if (key.startsWith('@')) continue

    if (typeof value === 'string') {
      // Namespace declarations (values ending in a gen-delim) are prefixes,
      // not searchable terms; keyword aliases (`"meaning": "@id"`) map to
      // JSON-LD keywords, not IRIs — expandIri drops both.
      if (isAbsoluteIri(value) && (value.endsWith('#') || value.endsWith('/'))) continue
      const iri = expandIri(value, env)
      if (iri) pushTerm(terms, seen, { term: key, iri, domain })
      continue
    }

    if (!isRecord(value)) continue

    // Expanded term definition ([JSON-LD11] §9.15.1): `@id` may be absent
    // (term resolves against @vocab), compact, or absolute.
    const idRaw = typeof value['@id'] === 'string' ? value['@id'] : key
    const iri = expandIri(idRaw, env)
    const typeRaw = typeof value['@type'] === 'string' ? value['@type'] : undefined
    const datatype =
      typeRaw === '@id' ? '@id' : typeRaw ? (expandIri(typeRaw, env) ?? typeRaw) : undefined

    if (iri) {
      pushTerm(terms, seen, {
        term: key,
        iri,
        domain,
        ...(datatype ? { datatype, kind: 'property' as const } : {}),
      })
    }

    // Scoped context ([JSON-LD11] §4.8): nested terms live in an extended
    // environment (nested definitions may add prefixes or override @vocab).
    const nested = value['@context']
    if (isRecord(nested)) {
      const nestedEnv: ContextEnv = { prefixes: new Map(env.prefixes), vocab: env.vocab }
      collectEnv(nested, nestedEnv)
      parseDefinition(nested, domain, nestedEnv, terms, seen)
    }
  }
}

function pushTerm(terms: ContextTerm[], seen: Set<string>, term: ContextTerm): void {
  const key = `${term.domain}|${term.term}|${term.iri}|${term.datatype ?? ''}`
  if (seen.has(key)) return
  seen.add(key)
  terms.push(term)
}

/**
 * Expand a term-definition value to an absolute IRI, or return undefined
 * when it cannot name one (JSON-LD keywords, unknown prefixes, bare terms
 * without a `@vocab`).
 */
function expandIri(value: string, env: ContextEnv): string | undefined {
  if (value.startsWith('@')) return undefined
  if (isAbsoluteIri(value)) return value

  const colon = value.indexOf(':')
  if (colon > 0) {
    // Compact IRI ([JSON-LD11] §3.7): prefix:suffix with a declared prefix.
    const prefix = value.slice(0, colon)
    const suffix = value.slice(colon + 1)
    if (!suffix.startsWith('//')) {
      const base = env.prefixes.get(prefix)
      if (base) return base + suffix
    }
    return undefined
  }

  // Bare term: vocab-relative when a @vocab is declared ([JSON-LD11] §4.1.2).
  return env.vocab ? env.vocab + value : undefined
}

/** Absolute IRI: has a scheme (`xsd:` alone is compact, `urn:`/`http://` are absolute). */
function isAbsoluteIri(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || value.startsWith('urn:')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
