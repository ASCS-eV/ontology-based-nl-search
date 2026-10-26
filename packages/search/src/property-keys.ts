/**
 * Property keys — the slot key of every property path (ADR 0009).
 *
 * A property shape is identified by the node shape that declares it and its
 * path ([SHACL] §2.3), not by the local name of the path's IRI. Two paths
 * that end in leaves of the same local name through different predicate
 * chains are different properties, with their own `sh:in` ([SHACL] §4.8.3).
 * Each chain therefore gets its own key, assigned per domain:
 *
 *   - paths with equal predicate chains are one property (they emit the same
 *     SPARQL) and share one key;
 *   - a leaf name with one chain keeps the name;
 *   - a leaf name with several chains gives each chain the shortest suffix of
 *     its predicate local names that no other chain of that name shares,
 *     joined with {@link PROPERTY_KEY_SEPARATOR}, leaf last;
 *   - a chain no suffix tells apart — it is one step long, or the tail of
 *     another chain — is led by the local name of its owning class, the
 *     node shape that declares the property shape ([SHACL] §2.3);
 *   - chains that still coincide get an ordinal, in IRI-chain order.
 *
 * No key ever equals the bare name, which stays the key for all chains.
 *
 * The bare name of a leaf with several chains stays a key too: it names all
 * of them ({@link KeyedPaths.alternatives}), narrowed per value by
 * {@link pathsThatCanHold}.
 *
 * Everything is ordered by IRI chain, so the keys never depend on the order a
 * store returns the schema in.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import { extractLocalName } from '@ontology-search/core/rdf/iri'

import type { PropertyPath } from './property-paths-types.js'

/**
 * Joins the predicate local names of a qualified key. Legal inside a GraphQL
 * Name ([GraphQL] §2.1.8) and a SPARQL variable name ([SPARQL11] §19.8,
 * rule 166), so a key can be both without being rewritten, and unlike a
 * single `_` it does not occur in ordinary local names.
 */
export const PROPERTY_KEY_SEPARATOR = '__'

/** A domain's paths, indexed by key. */
export interface KeyedPaths {
  /** `<domain>:<key>` → the one path (one predicate chain) the key names. */
  byKey: Map<string, PropertyPath>
  /**
   * `<domain>:<leaf name>` → the paths of a leaf name that reaches its leaf
   * through more than one predicate chain, in IRI-chain order. The bare name
   * is a key for all of them.
   */
  alternatives: Map<string, PropertyPath[]>
}

/** The predicate chain a path emits — what makes two paths the same property. */
export function predicateChain(path: PropertyPath): string {
  return path.steps.map((step) => step.predicate).join(' ')
}

/** Stable order of the paths that share one chain: asset class, then route. */
const routeSignature = (path: PropertyPath): string =>
  `${path.assetClass} ${path.steps.map((s) => `${s.predicate}@${s.intermediate ?? ''}`).join('>')} ${path.owningClass ?? ''}`

/**
 * Index paths by key, per domain. Paths that share a predicate chain collapse
 * to one representative — the first in route order — carrying the union of
 * their `allowedValues`.
 */
export function indexPropertyKeys(paths: readonly PropertyPath[]): KeyedPaths {
  // domain → leaf name → chain → paths
  const grouped = new Map<string, Map<string, Map<string, PropertyPath[]>>>()
  for (const path of paths) {
    const byName = grouped.get(path.domain) ?? new Map<string, Map<string, PropertyPath[]>>()
    grouped.set(path.domain, byName)
    const byChain = byName.get(path.propertyName) ?? new Map<string, PropertyPath[]>()
    byName.set(path.propertyName, byChain)
    const chain = predicateChain(path)
    byChain.set(chain, [...(byChain.get(chain) ?? []), path])
  }

  const byKey = new Map<string, PropertyPath>()
  const alternatives = new Map<string, PropertyPath[]>()
  for (const [domain, byName] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
    const names = [...byName.keys()].sort()
    // A qualified key must not shadow a leaf name the domain uses as a key.
    const taken = new Set(names.filter((name) => byName.get(name)!.size === 1))
    for (const name of names) {
      const chains = [...byName.get(name)!].sort(([a], [b]) => a.localeCompare(b))
      const representatives = chains.map(([, same]) => representativeOf(same))
      if (representatives.length === 1) {
        byKey.set(`${domain}:${name}`, representatives[0]!)
        continue
      }
      alternatives.set(`${domain}:${name}`, representatives)
      const keys = qualifiedKeys(representatives, name, taken)
      representatives.forEach((path, i) => {
        taken.add(keys[i]!)
        byKey.set(`${domain}:${keys[i]}`, path)
      })
    }
  }
  return { byKey, alternatives }
}

/** One path for a set of paths with the same chain, carrying all their values. */
function representativeOf(same: PropertyPath[]): PropertyPath {
  // Ordered by asset class, route AND owning class: a leaf declared at several
  // levels of a class hierarchy yields one path per declaring shape with the
  // same route, and which one represents the chain must not depend on the
  // order the store returned them in.
  const ordered = [...same].sort((a, b) => routeSignature(a).localeCompare(routeSignature(b)))
  const first = ordered[0]!
  if (ordered.length === 1) return first
  const owners = [...new Set(ordered.flatMap((p) => (p.owningClass ? [p.owningClass] : [])))].sort()
  const representative: PropertyPath = {
    ...first,
    ...(owners.length > 1 ? { owningClasses: owners } : {}),
  }
  // A chain some asset class reaches breadth-first is no alternate route,
  // whichever route another asset class takes to it.
  if (ordered.some((p) => !p.alternateRoute)) delete representative.alternateRoute
  const enumerated = ordered.filter((p) => p.allowedValues)
  // Some paths of the chain declare no `sh:in`: the chain is not closed.
  if (enumerated.length < ordered.length) {
    delete representative.allowedValues
    return representative
  }
  representative.allowedValues = [...new Set(enumerated.flatMap((p) => p.allowedValues!))].sort()
  return representative
}

/**
 * The qualified key of each chain of one leaf name (chains in IRI-chain
 * order): the shortest suffix of its predicate local names, of length 2 or
 * more, that no other chain shares; failing that, its owning class's local
 * name and its whole chain; failing that, an ordinal. A key is never the
 * bare name, a key already taken, or a key given to another chain.
 */
function qualifiedKeys(
  chains: PropertyPath[],
  leafName: string,
  taken: ReadonlySet<string>
): string[] {
  const names = chains.map((path) => path.steps.map((step) => extractLocalName(step.predicate)))
  const suffix = (localNames: string[], length: number) =>
    localNames.slice(-length).join(PROPERTY_KEY_SEPARATOR)
  const used = new Set([leafName, ...taken])
  return names.map((own, i) => {
    let key: string | undefined
    for (let length = 2; length <= own.length && key === undefined; length++) {
      const candidate = suffix(own, length)
      const shared = names.some((other, j) => j !== i && suffix(other, length) === candidate)
      if (!shared && !used.has(candidate)) key = candidate
    }
    if (key === undefined) {
      const owner = chains[i]!.owningClass
      const base = owner
        ? [extractLocalName(owner), ...own].join(PROPERTY_KEY_SEPARATOR)
        : suffix(own, own.length)
      key = base
      for (let ordinal = 2; used.has(key); ordinal++) {
        key = `${base}${PROPERTY_KEY_SEPARATOR}${ordinal}`
      }
    }
    used.add(key)
    return key
  })
}

/** The key part of a `<domain>:<key>` index entry (a domain name has no `:`). */
export function keyOfIndexEntry(indexKey: string): string {
  return indexKey.slice(indexKey.indexOf(':') + 1)
}

/**
 * The paths of an ambiguous name that can hold a filter value: those whose own
 * `sh:in` contains it (by IRI, or by the IRI's local name, as the slot
 * validator spells enumerated IRIs), plus those that declare no `sh:in`. When
 * no path qualifies, every path, so a value the validator let through is never
 * dropped silently. Several values (IN semantics) keep a path that can hold
 * any of them.
 */
export function pathsThatCanHold(
  paths: readonly PropertyPath[],
  value: string | readonly string[]
): PropertyPath[] {
  const values = typeof value === 'string' ? [value] : value
  const canHold = paths.filter(
    (path) =>
      !path.allowedValues ||
      path.allowedValues.some((allowed) =>
        values.some((v) => allowed === v || extractLocalName(allowed) === v)
      )
  )
  return canHold.length > 0 ? canHold : [...paths]
}
