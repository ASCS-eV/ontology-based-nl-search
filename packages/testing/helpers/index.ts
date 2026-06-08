/**
 * Shared test context for search integration tests.
 *
 * Encapsulates the repeated `getInitializedStore() + buildDomainRegistry()`
 * warmup sequence so each integration test file doesn't re-invent the setup.
 *
 * Usage:
 * ```ts
 * import { getSearchTestContext } from '@ontology-search/testing/helpers'
 *
 * let ctx: Awaited<ReturnType<typeof getSearchTestContext>>
 * beforeAll(async () => { ctx = await getSearchTestContext() }, 60_000)
 * ```
 */
import type { SparqlStore } from '@ontology-search/sparql/types'

export interface SearchTestContext {
  store: SparqlStore
  registry: import('@ontology-search/ontology/domain-registry').DomainRegistry
}

/**
 * Initialize the SPARQL store and domain registry for integration tests.
 *
 * Loads the real ontology into an in-memory store and builds the
 * domain registry from the workspace artifacts. Callers should invoke
 * this in a `beforeAll` with a generous timeout (60s) since the first
 * call loads all ontology files from disk.
 */
export async function getSearchTestContext(): Promise<SearchTestContext> {
  const { getInitializedStore } = await import('@ontology-search/search/init' as string)
  const { buildDomainRegistry } = await import(
    '@ontology-search/ontology/domain-registry' as string
  )

  const store = (await getInitializedStore()) as SparqlStore
  const registry =
    (await buildDomainRegistry()) as import('@ontology-search/ontology/domain-registry').DomainRegistry

  return { store, registry }
}

export function createMockLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }
}
