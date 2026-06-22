/**
 * Cross-reference JOIN emission.
 *
 * Extracted from `compiler.ts` (ADR 0003 step 22c) to bring the compile core
 * under the file-size budget. Holds the two reference-JOIN emitters that the
 * core orchestration drives:
 *
 *   - `emitReferencedDomainJoins` — implicit cross-domain joins inferred from
 *     multi-domain filter/range partitions (a constraint on a referenced
 *     domain).
 *   - `emitReferenceNode` — the explicit `slots.references` slot, recursing into
 *     nested reference chains.
 *
 * Both mutate the same accumulators (patterns/filters/optionals/selectVars/
 * prefixDomains, plus traces/droppedReferences) via a shared
 * {@link ReferenceEmitContext}, exactly as the original in-`compileSlotsWithTrace`
 * closures did — so this is a behavior-preserving move guarded by the
 * determinism snapshots + no-drift suite. One-way dep (compiler → reference-emit
 * → domain-patterns/helpers); nothing here imports the compile core.
 *
 * @see https://www.w3.org/TR/sparql11-query/ — [SPARQL11] §5 (BGP)
 */
import { createComponentLogger } from '@ontology-search/core/logging'
import { type DomainRegistry } from '@ontology-search/ontology/domain-registry'
import { escapeSparqlLiteral } from '@ontology-search/sparql/escape'

import { buildDomainPatterns } from './compiler-domain-patterns.js'
import {
  emitDataReferencePath,
  emitReferenceChainTriples,
  pickDataReferenceEdge,
  pickReferenceChain,
  pickSiblingDataEdge,
} from './compiler-helpers.js'
import { type CompilerVocab } from './compiler-vocab.js'
import { getReferenceIndex } from './reference-index.js'
import type { ReferenceFilter, TraceabilityPlan, TraceabilityStep } from './slots.js'

const log = createComponentLogger('compiler')

/**
 * Mutable compile state shared by the reference emitters. The arrays/sets are
 * the same references the core compile holds, mutated in place; `hasReferenceJoin`
 * is read back by the caller after emission to decide the distinct-asset LIMIT
 * wrap.
 */
export interface ReferenceEmitContext {
  registry: DomainRegistry
  vocabIndex: CompilerVocab
  patterns: string[]
  filters: string[]
  optionals: string[]
  selectVars: Set<string>
  prefixDomains: Set<string>
  traces: TraceabilityPlan[]
  droppedReferences: string[]
  hasReferenceJoin: boolean
}

/**
 * Emit implicit cross-domain JOINs for every referenced (non-primary) domain
 * that carries its own filters/ranges. Skips constraint-free referenced domains
 * and domains with no SHACL-declared reference chain (logged).
 */
export function emitReferencedDomainJoins(
  detectedDomains: string[],
  primaryDomain: string,
  filtersByDomain: Record<string, Record<string, string | string[]>>,
  rangesByDomain: Record<string, Record<string, { min?: number; max?: number }>>,
  ctx: ReferenceEmitContext
): void {
  const { registry, vocabIndex, patterns, filters, optionals, selectVars, prefixDomains } = ctx
  // Build cross-domain joins for referenced domains. Only include
  // domains that have actual filters or ranges — domains selected by
  // the LLM but without constraints are skipped to avoid mandatory
  // JOINs that would eliminate results. (Location and other geographic
  // fields flow through `slots.filters` and partition naturally to
  // whichever domain owns the matching property path — there is no
  // special-case delegation to a referenced domain.)
  const allReferencedDomains = new Set([
    ...Object.keys(filtersByDomain).filter((d) => d !== primaryDomain),
    ...Object.keys(rangesByDomain).filter((d) => d !== primaryDomain),
    ...detectedDomains.filter((d) => d !== primaryDomain),
  ])

  for (const refDomainName of allReferencedDomains) {
    const refDomain = registry.domains.get(refDomainName)
    if (!refDomain) continue

    const refFilters = filtersByDomain[refDomainName] || {}
    const refRanges = rangesByDomain[refDomainName] || {}

    // Skip referenced domains that have no filters or ranges —
    // they add only mandatory JOIN constraints with no value.
    const hasRefConstraints =
      Object.keys(refFilters).length > 0 || Object.keys(refRanges).length > 0
    if (!hasRefConstraints) continue

    // Join via the discovered cross-reference chain. No meta-model
    // predicates are baked in here — the chain
    // comes from `vocabIndex.referenceChains` populated by
    // `buildReferenceChains` from SHACL leaf properties whose binding
    // shape allows an IRI value (`sh:nodeKind sh:IRI` or `sh:class`).
    // When no chain is declared in the schema we skip the join with a
    // logger warning rather than inventing a literal predicate path.
    const refVar = `?ref_${refDomainName.replace(/-/g, '_')}`
    const refSpecVar = `?refSpec_${refDomainName.replace(/-/g, '_')}`

    const chain = pickReferenceChain(vocabIndex, primaryDomain, refDomainName)
    if (!chain) {
      log.warn(
        'No cross-reference chain declared in SHACL for parent → child; skipping referenced domain',
        { parent: primaryDomain, child: refDomainName }
      )
      continue
    }
    emitReferenceChainTriples(
      chain,
      '?asset',
      refVar,
      refDomain.targetClass,
      registry,
      `m_${refDomainName.replace(/-/g, '_')}`,
      patterns,
      prefixDomains
    )

    const refForeign = buildDomainPatterns(
      refDomainName,
      refDomain,
      refFilters,
      refRanges,
      patterns,
      filters,
      optionals,
      selectVars,
      vocabIndex,
      registry,
      refVar,
      refSpecVar
    )
    for (const fd of refForeign) prefixDomains.add(fd)
    ctx.hasReferenceJoin = true
  }
}

/**
 * Emit one explicit reference node and recurse into its nested references.
 * `parentVar`/`parentDomain` anchor the JOIN; `varBase` is the projected
 * variable name (no `?`). See the original doc in `compileSlotsWithTrace`.
 */
export async function emitReferenceNode(
  ref: ReferenceFilter,
  parentVar: string,
  parentDomain: string,
  varBase: string,
  ctx: ReferenceEmitContext
): Promise<void> {
  const {
    registry,
    vocabIndex,
    patterns,
    filters,
    optionals,
    selectVars,
    prefixDomains,
    traces,
    droppedReferences,
  } = ctx
  const refDomain = registry.domains.get(ref.domain)
  if (!refDomain) return

  const refVar = `?${varBase}`
  const refNameVar = `?${varBase.replace('refAsset', 'refName')}`
  const tag = varBase.replace('refAsset', 'refSlot') // chain intermediate id-tag
  const dataPrefix = varBase.replace('refAsset', 'ref') // data-path step prefix
  const traceSteps: TraceabilityStep[] = []

  const chain = pickReferenceChain(vocabIndex, parentDomain, ref.domain)
  if (chain) {
    emitReferenceChainTriples(
      chain,
      parentVar,
      refVar,
      refDomain.targetClass,
      registry,
      tag,
      patterns,
      prefixDomains,
      traceSteps
    )
  } else {
    // Load the data-driven reference index lazily: only queries with a
    // references slot AND no SHACL chain consult it (cached / pre-warmed).
    const referenceIndex = await getReferenceIndex()
    const dataPath = pickDataReferenceEdge(referenceIndex, parentDomain, ref.domain)
    if (dataPath) {
      emitDataReferencePath(
        dataPath,
        parentVar,
        refVar,
        patterns,
        registry,
        prefixDomains,
        traceSteps,
        dataPrefix
      )
      patterns.push(`${refVar} a ${refDomain.targetClass} .`)
      log.info('slots.references: emitting JOIN from data-driven reference index', {
        parent: parentDomain,
        child: ref.domain,
        hops: dataPath.predicatePath.length,
        samples: dataPath.sampleCount,
      })
    } else {
      // No exact match in the data index. Fall back to a sibling edge
      // from the same parent — the manifest IRI endpoint is generic and
      // can reach any asset type via the same predicate path.
      const siblingPath = pickSiblingDataEdge(referenceIndex, parentDomain)
      if (siblingPath) {
        emitDataReferencePath(
          siblingPath,
          parentVar,
          refVar,
          patterns,
          registry,
          prefixDomains,
          traceSteps,
          dataPrefix
        )
        patterns.push(`${refVar} a ${refDomain.targetClass} .`)
        log.info('slots.references: emitting JOIN from sibling data edge (no exact match)', {
          parent: parentDomain,
          child: ref.domain,
          siblingTarget: siblingPath.targetDomain,
          hops: siblingPath.predicatePath.length,
        })
      } else {
        // No path discoverable from SHACL, data, or siblings. Skip this
        // reference — emitting a wildcard property-path is too expensive
        // and semantically incorrect (no evidence the link exists).
        log.warn(
          'slots.references: no SHACL chain, data path, or sibling edge; skipping reference',
          { parent: parentDomain, child: ref.domain }
        )
        droppedReferences.push(ref.domain)
        return
      }
    }
  }

  // Chain resolution succeeded — mark this reference as emitted.
  prefixDomains.add(ref.domain)
  ctx.hasReferenceJoin = true

  // Bind a label for every reference so each referenced asset can be
  // displayed (and so a label filter can apply to any of them).
  patterns.push(`${refVar} rdfs:label ${refNameVar} .`)
  if (ref.label) {
    filters.push(
      `FILTER(CONTAINS(LCASE(${refNameVar}), "${escapeSparqlLiteral(ref.label.toLowerCase())}"))`
    )
  }

  // Project this reference's asset + name so the UI shows it.
  selectVars.add(refVar)
  selectVars.add(refNameVar)

  // Reference-scoped constraints: `filters`/`ranges` that describe the
  // REFERENCED asset (e.g. "maps in Germany with >= 1 intersection") are
  // applied to THIS reference's variable, so they constrain the referenced
  // asset — not the primary one. Without this, such constraints partition to
  // the top level and bind to the wrong domain (the cross-domain anchoring
  // bug). Reuses the same SHACL-path machinery as the primary domain; the
  // chain emission above already bound `${refVar} a <targetClass>`.
  const refOwnFilters = ref.filters ?? {}
  const refOwnRanges = ref.ranges ?? {}
  if (Object.keys(refOwnFilters).length > 0 || Object.keys(refOwnRanges).length > 0) {
    const refForeign = buildDomainPatterns(
      ref.domain,
      refDomain,
      refOwnFilters,
      refOwnRanges,
      patterns,
      filters,
      optionals,
      selectVars,
      vocabIndex,
      registry,
      refVar,
      `${refVar}_spec`
    )
    for (const fd of refForeign) prefixDomains.add(fd)
  }

  // A resolved chain contributes a breadcrumb: promote its intermediate step
  // variables so the service can read them per row, and record a plan keyed
  // by this node's var, rooted at its parent. The wildcard branch records no
  // steps, so it adds no plan.
  if (traceSteps.length > 0) {
    for (const step of traceSteps) selectVars.add(`?${step.variable}`)
    traces.push({
      sourceVariable: parentVar.slice(1),
      targetVariable: varBase,
      steps: traceSteps,
    })
  }

  // Recurse: nested references hang off this node (parent → child chain).
  const nested = ref.references ?? []
  for (let j = 0; j < nested.length; j++) {
    await emitReferenceNode(nested[j]!, refVar, ref.domain, `${varBase}_${j}`, ctx)
  }
}
