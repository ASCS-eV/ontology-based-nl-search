/**
 * Property keys on the pinned ontology (ADR 0009), stated generically: every
 * leaf name a domain reaches through several chains has one qualified key
 * per chain, and every surface (compiler, vocabulary, term cards) agrees on
 * them. Nothing here names a domain or a property.
 */
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { Parser } from 'sparqljs'
import { beforeAll, describe, expect, it } from 'vitest'

import { compileSlots, getCompilerVocab } from '../compiler.js'
import type { CompilerVocab } from '../compiler-vocab.js'
import { getInitializedStore } from '../init.js'
import { indexPropertyKeys, keyOfIndexEntry, predicateChain } from '../property-keys.js'
import { discoverPropertyPaths } from '../property-paths.js'
import { buildTermIndex, type TermIndex } from '../schema-index/term-index.js'
import {
  extractSchemaVocabulary,
  resetVocabulary,
  type SchemaVocabulary,
} from '../vocabulary-extractor.js'

let vocab: CompilerVocab
let index: TermIndex
let schema: SchemaVocabulary

beforeAll(async () => {
  const store = await getInitializedStore()
  resetVocabulary()
  vocab = await getCompilerVocab()
  index = await buildTermIndex(store)
  schema = await extractSchemaVocabulary(store)
}, 180_000)

const domainOf = (indexKey: string) => indexKey.slice(0, indexKey.indexOf(':'))

describe('property keys on the pinned ontology', () => {
  it('has leaf names reached through several chains (or this suite proves nothing)', () => {
    expect(vocab.alternatives?.size ?? 0).toBeGreaterThan(0)
  })

  it('gives a shape-group property of a domain no further route there', () => {
    // The domain's shape-group facets and group nodes read such a name as one
    // path; a further route would make it a bare name for several.
    const keyed = [...vocab.paths.values(), ...[...(vocab.alternatives?.values() ?? [])].flat()]
    const offending = keyed.filter(
      (path) => path.alternateRoute && vocab.shapeGroups.has(`${path.propertyName}:${path.domain}`)
    )
    expect(offending.map((path) => `${path.domain}:${path.propertyName}`)).toEqual([])
  })

  it('keeps every further route of a name that is a shape-group property elsewhere only', async () => {
    const { assetPaths } = await discoverPropertyPaths(
      await getInitializedStore(),
      await buildDomainRegistry()
    )
    const keyed = new Set(
      [...vocab.paths.values(), ...[...(vocab.alternatives?.values() ?? [])].flat()].map(
        (path) => `${path.domain} ${predicateChain(path)}`
      )
    )
    const kept = assetPaths.filter(
      (path) => path.alternateRoute && !vocab.shapeGroups.has(`${path.propertyName}:${path.domain}`)
    )
    expect(kept.length).toBeGreaterThan(0)
    const lost = kept.filter((path) => !keyed.has(`${path.domain} ${predicateChain(path)}`))
    expect(lost.map((path) => `${path.domain}:${path.propertyName}`)).toEqual([])
  })

  it('gives each chain of an ambiguous name a distinct qualified key, never the bare name', () => {
    for (const [indexKey, chains] of vocab.alternatives ?? []) {
      const domain = domainOf(indexKey)
      expect(vocab.paths.has(indexKey), indexKey).toBe(false)
      expect(new Set(chains.map(predicateChain)).size, indexKey).toBe(chains.length)
      const keys = chains.map((chain) => {
        const entry = [...vocab.paths].find(([k, p]) => p === chain && domainOf(k) === domain)
        expect(entry, `${indexKey}: chain without a key`).toBeDefined()
        return keyOfIndexEntry(entry![0])
      })
      expect(new Set(keys).size, indexKey).toBe(chains.length)
      expect(keys, indexKey).not.toContain(keyOfIndexEntry(indexKey))
    }
  })

  it('shows one card per qualified key and none for the bare name it replaces', () => {
    const cards = new Set(
      index.cards.filter((c) => c.kind === 'property').map((c) => `${c.domain}:${c.localName}`)
    )
    for (const indexKey of vocab.paths.keys()) expect(cards.has(indexKey), indexKey).toBe(true)
    for (const indexKey of vocab.alternatives?.keys() ?? []) {
      expect(cards.has(indexKey), indexKey).toBe(false)
    }
  })

  it('lets the validator accept a bare ambiguous name for its domain', () => {
    for (const indexKey of vocab.alternatives?.keys() ?? []) {
      expect(schema.propertyDomains.get(keyOfIndexEntry(indexKey)), indexKey).toContain(
        domainOf(indexKey)
      )
      expect(
        schema.propertyShapeTargets?.get(keyOfIndexEntry(indexKey))?.length ?? 0
      ).toBeGreaterThan(1)
    }
  })

  it('gives a qualified key its own chain’s values', () => {
    for (const property of schema.enumProperties) {
      const path = vocab.paths.get(`${property.domain}:${property.localName}`)
      if (!path?.allowedValues || !property.leafName) continue
      expect(property.allowedValues, property.localName).toEqual(path.allowedValues)
    }
  })

  /**
   * A key's leaf predicate comes from its path and may sit in another domain's
   * namespace; every prefix the query uses must then be declared
   * ([SPARQL11] §4.1.1.1), or the query does not parse.
   */
  it('compiles a filter on every key to SPARQL that parses', async () => {
    const parser = new Parser()
    const failures: string[] = []
    const indexKeys = [...vocab.paths.keys(), ...(vocab.alternatives?.keys() ?? [])]
    for (const indexKey of indexKeys) {
      const sparql = await compileSlots({
        domains: [domainOf(indexKey)],
        filters: { [keyOfIndexEntry(indexKey)]: 'x' },
        ranges: {},
      })
      try {
        parser.parse(sparql)
      } catch (error) {
        failures.push(`${indexKey}: ${(error as Error).message.split('\n')[0]}`)
      }
    }
    expect(failures).toEqual([])
  }, 120_000)

  it('assigns the same keys and owners whatever order the store returns the schema in', async () => {
    const store = await getInitializedStore()
    const { assetPaths, vocabularyRootPaths } = await discoverPropertyPaths(
      store,
      await buildDomainRegistry()
    )
    for (const paths of [assetPaths, vocabularyRootPaths]) {
      const view = (input: typeof paths) =>
        [...indexPropertyKeys(input).byKey].map(
          ([key, p]) => `${key} ${p.owningClass} ${p.owningClasses?.join(',')}`
        )
      expect(view([...paths].reverse())).toEqual(view(paths))
    }
  }, 120_000)

  it('compiles a bare ambiguous name to one UNION branch per chain', async () => {
    for (const [indexKey, chains] of vocab.alternatives ?? []) {
      const sparql = await compileSlots({
        domains: [domainOf(indexKey)],
        filters: {},
        ranges: { [keyOfIndexEntry(indexKey)]: { min: 0 } },
      })
      expect(sparql.match(/\bUNION\b/g)?.length ?? 0, indexKey).toBe(chains.length - 1)
    }
  }, 120_000)
})
