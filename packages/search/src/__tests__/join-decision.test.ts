/**
 * The parent → child JOIN is decided from the reference chains it is built
 * from, and a domain it still cannot join is reported, never dropped quietly.
 *
 * Regression: the decision read the references the schema declares, the JOIN
 * the chains path discovery found. A reference declared without a chain made a
 * JOIN rooted at the parent that left the child, and every constraint on it,
 * out of the query with no gap.
 */
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { describe, expect, it } from 'vitest'

import { OxigraphStore } from '../../../sparql/src/oxigraph-store.js'
import { joinableReferences } from '../compiler-helpers-references.js'
import {
  emitReferencedDomainJoins,
  pickPopulatedReferenceChain,
  type ReferenceEmitContext,
} from '../compiler-reference-emit.js'
import type { CompilerVocab } from '../compiler-vocab.js'
import type { ReferenceChain } from '../property-paths.js'

const chainTo = (parentDomain: string, childDomain: string): ReferenceChain => ({
  parentClass: `urn:class:${parentDomain}`,
  parentDomain,
  steps: [{ predicate: 'urn:predicate:references' }],
  kind: 'class',
  childClass: `urn:class:${childDomain}`,
  childDomain,
})

const vocabWith = (chains: ReferenceChain[]): CompilerVocab => {
  const referenceChains = new Map<string, ReferenceChain[]>()
  for (const chain of chains) {
    referenceChains.set(chain.parentDomain, [
      ...(referenceChains.get(chain.parentDomain) ?? []),
      chain,
    ])
  }
  return { referenceChains } as unknown as CompilerVocab
}

describe('joinableReferences', () => {
  const declared = new Map([
    ['joined', new Set(['child'])],
    ['unjoined', new Set(['child', 'other'])],
  ])

  it('keeps a reference a chain joins and drops one without a chain', () => {
    const joinable = joinableReferences(declared, vocabWith([chainTo('joined', 'child')]))
    expect(joinable).toEqual(new Map([['joined', new Set(['child'])]]))
  })

  it('is empty when no declared reference has a chain', () => {
    expect(joinableReferences(declared, vocabWith([])).size).toBe(0)
  })
})

describe('emitReferencedDomainJoins', () => {
  const contextFor = (vocabIndex: CompilerVocab): ReferenceEmitContext => ({
    registry: {
      domains: new Map([['child', { name: 'child', targetClass: 'child:Thing' }]]),
    } as unknown as DomainRegistry,
    vocabIndex,
    patterns: [],
    filters: [],
    optionals: [],
    selectVars: new Set(['?asset']),
    prefixDomains: new Set(['parent']),
    traces: [],
    droppedReferences: [],
  })

  it('reports a constrained domain no chain joins as dropped', async () => {
    const ctx = contextFor(vocabWith([]))
    await emitReferencedDomainJoins(
      ['parent', 'child'],
      'parent',
      { child: { kind: 'x' } },
      {},
      ctx
    )
    expect(ctx.droppedReferences).toEqual(['child'])
    expect(ctx.patterns).toEqual([])
  })

  it('reports nothing for a domain that carries no constraint', async () => {
    const ctx = contextFor(vocabWith([]))
    await emitReferencedDomainJoins(['parent', 'child'], 'parent', {}, {}, ctx)
    expect(ctx.droppedReferences).toEqual([])
  })
})

/**
 * Regression: a class with several open IRI references (a licence and the
 * subject matter, say) joined every child through the first one in build
 * order, so a query for assets about a scenario followed the licence and
 * matched nothing.
 */
describe('pickPopulatedReferenceChain', () => {
  const openChain = (predicate: string): ReferenceChain => ({
    parentClass: 'urn:class:parent',
    parentDomain: 'parent',
    steps: [{ predicate }],
    kind: 'iri',
  })
  const license = openChain('urn:predicate:license')
  const subject = openChain('urn:predicate:subject')
  const registry = {
    domains: new Map([['child', { name: 'child', targetClassIri: 'urn:class:child' }]]),
  } as unknown as DomainRegistry

  const storeWith = async (turtle: string): Promise<OxigraphStore> => {
    const store = new OxigraphStore()
    await store.loadTurtle(turtle)
    return store
  }

  it('joins through the open reference the data populates with the child', async () => {
    const store = await storeWith(`
      <urn:a1> a <urn:class:parent> ;
        <urn:predicate:license> <urn:licence:1> ;
        <urn:predicate:subject> <urn:c1> .
      <urn:c1> a <urn:class:child> .
    `)
    const chain = await pickPopulatedReferenceChain(
      vocabWith([license, subject]),
      registry,
      'parent',
      'child',
      () => Promise.resolve(store)
    )
    expect(chain).toBe(subject)
  })

  it('keeps the first open reference when the data populates none', async () => {
    const store = await storeWith('<urn:a1> a <urn:class:parent> .')
    const chain = await pickPopulatedReferenceChain(
      vocabWith([license, subject]),
      registry,
      'parent',
      'child',
      () => Promise.resolve(store)
    )
    expect(chain).toBe(license)
  })

  it('uses a chain declared to the child without consulting the data', async () => {
    const declared = chainTo('parent', 'child')
    const chain = await pickPopulatedReferenceChain(
      vocabWith([license, declared]),
      registry,
      'parent',
      'child',
      () => Promise.reject(new Error('the store must not be consulted'))
    )
    expect(chain).toBe(declared)
  })
})
