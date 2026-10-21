/**
 * The scope helpers against the pinned ontology (`domain-scope.ts`). The rows
 * a vocabulary scope returns are checked on a synthetic ontology in
 * `vocabulary-scope-fixture.test.ts`; the pinned sample data holds the
 * vocabulary's content in every asset of its owners, so it cannot show the
 * restriction excluding anything.
 *
 * Nothing is named: the vocabulary under test is the first one, by name, with
 * standalone entry classes and at least two asset domains using it.
 */
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { beforeAll, describe, expect, it } from 'vitest'

import { getAssetDomains } from '../asset-domains.js'
import { compileSlotsWithTrace } from '../compiler.js'
import { getCompilerVocab } from '../compiler-vocab.js'
import { resolveDomainScope } from '../compiler-vocabulary-scope.js'
import {
  canonicalDomains,
  constraintsOutsideScope,
  resolveKnownDomains,
  searchedDomains,
} from '../domain-scope.js'
import { getInitializedStore } from '../init.js'
import { retrieveRelevantSchema } from '../schema-index/retrieval.js'

let vocabulary: string
let owners: string[]

beforeAll(async () => {
  const [registry, vocabIndex, assetDomains] = await Promise.all([
    buildDomainRegistry(),
    getCompilerVocab(),
    getAssetDomains(),
  ])
  const candidates = [...(vocabIndex.vocabularyRoots?.keys() ?? [])]
    .filter((name) => !assetDomains.has(name))
    .sort()
  for (const name of candidates) {
    const scope = resolveDomainScope([name], { filters: {}, ranges: {} }, registry, vocabIndex)
    if (scope.carried.size >= 2) {
      vocabulary = name
      owners = scope.assetDomains
      return
    }
  }
}, 300_000)

describe('scope helpers on the pinned ontology', () => {
  it('finds a vocabulary used by several asset domains', () => {
    expect(vocabulary).toBeDefined()
  })

  it('names every known domain canonically and reports the unknown ones', async () => {
    const { known, unknown } = await canonicalDomains([vocabulary.toUpperCase(), 'no-such-domain'])
    expect(known).toEqual([vocabulary])
    expect(unknown).toEqual(['no-such-domain'])
  }, 120_000)

  /**
   * Regression: a registry name in another case went through the
   * normalization meant for a model's variants first, which splits it at a
   * case change ("HDMap" → "hd-map"), so an API client got a 400 for a domain
   * that exists.
   */
  it('accepts a registry name in any case before normalizing it', async () => {
    const owner = owners[0]!
    const mixed = owner.slice(0, 2).toUpperCase() + owner.slice(2, 3) + owner.slice(3).toUpperCase()
    const { known, unknown } = await canonicalDomains([mixed])
    expect(unknown).toEqual([])
    expect(known).toEqual([owner])
  }, 120_000)

  it('searches the vocabulary and the domains that use it', async () => {
    expect((await searchedDomains([vocabulary])).sort()).toEqual([...owners, vocabulary].sort())
  }, 120_000)

  /**
   * Regression: a vocabulary-only request was widened to the asset domains
   * using the vocabulary, after which nothing told the compiler they were to
   * be searched only for that vocabulary's content.
   */
  it('keeps the vocabulary as the scope of a vocabulary-only natural-language request', async () => {
    expect(await resolveKnownDomains([vocabulary, ...owners], [vocabulary])).toEqual([vocabulary])
  }, 120_000)

  it('keeps a named asset domain and drops a vocabulary next to it', async () => {
    expect(await resolveKnownDomains([owners[0]!, vocabulary])).toEqual([owners[0]])
  }, 120_000)

  it('searches a vocabulary that types asset classes through all of their assets', async () => {
    const vocabIndex = await getCompilerVocab()
    const typing = [...(vocabIndex.assetClassVocabularies ?? [])]
      .flatMap(([domain, set]) => [...set].map((name) => [domain, name] as const))
      .sort()[0]
    expect(typing).toBeDefined()
    const [domain, typingVocabulary] = typing!
    const { sparql } = await compileSlotsWithTrace({
      domains: [typingVocabulary],
      filters: {},
      ranges: {},
    })
    const all = await compileSlotsWithTrace({ domains: [domain], filters: {}, ranges: {} })
    const store = await getInitializedStore()
    const ids = async (query: string) =>
      new Set((await store.query(query)).results.bindings.map((b) => b['asset']?.value))
    const scoped = await ids(sparql)
    for (const asset of await ids(all.sparql)) expect(scoped.has(asset), asset).toBe(true)
  }, 120_000)

  it('finds the constraints no searched domain can express', async () => {
    const filters = { 'no-such-property': 'x' }
    expect(await constraintsOutsideScope({ domains: [vocabulary], filters, ranges: {} })).toEqual([
      'no-such-property',
    ])
  }, 120_000)

  /**
   * Regression: each key was judged against the owners left after the
   * coverage rule had removed every owner that cannot express all keys
   * together, so two keys that different owners express were both reported
   * outside the scope and removed, and the stricter query matched more.
   */
  it('judges each constraint on its own against every searched domain', async () => {
    const [registry, vocabIndex] = await Promise.all([buildDomainRegistry(), getCompilerVocab()])
    const leavesOf = (domain: string, name: string) =>
      new Set(
        [...vocabIndex.paths]
          .filter(
            ([indexKey, path]) =>
              indexKey.startsWith(`${domain}:`) && registry.domainForIri(path.propertyIri) === name
          )
          .map(([indexKey]) => indexKey.slice(domain.length + 1))
      )
    let found: { name: string; keys: [string, string] } | undefined
    for (const name of [...(vocabIndex.vocabularyRoots?.keys() ?? [])].sort()) {
      const scope = resolveDomainScope([name], { filters: {}, ranges: {} }, registry, vocabIndex)
      const sets = [...scope.carried.keys()].map((owner) => leavesOf(owner, name))
      for (const a of sets) {
        for (const b of sets) {
          const onlyA = [...a].find((key) => !b.has(key))
          const onlyB = [...b].find((key) => !a.has(key))
          if (onlyA && onlyB && !found) found = { name, keys: [onlyA, onlyB] }
        }
      }
    }
    expect(found).toBeDefined()
    const [first, second] = found!.keys
    const outside = await constraintsOutsideScope({
      domains: [found!.name],
      filters: { [first]: 'x', [second]: 'y' },
      ranges: {},
    })
    expect(outside).toEqual([])
  }, 120_000)

  it('routes retrieval to exactly the searched domains', async () => {
    const store = await getInitializedStore()
    const scope = await searchedDomains([vocabulary])
    const retrieved = await retrieveRelevantSchema(store, 'anything at all', { domains: scope })
    expect([...retrieved.domains].sort()).toEqual([...scope].sort())
  }, 120_000)
})
