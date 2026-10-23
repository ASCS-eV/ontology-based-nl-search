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

import { joinableReferences } from '../compiler-helpers-references.js'
import { emitReferencedDomainJoins, type ReferenceEmitContext } from '../compiler-reference-emit.js'
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

  it('reports a constrained domain no chain joins as dropped', () => {
    const ctx = contextFor(vocabWith([]))
    emitReferencedDomainJoins(['parent', 'child'], 'parent', { child: { kind: 'x' } }, {}, ctx)
    expect(ctx.droppedReferences).toEqual(['child'])
    expect(ctx.patterns).toEqual([])
  })

  it('reports nothing for a domain that carries no constraint', () => {
    const ctx = contextFor(vocabWith([]))
    emitReferencedDomainJoins(['parent', 'child'], 'parent', {}, {}, ctx)
    expect(ctx.droppedReferences).toEqual([])
  })
})
