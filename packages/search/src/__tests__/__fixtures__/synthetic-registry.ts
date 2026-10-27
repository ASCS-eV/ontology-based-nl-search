/**
 * Fixture schemas for the compiler tests: a synthetic `DomainRegistry` built
 * from domain rows instead of the disk, and an Oxigraph store loaded with a
 * fixture's shapes and data with the compiler vocabulary built over it.
 */
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'

import { OxigraphStore } from '../../../../sparql/src/oxigraph-store.js'
import { buildCompilerVocabFrom, type CompilerVocab } from '../../compiler-vocab.js'
import { SCHEMA_GRAPH } from '../../schema-loader.js'

/** One asset domain of a fixture: its namespace and its asset class's local name. */
export interface FixtureDomain {
  name: string
  namespace: string
  assetClass: string
  /** Defaults to the name without dashes. */
  prefix?: string
}

/**
 * The `DomainRegistry` surface discovery and the compiler read, for the given
 * asset domains. `baseNamespaces` names namespaces that belong to no asset
 * domain but are still told apart by IRI: a base vocabulary whose classes a
 * domain's classes inherit from, which is what classifies a shape group.
 */
export function syntheticRegistry(
  domains: readonly FixtureDomain[],
  baseNamespaces: Readonly<Record<string, string>> = {}
): DomainRegistry {
  const descriptors = domains.map(
    ({ name, namespace, assetClass, prefix = name.replace(/-/g, '') }) => ({
      name,
      namespace,
      prefix,
      targetClass: `${prefix}:${assetClass}`,
      targetClassIri: `${namespace}${assetClass}`,
      version: 'v1',
      shapes: [assetClass],
      declaredPrefixes: { [prefix]: namespace },
    })
  )
  const byName = new Map(descriptors.map((descriptor) => [descriptor.name, descriptor]))
  const namespaces: [string, string][] = [
    ...descriptors.map((d): [string, string] => [d.name, d.namespace]),
    ...Object.entries(baseNamespaces),
  ]
  const prefixLines = [
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
    'PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>',
    ...descriptors.map((d) => `PREFIX ${d.prefix}: <${d.namespace}>`),
  ].join('\n')
  const registry = {
    domains: byName,
    domainNames: [...byName.keys()],
    prefixesFor: () => prefixLines,
    allPrefixes: () => prefixLines,
    resolveByIriDomain: (name: string) => byName.get(name),
    domainForIri(iri: string): string | undefined {
      let best: string | undefined
      let length = 0
      for (const [name, namespace] of namespaces) {
        if (iri.startsWith(namespace) && namespace.length > length) {
          best = name
          length = namespace.length
        }
      }
      return best
    },
    getAllNamespaces: () => new Set(namespaces.map(([, namespace]) => namespace)),
  }
  // The synthetic registry implements only what discovery and the compiler read.
  return registry as unknown as DomainRegistry
}

/** A real Oxigraph store holding a fixture's shapes and data, and its vocabulary. */
export async function loadFixture(
  shapes: string,
  data: string,
  registry: DomainRegistry
): Promise<{ store: OxigraphStore; vocabIndex: CompilerVocab }> {
  const store = new OxigraphStore()
  await store.loadTurtle(shapes, SCHEMA_GRAPH)
  await store.loadTurtle(data)
  return { store, vocabIndex: await buildCompilerVocabFrom(store, registry) }
}

/** The distinct `?asset` values a query returns, sorted. */
export async function assetsOf(store: OxigraphStore, sparql: string): Promise<string[]> {
  const rows = (await store.query(sparql)).results.bindings
  return [...new Set(rows.flatMap((row) => (row['asset'] ? [row['asset'].value] : [])))].sort()
}
