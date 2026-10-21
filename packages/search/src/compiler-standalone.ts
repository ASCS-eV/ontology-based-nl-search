/**
 * Standalone-vocabulary UNION arms.
 *
 * A support vocabulary (one whose classes root no asset domain) can also be
 * published on its own — a document typed only with the vocabulary's entry
 * class, not nested inside any asset. When a query names such a vocabulary as
 * a domain, each discovered entry class (`CompilerVocab.vocabularyRoots`)
 * contributes one UNION arm that matches those standalone documents, next to
 * the asset arms that match the vocabulary nested inside assets.
 *
 * "Standalone" is decided structurally, not by any ontology term: the node is
 * the object of no triple at all (`FILTER NOT EXISTS`, [SPARQL11] §8.1), so a
 * vocabulary node composed into an asset (and therefore already answered by
 * that asset's arm) is never reported twice.
 *
 * A standalone document is a closed unit: it cannot acquire a property from
 * anywhere else. An entry class therefore yields an arm only when it can
 * express EVERY constraint of the query — a restriction it has no path for
 * removes the arm instead of being silently dropped (which would return
 * documents that violate what the user asked for).
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'
import type { SearchSlots } from '@ontology-search/slots/slots'

import { emitDirectPathFilters } from './compiler-helpers-paths.js'
import { findDomainForIri, prefixedPredicate } from './compiler-helpers-primitives.js'
import { ASSET_LABEL_PATTERN } from './compiler-helpers-query.js'
import type { CompilerVocab } from './compiler-vocab.js'
import type { PropertyPath } from './property-paths.js'

/** The requested domains that are standalone vocabularies (have entry classes). */
export function standaloneVocabularyDomains(
  domains: string[],
  vocabIndex: CompilerVocab
): string[] {
  return domains.filter((d) => (vocabIndex.vocabularyRoots?.get(d)?.length ?? 0) > 0)
}

/**
 * Build one `{ … }` group per entry class of `domainName` that can express
 * every constraint of the query (every entry class when the query has no
 * constraints).
 *
 * Shape of an arm ([SPARQL11] §5.2 group, §6 OPTIONAL, §8.1 NOT EXISTS):
 *   ?asset a <EntryClass> .
 *   <leaf path patterns + FILTERs>
 *   OPTIONAL { ?asset rdfs:label ?name }
 *   FILTER NOT EXISTS { ?_owner ?_ownerLink ?asset }
 */
export function buildStandaloneArms(
  domainName: string,
  slots: SearchSlots,
  registry: DomainRegistry,
  vocabIndex: CompilerVocab,
  prefixDomains: Set<string>,
  selectVars: Set<string>
): string[] {
  const arms: string[] = []
  for (const root of vocabIndex.vocabularyRoots?.get(domainName) ?? []) {
    const filterEntries: [string, string | string[], PropertyPath][] = []
    for (const [name, value] of Object.entries(slots.filters)) {
      const path = root.paths.get(name)
      if (path) filterEntries.push([name, value, path])
    }
    const rangeEntries: [string, { min?: number; max?: number }, PropertyPath][] = []
    for (const [name, range] of Object.entries(slots.ranges)) {
      const path = root.paths.get(name)
      if (path) rangeEntries.push([name, range, path])
    }
    const constraintCount = Object.keys(slots.filters).length + Object.keys(slots.ranges).length
    if (filterEntries.length + rangeEntries.length < constraintCount) continue

    const rootDesc = findDomainForIri(root.rootClass, registry)
    if (rootDesc) prefixDomains.add(rootDesc.name)
    prefixDomains.add(domainName)
    const rootTerm = rootDesc ? prefixedPredicate(root.rootClass, rootDesc) : `<${root.rootClass}>`

    const patterns = [`?asset a ${rootTerm} .`]
    const filters: string[] = []
    const armVars = new Set<string>()
    const foreign = new Set<string>()
    emitDirectPathFilters(
      domainName,
      filterEntries,
      rangeEntries,
      '?asset',
      '',
      patterns,
      filters,
      armVars,
      foreign,
      registry,
      vocabIndex
    )
    for (const d of foreign) prefixDomains.add(d)
    for (const v of armVars) selectVars.add(v)

    const body = [
      ...patterns,
      ASSET_LABEL_PATTERN,
      'FILTER NOT EXISTS { ?_owner ?_ownerLink ?asset }',
      ...filters,
    ]
      .map((line) => `    ${line}`)
      .join('\n')
    arms.push(`  {\n${body}\n  }`)
  }
  return arms
}
