/**
 * The slot constraints of one query, resolved and grouped — the one place the
 * compile paths that resolve keys (a domain's patterns, a vocabulary root's
 * arm, a domain-less query) share.
 *
 * Each key resolves to the chains that can hold its constraint (ADR 0009). A
 * bare name the index reaches through several chains is read with its
 * siblings: bare names whose chains can end on one node hold on one node, so
 * `{ code: 'cut_in', reason: 'overtake' }` asks for one value node that cuts
 * in for overtaking, not a cut-in on one node and that reason on another (one
 * variable binds one term, [SPARQL11] §18.1.8). Every largest set of bare
 * names that can sit on a common node is one group, emitted as a `UNION` with
 * a branch per node the set shares ([SPARQL11] §7); a name in several such
 * sets holds once in each, so a further constraint only ever narrows a query.
 * Every constraint with at most one chain — a qualified key, a unique name, a
 * bare name a value narrowed to one chain — is a single, routed by its
 * compile path, also when a group holds it too.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
import type { DomainRegistry } from '@ontology-search/ontology/domain-registry'

import {
  emitLeafFilter,
  emitLeafRange,
  type KeyResolution,
  pathNodeKey,
  pathPrefixKey,
} from './compiler-helpers-paths.js'
import { findDomainForIri, prefixedPredicate } from './compiler-helpers-primitives.js'
import type { CompilerVocab } from './compiler-vocab.js'
import type { PropertyPath } from './property-paths-types.js'

/** A slot filter or range with the chains that can hold it. */
export type Constraint = (
  | { kind: 'filter'; value: string | string[] }
  | { kind: 'range'; range: { min?: number; max?: number } }
) & {
  key: string
  /** The chains that can hold the constraint; empty when the key resolves to none. */
  paths: PropertyPath[]
  /** The key is a bare name for several chains (ADR 0009), whatever narrowed it. */
  bare: boolean
}

/**
 * Bare-name constraints held on one node: a branch per node they share, each
 * listing the chain of every member (in member order) that ends on it.
 */
export interface ConstraintGroup {
  members: Constraint[]
  branches: PropertyPath[][]
}

/**
 * Resolve slot filters and ranges against a keyed path index. A filter keeps
 * the chains that can hold its value; a range, every chain.
 *
 * @param resolve Resolves a key, narrowed by a value when one is given.
 */
export function resolveConstraints(
  filters: Iterable<[string, string | string[]]>,
  ranges: Iterable<[string, { min?: number; max?: number }]>,
  resolve: (key: string, value?: string | string[]) => KeyResolution
): Constraint[] {
  const chainsOf = (resolution: KeyResolution): PropertyPath[] =>
    resolution.kind === 'path'
      ? [resolution.path]
      : resolution.kind === 'alternatives'
        ? resolution.paths
        : []
  const isBare = (key: string) => resolve(key).kind === 'alternatives'
  return [
    ...[...filters].map(
      ([key, value]): Constraint => ({
        kind: 'filter',
        key,
        value,
        paths: chainsOf(resolve(key, value)),
        bare: isBare(key),
      })
    ),
    ...[...ranges].map(
      ([key, range]): Constraint => ({
        kind: 'range',
        key,
        range,
        paths: chainsOf(resolve(key)),
        bare: isBare(key),
      })
    ),
  ]
}

/**
 * The nodes a chain's leaf may hang off ({@link pathPrefixKey}), one per class
 * whose node shape declares the leaf for this chain ([SHACL] §2.3): a chain
 * several classes declare stands for a node of any of them, though its path
 * names the first class only. None for a leaf only inherited from a
 * superclass of the class reached: it may sit on any value node of its hop
 * ([SHACL] §2.1.3.2), so no one node can be named for it.
 */
function nodeKeysOf(path: PropertyPath): string[] | undefined {
  if (path.inheritedLeaf) return undefined
  const owners = path.owningClasses ?? []
  const lastHop = path.steps.length - 2
  if (owners.length < 2 || lastHop < 0) return [pathPrefixKey(path)]
  return owners.map((owner) =>
    pathNodeKey(
      {
        steps: path.steps.map((step, i) =>
          i === lastHop ? { ...step, intermediate: owner } : step
        ),
      },
      lastHop + 1
    )
  )
}

/**
 * Split constraints into the groups of bare names that hold on a shared node
 * and the singles each compile path routes itself.
 *
 * A bare name is placed by the nodes its chains end on; one that reaches a
 * node through two chains, or has a chain whose leaf is only inherited,
 * cannot be placed on one node per branch and stays a group of its own. For
 * every node, the bare names that can sit there form a set; each largest set
 * (no other contains it) with two or more members is a group, restricted to
 * the nodes it shares. A bare name in no such set keeps a group of its own
 * over all its chains, or is only a single when one chain is left. Members,
 * branches and groups follow key order and chain order, so the result does
 * not depend on the order the slots were written in.
 *
 * Every constraint with at most one chain is a single, also when a group
 * holds it: it keeps the emission it has on its own, with whatever node that
 * shares with unique and qualified siblings, and the group adds its bare
 * siblings. Joining a group thus only ever adds a condition.
 *
 * One function on purpose: placement, the largest sets and their branches are
 * steps of one algorithm over the same per-node index.
 */
export function groupConstraints(constraints: readonly Constraint[]): {
  groups: ConstraintGroup[]
  singles: Constraint[]
} {
  const bare = constraints
    .filter((c) => c.bare && c.paths.length > 0)
    .sort((a, b) => a.key.localeCompare(b.key) || a.kind.localeCompare(b.kind))
  const chainAt = bare.map((constraint) => {
    const byNode = new Map<string, PropertyPath>()
    for (const path of constraint.paths) {
      const nodes = nodeKeysOf(path)
      if (!nodes) return undefined
      for (const node of nodes) {
        if (byNode.has(node) && byNode.get(node) !== path) return undefined
        byNode.set(node, path)
      }
    }
    return byNode
  })

  const atNode = new Map<string, number[]>()
  chainAt.forEach((byNode, i) => {
    for (const node of byNode?.keys() ?? []) atNode.set(node, [...(atNode.get(node) ?? []), i])
  })
  const sets = new Map<string, number[]>()
  for (const members of atNode.values()) {
    if (members.length > 1) sets.set(members.join(' '), members)
  }
  const contains = (outer: number[], inner: number[]) =>
    outer.length > inner.length && inner.every((i) => outer.includes(i))
  const largest = [...sets.values()].filter(
    (set) => ![...sets.values()].some((other) => contains(other, set))
  )

  const placed = new Set(largest.flat())
  const groups: { first: number; group: ConstraintGroup }[] = largest.map((set) => {
    const branches: PropertyPath[][] = []
    const seen = new Set<string>()
    // Branches in the chain order of the first member. Two nodes that differ
    // only in a declaring class can leave every member on the same chain: one
    // branch walks it.
    for (const path of bare[set[0]!]!.paths) {
      for (const node of nodeKeysOf(path) ?? []) {
        if (!set.every((i) => chainAt[i]!.has(node))) continue
        const chains = set.map((i) => chainAt[i]!.get(node)!)
        const identity = chains.map((chain, j) => bare[set[j]!]!.paths.indexOf(chain)).join(' ')
        if (seen.has(identity)) continue
        seen.add(identity)
        branches.push(chains)
      }
    }
    return { first: set[0]!, group: { members: set.map((i) => bare[i]!), branches } }
  })
  bare.forEach((constraint, i) => {
    if (!placed.has(i) && constraint.paths.length > 1) {
      groups.push({
        first: i,
        group: { members: [constraint], branches: constraint.paths.map((path) => [path]) },
      })
    }
  })
  return {
    groups: groups.sort((a, b) => a.first - b.first).map(({ group }) => group),
    singles: constraints.filter((constraint) => constraint.paths.length <= 1),
  }
}

/**
 * Emit constraint groups ({@link groupConstraints}) as one `UNION` each
 * ([SPARQL11] §7): a branch walks one node's route once from the asset, with
 * intermediates of its own, and tests every member's leaf on that node, so
 * the members hold on one node. Every branch binds each member's variable,
 * so a value is projected whichever node holds it. A member bound elsewhere
 * already — by its single emission, or by an earlier group — gets a variable
 * of the group's own in each further group, which is not projected: its
 * groups need not share a value node. The branches share no node with the
 * query's other constraints.
 *
 * One function on purpose: a branch's route, its members' leaves and their
 * variables are emitted together, once per branch.
 */
export function emitConstraintGroups(
  domainName: string,
  groups: readonly ConstraintGroup[],
  assetVar: string,
  suffix: string,
  patterns: string[],
  selectVars: Set<string>,
  foreignDomains: Set<string>,
  registry: DomainRegistry,
  vocabIndex: CompilerVocab
): void {
  const emitPredicate = (predicateIri: string): string => {
    const desc = findDomainForIri(predicateIri, registry)
    if (desc && desc.name !== domainName) foreignDomains.add(desc.name)
    return desc ? prefixedPredicate(predicateIri, desc) : `<${predicateIri}>`
  }
  // A constraint with one chain is bound by its single emission already.
  const bound = new Set<Constraint>()
  groups.forEach((group, groupIdx) => {
    const leaves = group.members.map((member, memberIdx) => {
      const first = !bound.has(member) && member.paths.length > 1
      bound.add(member)
      return first
        ? { key: member.key, vars: selectVars }
        : { key: `_alt${groupIdx}_m${memberIdx}`, vars: new Set<string>() }
    })
    const branches = group.branches.map((chains, branchIdx) => {
      const lines: string[] = []
      const tests: string[] = []
      const route = chains[0]!
      let cursor = assetVar
      for (let i = 0; i < route.steps.length - 1; i++) {
        const intVar = `?_alt${groupIdx}_${branchIdx}_${i}${suffix}`
        lines.push(`${cursor} ${emitPredicate(route.steps[i]!.predicate)} ${intVar} .`)
        cursor = intVar
      }
      group.members.forEach((member, memberIdx) => {
        const path = chains[memberIdx]!
        const leafPred = emitPredicate(path.steps[path.steps.length - 1]!.predicate)
        const leaf = leaves[memberIdx]!
        if (member.kind === 'filter') {
          emitLeafFilter(
            cursor,
            leafPred,
            leaf.key,
            suffix,
            member.value,
            path,
            lines,
            tests,
            leaf.vars
          )
        } else {
          emitLeafRange(
            cursor,
            leafPred,
            leaf.key,
            suffix,
            member.range,
            path,
            lines,
            tests,
            leaf.vars,
            emitPredicate,
            vocabIndex
          )
        }
      })
      return `{\n    ${[...lines, ...tests].join('\n    ')}\n  }`
    })
    patterns.push(branches.join('\n  UNION\n  '))
  })
}
