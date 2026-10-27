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
 * the object of none of the predicates through which the asset domains
 * compose the vocabulary's content (`compositionPredicates`; `FILTER NOT
 * EXISTS` over a `VALUES` list, [SPARQL11] §8.1, §10.2), so a vocabulary node
 * composed into an asset (and therefore already answered by that asset's arm)
 * is never reported twice, while a document some other triple merely points
 * at stays standalone. The arm matches the entry class itself: a class below
 * it that declares properties of its own is an entry class in its own right
 * and gets its own arm, and listing the whole closure would not do, since a
 * vocabulary may put every class, nested node classes and value classes
 * included, below its entry class.
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

import {
  emitConstraintGroups,
  groupConstraints,
  resolveConstraints,
} from './compiler-constraints.js'
import { emitDirectPathFilters, resolveKey } from './compiler-helpers-paths.js'
import { findDomainForIri, prefixedPredicate } from './compiler-helpers-primitives.js'
import { ASSET_LABEL_PATTERN } from './compiler-helpers-query.js'
import type { CompilerVocab } from './compiler-vocab.js'
import { compositionPredicates } from './compiler-vocabulary-scope.js'
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
 * Shape of an arm ([SPARQL11] §5.2 group, §6 OPTIONAL, §8.1 NOT EXISTS,
 * §10.2 VALUES):
 *   ?asset a <EntryClass> .
 *   <leaf path patterns + FILTERs>
 *   OPTIONAL { ?asset rdfs:label ?name }
 *   FILTER NOT EXISTS { VALUES ?_ownerLink { <composer> … } ?_owner ?_ownerLink ?asset }
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
  const composers = compositionPredicates(domainName, registry, vocabIndex)
  const guard =
    composers.length === 0
      ? []
      : [
          `FILTER NOT EXISTS { VALUES ?_ownerLink { ${composers.map((p) => `<${p}>`).join(' ')} } ?_owner ?_ownerLink ?asset }`,
        ]
  for (const root of vocabIndex.vocabularyRoots?.get(domainName) ?? []) {
    // Keys resolve against this entry class's own paths (ADR 0009); a document
    // that cannot express every constraint is no answer.
    const constraints = resolveConstraints(
      Object.entries(slots.filters),
      Object.entries(slots.ranges),
      (key, value) => resolveKey(root.paths, root.alternatives, key, value)
    )
    if (constraints.some((constraint) => constraint.paths.length === 0)) continue
    const { groups, singles } = groupConstraints(constraints)
    const filterEntries = singles.flatMap((c): [string, string | string[], PropertyPath][] =>
      c.kind === 'filter' ? [[c.key, c.value, c.paths[0]!]] : []
    )
    const rangeEntries = singles.flatMap(
      (c): [string, { min?: number; max?: number }, PropertyPath][] =>
        c.kind === 'range' ? [[c.key, c.range, c.paths[0]!]] : []
    )

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
    emitConstraintGroups(
      domainName,
      groups,
      '?asset',
      '',
      patterns,
      armVars,
      foreign,
      registry,
      vocabIndex
    )
    for (const d of foreign) prefixDomains.add(d)
    for (const v of armVars) selectVars.add(v)

    const body = [...patterns, ASSET_LABEL_PATTERN, ...guard, ...filters]
      .map((line) => `    ${line}`)
      .join('\n')
    arms.push(`  {\n${body}\n  }`)
  }
  return arms
}
