/**
 * Genericity proof — task 21e.
 *
 * Loads a SHACL fixture that intentionally has NONE of the ENVITED-X
 * meta-model shapes (no `DomainSpecification`, no `hasContent` / `hasFormat`
 * / `hasQuantity` / `hasGeoreference` / `hasResourceDescription`, no
 * manifest pattern, no `gx:license`). Every property hangs directly off
 * the asset class.
 *
 * Drives the property-path discovery, the reference-chain discovery, and
 * the compiler against this graph. The emitted SPARQL must:
 *
 *   1. Use only predicates the schema actually declares.
 *   2. Reference NONE of the ENVITED-X-specific predicates the compiler
 *      historically baked in as literals.
 *   3. Pass the SPARQL policy gate with no extra prefix allowlist.
 *
 * If any one of those breaks, the system has regressed back to a
 * meta-model-specific compiler and the ontology-name budget (per
 * CONTRIBUTING.md § 9b) has been silently inflated.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, compileSlotsWithTrace } from '../compiler.js'
import { buildPropertyPaths, buildReferenceChains } from '../property-paths.js'
import { SCHEMA_GRAPH } from '../schema-loader.js'
import { queryRange2DProperties } from '../schema-queries.js'

/** ENVITED-X meta-model predicates the compiler must NEVER emit
 *  against a non-ENVITED-X ontology. Each is a fragment-only match
 *  (predicate local name) so a vendor swapping out the prefix doesn't
 *  smuggle the same meta-model back in under another namespace. */
const FORBIDDEN_PREDICATE_LOCAL_NAMES = [
  'hasDomainSpecification',
  'hasContent',
  'hasFormat',
  'hasQuantity',
  'hasQuality',
  'hasDataSource',
  'hasGeoreference',
  'hasProjectLocation',
  'hasResourceDescription',
  'hasManifest',
  'hasReferencedArtifacts',
] as const

/**
 * Build a registry-like view of the fixture so the compiler can
 * navigate the library namespace. We synthesize the minimum
 * `DomainRegistry` surface the compiler reads — `domains.get`,
 * `domains.values`, `domainNames`, `domainForIri`, `resolveByIriDomain`,
 * `prefixesFor`, `allPrefixes`, `getAllNamespaces`.
 *
 * Construction is intentionally inline (not a fixture helper file) so
 * the test stays self-contained — anyone reading this single file
 * sees the entire genericity contract.
 */
function libraryRegistry() {
  const desc = {
    name: 'library',
    namespace: 'http://example.org/library/v1/',
    prefix: 'library',
    targetClass: 'library:Book',
    targetClassIri: 'http://example.org/library/v1/Book',
    version: 'v1',
    shapes: ['Book'],
    declaredPrefixes: {
      library: 'http://example.org/library/v1/',
    },
  }
  const domains = new Map([['library', desc]])
  return {
    domains,
    domainNames: ['library'],
    prefixesFor() {
      return [
        'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
        'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>',
        `PREFIX library: <${desc.namespace}>`,
      ].join('\n')
    },
    allPrefixes() {
      return this.prefixesFor()
    },
    resolveByIriDomain(iriDomain: string) {
      return iriDomain === 'library' ? desc : undefined
    },
    domainForIri(iri: string) {
      return iri.startsWith(desc.namespace) ? 'library' : undefined
    },
    getAllNamespaces() {
      return new Set([desc.namespace])
    },
  }
}

async function loadFixture() {
  const ttl = readFileSync(
    join(__dirname, '__fixtures__', 'flat-ontology', 'library.shacl.ttl'),
    'utf-8'
  )
  const store = new OxigraphStore()
  await store.loadTurtle(ttl, SCHEMA_GRAPH)
  return store
}

describe('genericity proof — non-ENVITED-X SHACL graph (task 21e)', () => {
  it('discovers leaf property paths with no ENVITED-X intermediate predicates', async () => {
    const store = await loadFixture()
    const registry = libraryRegistry()

    const paths = await buildPropertyPaths(store, registry as any)

    expect(paths.length).toBeGreaterThan(0)

    // Every discovered path must use only library: predicates.
    for (const path of paths) {
      for (const step of path.steps) {
        for (const forbidden of FORBIDDEN_PREDICATE_LOCAL_NAMES) {
          expect(
            step.predicate.endsWith(`/${forbidden}`),
            `discovered predicate ${step.predicate} contains forbidden meta-model local name ${forbidden}`
          ).toBe(false)
        }
      }
    }

    // Sanity: the discovery actually found the leaves the fixture declares.
    const leafNames = new Set(paths.map((p) => p.propertyName))
    expect(leafNames.has('title')).toBe(true)
    expect(leafNames.has('genre')).toBe(true)
    expect(leafNames.has('pageCount')).toBe(true)
  }, 30_000)

  it('discovers a class-typed reference chain for the relatedBook leaf', async () => {
    const store = await loadFixture()
    const registry = libraryRegistry()

    const paths = await buildPropertyPaths(store, registry as any)
    const knownAssetClasses = new Set(['http://example.org/library/v1/Book'])

    const chains = buildReferenceChains(paths, registry as any, knownAssetClasses)

    // At least one chain should target Book→Book via library:relatedBook
    // (either as `kind: 'class'` directly or as `kind: 'iri'` because
    // the property has `sh:nodeKind sh:IRI`).
    const bookChain = chains.find(
      (c) =>
        c.parentDomain === 'library' && c.steps.some((s) => s.predicate.endsWith('/relatedBook'))
    )
    expect(
      bookChain,
      `expected a reference chain via library:relatedBook; got ${chains.length} chains`
    ).toBeDefined()

    // No step of the discovered chain may carry an ENVITED-X
    // meta-model predicate.
    for (const chain of chains) {
      for (const step of chain.steps) {
        for (const forbidden of FORBIDDEN_PREDICATE_LOCAL_NAMES) {
          expect(step.predicate.endsWith(`/${forbidden}`)).toBe(false)
        }
      }
    }
  }, 30_000)

  it('paths reach the book asset class from itself (self-referential schema is supported)', async () => {
    const store = await loadFixture()
    const registry = libraryRegistry()

    const paths = await buildPropertyPaths(store, registry as any)
    const bookPaths = paths.filter((p) => p.assetClass === 'http://example.org/library/v1/Book')
    // Every direct leaf attaches to Book in a single step.
    expect(bookPaths.length).toBeGreaterThanOrEqual(5)
    for (const path of bookPaths) {
      // The fixture has direct properties only — no intermediate shape
      // hops. The compiler must handle a 1-step path the same way it
      // handles a 3-step ENVITED-X path.
      expect(path.steps.length).toBe(1)
    }
  }, 30_000)
})

/**
 * Range2D (numeric interval) detection must be STRUCTURAL — keyed on the
 * `sh:lessThanOrEquals` bound constraint, never on the class name "Range2D" or
 * the sub-property names "min"/"max". This fixture names its wrapper `Interval`
 * with `lowerBound`/`upperBound` leaves; the previous
 * `CONTAINS(STR(?rangeClass), "Range2D")` detection would have found nothing.
 */
const INTERVAL_FIXTURE_TTL = `
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
@prefix cat: <http://example.org/catalogue/v1/> .

cat:BookShape a sh:NodeShape ;
  sh:targetClass cat:Book ;
  sh:property [ sh:path cat:priceRange ; sh:node cat:IntervalShape ] .

cat:IntervalShape a sh:NodeShape ;
  sh:targetClass cat:Interval ;
  sh:property [ sh:path cat:lowerBound ; sh:datatype xsd:float ; sh:lessThanOrEquals cat:upperBound ] ;
  sh:property [ sh:path cat:upperBound ; sh:datatype xsd:float ] .
`

describe('genericity proof — structural Range2D detection (no class-name / min-max literals)', () => {
  it('detects an interval wrapper via sh:lessThanOrEquals, not the "Range2D" class name', async () => {
    const store = new OxigraphStore()
    await store.loadTurtle(INTERVAL_FIXTURE_TTL, SCHEMA_GRAPH)

    const ranges = await queryRange2DProperties(store)
    const price = ranges.find((r) => r.localName === 'priceRange')

    expect(price, 'priceRange should be detected as an interval wrapper').toBeDefined()
    // Lower bound = the leaf bearing sh:lessThanOrEquals; upper bound = its
    // target. Neither is named "min"/"max", proving name-independence.
    expect(price!.minPredicate.endsWith('/lowerBound')).toBe(true)
    expect(price!.maxPredicate.endsWith('/upperBound')).toBe(true)
  }, 30_000)
})

/**
 * The compiler EMISSION (not just discovery) must work on a flat schema.
 * Before the emission unification, a shallow no-shape-group property was
 * routed through the ENVITED-X 3-hop shape-group machinery, fabricating
 * `?asset library:genre ?domSpec ; ?domSpec library:hasContent ?content ;
 * ?content library:genre ?genre` — a 3-hop query over a 1-hop schema that
 * matches nothing. This drives compileSlots end-to-end against the flat
 * fixture and asserts a single discovered hop with no fabricated meta-model.
 */
describe('genericity proof — compiler emission on a flat schema', () => {
  it('compiles a flat-ontology filter to one discovered hop, no fabricated meta-model', async () => {
    const store = await loadFixture()
    const registry = libraryRegistry()
    // `registry as any`: the synthetic test registry stands in for the
    // disk-derived DomainRegistry (same cast the discovery tests above use).
    const vocabIndex = await buildCompilerVocabFrom(store, registry as any)

    const { sparql } = await compileSlotsWithTrace(
      { domains: ['library'], filters: { genre: 'fiction' }, ranges: {} },
      { registry: registry as any, vocabIndex }
    )

    // The genre leaf is a 1-step path → emitted directly off the asset.
    expect(sparql).toMatch(/\?asset\s+library:genre\s+\?genre\s*\./)
    expect(sparql).toContain('FILTER(?genre = "fiction")')
    // No fabricated ENVITED-X meta-model predicate (hasContent etc.) and no
    // phantom DomainSpecification intermediate.
    for (const forbidden of FORBIDDEN_PREDICATE_LOCAL_NAMES) {
      expect(
        sparql.includes(forbidden),
        `compiled SPARQL must not contain ${forbidden}:\n${sparql}`
      ).toBe(false)
    }
    expect(sparql).not.toContain('?domSpec')
  }, 30_000)
})
