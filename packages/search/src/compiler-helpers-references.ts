/**
 * Cross-domain reference resolution & emission (ADR 0003 step 22d): picks the
 * SHACL/data-driven reference edge or chain between two domains and emits the
 * JOIN triples. Depends only on the primitives leaf.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11]
 */
import { type DomainRegistry } from '@ontology-search/ontology/domain-registry'

import { findDomainForIri, prefixedPredicate } from './compiler-helpers-primitives.js'
import { type CompilerVocab } from './compiler-vocab.js'
import { type ReferenceChain } from './property-paths.js'
import { type DataReferenceEdge, type ReferenceIndex } from './reference-index.js'
import type { TraceabilityStep } from './slots.js'

/**
 * Pick the cross-domain reference chain to use when joining `parentDomain`
 * to `childDomain` (or to any child, if `childDomain` is undefined).
 *
 * Strategy:
 *   1. Prefer a `class:`-typed chain whose declared child class matches
 *      the requested domain — that's a SHACL-declared direct reference
 *      to exactly the child asset class, no extra type constraint needed.
 *   2. Otherwise fall back to the shortest `iri`-typed chain — the
 *      compiler will pair it with a `?ref a <ChildClass>` constraint.
 *
 * Returns `null` when the ontology declares no cross-reference path from
 * the parent. The caller skips reference emission rather than inventing
 * a literal predicate chain.
 */
/**
 * Fallback for `pickLiveReferenceEdge`: when no exact target match
 * exists, pick any sibling edge from the same parent domain. The reference
 * IRI edge is generic — the discovered chain
 * can point to any asset type. If the data index observed the parent
 * reaching *some* other domain via that path, the same path is valid for
 * the requested target (the caller adds the type constraint separately).
 *
 * Returns the shortest, highest-sample sibling edge, or null if the parent
 * has no outgoing edges at all.
 */
export function pickSiblingDataEdge(
  index: ReferenceIndex,
  parentDomain: string,
  excludeDomain?: string
): DataReferenceEdge | null {
  const edges = index.get(parentDomain)
  if (!edges) return null
  let best: DataReferenceEdge | null = null
  for (const e of edges) {
    if (excludeDomain && e.targetDomain === excludeDomain) continue
    if (
      !best ||
      e.predicatePath.length < best.predicatePath.length ||
      (e.predicatePath.length === best.predicatePath.length && e.sampleCount > best.sampleCount)
    ) {
      best = e
    }
  }
  // If nothing remained after excluding, pick from ALL edges (the excluded
  // domain's path is still the right structural template).
  if (!best) {
    for (const e of edges) {
      if (
        !best ||
        e.predicatePath.length < best.predicatePath.length ||
        (e.predicatePath.length === best.predicatePath.length && e.sampleCount > best.sampleCount)
      ) {
        best = e
      }
    }
  }
  return best
}

/**
 * Emit a SPARQL JOIN that walks the discovered predicate path step by
 * step, using fresh blank-node intermediates. The final step binds the
 * supplied `refVar` so the caller can constrain the child's type and
 * pull its label.
 *
 * Each predicate is emitted as a full `<IRI>` literal — that's the only
 * way to guarantee the query carries the exact path the index observed,
 * regardless of whether the prefix is registered.
 */
export function emitDataReferencePath(
  edge: DataReferenceEdge,
  sourceVar: string,
  refVar: string,
  patterns: string[],
  registry: DomainRegistry,
  prefixDomains: Set<string>,
  traceSteps?: TraceabilityStep[],
  // Intermediate-variable prefix. Each reference in a multi-reference query
  // MUST use a distinct prefix, otherwise the second reference's chain reuses
  // the first's step variables and forces one manifest artifact to be two
  // different asset types (an unsatisfiable JOIN). Defaults to `ref` so the
  // single-reference output is unchanged.
  stepPrefix: string = 'ref'
): void {
  let cursor = sourceVar
  for (let i = 0; i < edge.predicatePath.length; i++) {
    const isLast = i === edge.predicatePath.length - 1
    const next = isLast ? refVar : `?${stepPrefix}_step_${i + 1}`
    const predicate = edge.predicatePath[i]!
    // Mirror `emitReferenceChainTriples`: prefer the registered prefix
    // form when the predicate's namespace resolves, fall back to a full
    // `<IRI>` literal otherwise. Keeps the emitted SPARQL readable and
    // pulls in the predicate's domain prefix so the final PREFIX block
    // lists every namespace the query actually uses.
    const desc = findDomainForIri(predicate, registry)
    const pred = desc ? prefixedPredicate(predicate, desc) : `<${predicate}>`
    if (desc) prefixDomains.add(desc.name)
    patterns.push(`${cursor} ${pred} ${next} .`)
    traceSteps?.push({ variable: next.slice(1), predicate })
    cursor = next
  }
}

export function pickReferenceChain(
  vocabIndex: CompilerVocab,
  parentDomain: string,
  childDomain?: string
): ReferenceChain | null {
  const chains = vocabIndex.referenceChains.get(parentDomain)
  if (!chains || chains.length === 0) return null

  // Strategy 1: direct class-typed match.
  if (childDomain) {
    for (const chain of chains) {
      if (chain.kind === 'class' && chain.childDomain === childDomain) return chain
    }
  }

  // Strategy 2: shortest IRI-typed chain.
  for (const chain of chains) {
    if (chain.kind === 'iri') return chain
  }

  // Strategy 3: any class-typed chain (may resolve to a different child).
  return chains[0] ?? null
}

/**
 * Emit SPARQL triples for a cross-domain reference join driven by a
 * discovered {@link ReferenceChain}.
 *
 * Generates fresh intermediate variables for each step, binds the final
 * step's value to `boundVar`, and (for IRI-typed chains) adds a `?bound
 * a <childTargetClass>` constraint so the caller can filter to the
 * intended child asset domain.
 *
 * `idTag` disambiguates the intermediate variables when multiple
 * reference joins co-exist in the same query.
 */
export function emitReferenceChainTriples(
  chain: ReferenceChain,
  assetVar: string,
  boundVar: string,
  childTargetClass: string | null,
  registry: DomainRegistry,
  idTag: string,
  patterns: string[],
  prefixDomains: Set<string>,
  traceSteps?: TraceabilityStep[]
): void {
  let cursor = assetVar
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i]!
    const isLast = i === chain.steps.length - 1
    const next = isLast ? boundVar : `?_${idTag}_${i}`
    const desc = findDomainForIri(step.predicate, registry)
    const pred = desc ? prefixedPredicate(step.predicate, desc) : `<${step.predicate}>`
    if (desc) prefixDomains.add(desc.name)
    patterns.push(`${cursor} ${pred} ${next} .`)
    traceSteps?.push({ variable: next.slice(1), predicate: step.predicate })
    cursor = next
  }
  if (childTargetClass && chain.kind === 'iri') {
    patterns.push(`${boundVar} a ${childTargetClass} .`)
  }
}
