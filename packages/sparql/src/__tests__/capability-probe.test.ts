/**
 * Capability probe — regression coverage.
 *
 * Verifies that `probePropertyPathSupport` accepts a SPARQL 1.1
 * compliant store (Oxigraph) and rejects a fake store that mimics a
 * pre-1.1 engine (no property-path support).
 */
import { StoreCapabilityError } from '@ontology-search/core/errors'
import { describe, expect, it } from 'vitest'

import { probePropertyPathSupport } from '../capability-probe.js'
import { OxigraphStore } from '../oxigraph-store.js'
import type { SparqlResults, SparqlStore } from '../types.js'

/**
 * Build a complete {@link SparqlStore} from the handful of methods a probe
 * test actually drives. The remainder throw rather than being cast away, so a
 * test that starts depending on them fails loudly instead of silently
 * receiving `undefined`.
 */
function fakeStore(overrides: Partial<SparqlStore>): SparqlStore {
  const unused = (name: string) => (): never => {
    throw new Error(`fakeStore.${name}() is not exercised by this test`)
  }
  return {
    query: unused('query'),
    update: unused('update'),
    loadTurtle: unused('loadTurtle'),
    loadJsonLd: unused('loadJsonLd'),
    isReady: unused('isReady'),
    ...overrides,
  } as SparqlStore
}

describe('probePropertyPathSupport', () => {
  it('passes on a real Oxigraph store (SPARQL 1.1 property paths supported)', async () => {
    const store = new OxigraphStore()
    await expect(probePropertyPathSupport(store)).resolves.toBeUndefined()
  })

  it('throws StoreCapabilityError when the store rejects the probe query', async () => {
    const broken = fakeStore({
      async loadTurtle() {
        // Accept the load so the probe reaches the query step.
      },
      async query() {
        throw new Error('UNSUPPORTED: property paths are not implemented')
      },
    })
    await expect(probePropertyPathSupport(broken)).rejects.toBeInstanceOf(StoreCapabilityError)
  })

  it('throws StoreCapabilityError when the probe query returns the wrong cardinality', async () => {
    const onlyA = fakeStore({
      async loadTurtle() {
        // intentional: probe runs no-op load on this mock
      },
      async query(): Promise<SparqlResults> {
        // Return only the "reflexive" binding (ClassA), as a buggy
        // engine that doesn't walk the `*` operator would.
        return {
          head: { vars: ['cls'] },
          results: {
            bindings: [
              {
                cls: { type: 'uri', value: 'urn:probe:ClassA' },
              },
            ],
          },
        }
      },
    })
    await expect(probePropertyPathSupport(onlyA)).rejects.toBeInstanceOf(StoreCapabilityError)
  })

  it('throws StoreCapabilityError when the store rejects the data load', async () => {
    const noLoad = fakeStore({
      async loadTurtle() {
        throw new Error('store is read-only')
      },
      async query() {
        return { head: { vars: [] }, results: { bindings: [] } }
      },
    })
    await expect(probePropertyPathSupport(noLoad)).rejects.toBeInstanceOf(StoreCapabilityError)
  })
})
