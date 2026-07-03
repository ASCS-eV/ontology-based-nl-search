/**
 * SHACL Validator — generic W3C SHACL Core constraint enforcement.
 *
 * Uses rdf-validate-shacl (Zazuko) — the canonical RDF/JS SHACL validator.
 * Implements every Core constraint component (sh:in, sh:pattern, sh:datatype,
 * sh:minLength, sh:maxLength, sh:minInclusive, sh:maxInclusive, sh:nodeKind,
 * sh:class, sh:hasValue, etc.) by reading the shapes graph — no domain-specific
 * code, no hardcoded constraint handlers.
 *
 * Architecture: at startup, parse the same Turtle files the schema loader
 * uses into an RDF/JS dataset (via N3 streaming parser). Construct one
 * SHACLValidator from that dataset and reuse it for every per-slot check.
 *
 * Per-slot validation pattern: synthesize a minimal candidate dataset of the
 * shape `_:b a <targetClass> ; <propertyIri> <value>` and call validate().
 * The returned ValidationReport carries structured violation details
 * (sh:resultMessage, sh:sourceConstraintComponent, sh:value) — we map those
 * to a generic ValidationResult type.
 *
 * @see https://www.w3.org/TR/shacl/
 * @see https://github.com/zazuko/rdf-validate-shacl
 */
import { LruCache } from '@ontology-search/core/cache/lru'
import { getConfig } from '@ontology-search/core/config'
import datasetFactory from '@rdfjs/dataset'
import SHACLValidator from 'rdf-validate-shacl'

import {
  buildBatchCandidateDataset,
  buildCandidateDataset,
  extractLocalName,
  makeCacheKey,
  toViolation,
} from './shacl-validator-candidates.js'
import {
  indexPropertyConstraints,
  indexPropertyTargetClasses,
  loadShapesFromDisk,
} from './shacl-validator-loader.js'
import type { ShaclValidationResult, ShaclViolation } from './shacl-validator-types.js'

// The pure, stateless halves of the validator (shapes loading + indexing, and
// candidate-dataset synthesis + violation mapping) were extracted to the sibling
// `-loader` / `-candidates` / `-types` modules (ADR 0003). What remains here is
// the ShaclValidator class itself — intentionally a single cohesive unit above
// the ~400-LOC guideline (CONTRIBUTING #15, justification clause): its methods
// share intimate instance state (the SHACL engine handle, the fast-path
// constraint index, the bounded LRU result cache, the engine-call counter, and
// the cached slot lookup), so decomposing it into free functions would mean
// threading four-plus mutable fields through every call — reducing cohesion
// rather than improving it. The stateless helpers, by contrast, extracted cleanly.

// Re-export the public result types (declared in `-types`) so consumers keep
// importing them from `@ontology-search/ontology/shacl-validator` unchanged.
export type { ShaclValidationResult, ShaclViolation } from './shacl-validator-types.js'

/** Singleton cached after the first fromWorkspace() call. */
let cachedInstance: ShaclValidator | null = null

/**
 * Generic SHACL validator that owns one immutable shapes dataset and exposes
 * candidate-triple validation for the slot pipeline.
 *
 * Construction is asynchronous because shape parsing reads the workspace
 * ontology artifacts from disk. The instance is intended to be created once
 * during warmup and cached for the lifetime of the process.
 */
export class ShaclValidator {
  private readonly validator: SHACLValidator
  /** Cached pairings of (property IRI → target class IRI) derived from shapes. */
  private readonly propertyToTargetClass: Map<string, string[]>
  /**
   * Fast-path constraint index: property IRI → indexed SHACL constraints.
   * When a value passes ALL pattern constraints AND (if sh:in exists) is a
   * member of the allowed list, we short-circuit without calling the engine.
   * Properties with only sh:datatype xsd:string (no further constraints)
   * trivially accept any string value — indexed as `datatypeOnly: true`.
   */
  readonly constraintIndex: Map<
    string,
    { patterns: RegExp[]; inValues: Set<string> | null; datatypeOnly: boolean }
  >
  /**
   * Memoized per-(propertyIri, value, targetClass) validation outcomes.
   * Shapes are immutable for the process lifetime, but the value space
   * is unbounded — a long-running server validating user-supplied filter
   * values would otherwise grow the cache without limit. The LRU bound
   * (`SHACL_CACHE_SIZE`, default 1024) caps memory while still capturing
   * hot lookup patterns. Populated by both single-value and batch paths.
   */
  private readonly resultCache: LruCache<string, ShaclValidationResult> = new LruCache({
    maxSize: getConfig().SHACL_CACHE_SIZE,
  })
  /**
   * @internal Counter of underlying engine `validate()` invocations. Exists
   * so tests can assert the batch path makes exactly one engine call per
   * (property, target-class) and the cache prevents repeats. Increments
   * once per dataset submitted to the engine — agnostic of focus-node count.
   */
  private engineCallCount = 0

  private constructor(
    validator: SHACLValidator,
    propertyToTargetClass: Map<string, string[]>,
    constraintIndex: Map<
      string,
      { patterns: RegExp[]; inValues: Set<string> | null; datatypeOnly: boolean }
    >
  ) {
    this.validator = validator
    this.propertyToTargetClass = propertyToTargetClass
    this.constraintIndex = constraintIndex
  }

  /** @internal Test-only accessor — see engineCallCount JSDoc. */
  get __engineCallCount__(): number {
    return this.engineCallCount
  }

  /** @internal Test-only reset for engine-call counter (separate from cache reset). */
  __resetEngineCallCount__(): void {
    this.engineCallCount = 0
  }

  /** @internal Test-only accessor exposing the LRU cache's current size. */
  get __resultCacheSize__(): number {
    return this.resultCache.size
  }

  /** @internal Test-only accessor exposing the LRU cache's hard capacity. */
  get __resultCacheCapacity__(): number {
    return this.resultCache.capacity
  }

  /**
   * Build a validator from the workspace ontology Turtle files.
   * Discovers the same artefact tree the schema loader uses.
   */
  static async fromWorkspace(): Promise<ShaclValidator> {
    if (cachedInstance) return cachedInstance
    const shapesDataset = loadShapesFromDisk()
    const propertyToTargetClass = indexPropertyTargetClasses(shapesDataset)
    const constraintIndex = indexPropertyConstraints(shapesDataset)
    // The Turtle loader already pulls every workspace shape file into one
    // dataset, so owl:imports references are already satisfied. We provide
    // an empty resolver to suppress the engine's mandatory import-fetch hook.
    const validator = new SHACLValidator(shapesDataset, {
      importGraph: () => datasetFactory.dataset(),
    })
    cachedInstance = new ShaclValidator(validator, propertyToTargetClass, constraintIndex)
    return cachedInstance
  }

  /**
   * Reset the cached singleton — test-only hook. Drops the entire instance
   * including its result cache and engine-call counter. Subsequent
   * `fromWorkspace()` will rebuild from disk.
   */
  static reset(): void {
    cachedInstance = null
  }

  /**
   * Validate a single property value against the SHACL shapes that apply to
   * its declared target class.
   *
   * The candidate dataset is `_:b a <targetClass> ; <propertyIri> <value>`.
   * Pass an explicit `targetClass` when the property is defined on multiple
   * shapes and you know which one to validate against; otherwise the validator
   * tries every known target class for the property.
   */
  async validateValue(
    propertyIri: string,
    value: string | number | boolean,
    targetClass?: string
  ): Promise<ShaclValidationResult> {
    const cacheKey = makeCacheKey(propertyIri, value, targetClass)
    const cached = this.resultCache.get(cacheKey)
    if (cached) return cached

    const candidates = targetClass
      ? [targetClass]
      : (this.propertyToTargetClass.get(propertyIri) ?? [])

    // If the property has no known shape target, there's nothing to validate.
    // This is informational (not a failure) — caller decides whether unknown
    // properties should fall back to looser handling.
    if (candidates.length === 0) {
      const empty: ShaclValidationResult = { conforms: true, violations: [] }
      this.resultCache.set(cacheKey, empty)
      return empty
    }

    // ── Fast path: check indexed constraints locally (no engine call) ──
    // If the property has sh:pattern and/or sh:in constraints indexed at
    // startup, validate them in-process. This avoids the ~3s engine call
    // for simple pattern matches like country codes.
    const constraint = this.constraintIndex.get(propertyIri)
    if (constraint && typeof value === 'string') {
      const fastResult = this.validateAgainstConstraintIndex(propertyIri, value, constraint)
      if (fastResult) {
        this.resultCache.set(cacheKey, fastResult)
        return fastResult
      }
    }

    const allViolations: ShaclViolation[] = []
    let anyConforms = false

    // SHACL is satisfied if *any* targeted shape conforms for the property path.
    // We try each candidate target class in turn. Because the candidate dataset
    // intentionally contains only the one property we want to validate, the
    // engine will report cardinality violations on *other* property shapes of
    // the same node shape (e.g. a sibling `boundingBox` with sh:minCount 1).
    // Those are spurious for our use case — we filter to only violations whose
    // sh:resultPath matches the property under test.
    for (const cls of candidates) {
      const candidate = buildCandidateDataset(propertyIri, value, cls)
      this.engineCallCount++
      const report = await this.validator.validate(candidate)
      const relevant = report.results
        .map((r) => toViolation(r))
        .filter((v) => v.path === propertyIri)

      if (relevant.length === 0) {
        anyConforms = true
        break
      }

      allViolations.push(...relevant)
    }

    const result: ShaclValidationResult = anyConforms
      ? { conforms: true, violations: [] }
      : { conforms: false, violations: allViolations }
    this.resultCache.set(cacheKey, result)
    return result
  }

  /**
   * In-process constraint check using pre-indexed sh:pattern and sh:in.
   *
   * CORRECTNESS INVARIANT: The same property IRI may appear on multiple
   * shapes with different constraints. We merge all constraints into a
   * single entry (union of patterns, union of sh:in values). This means:
   *
   * - If the value satisfies ALL indexed constraints → conforms (safe
   *   positive short-circuit — the value is valid under every shape).
   * - If the value fails ANY constraint → we CANNOT conclude non-conformance
   *   because a different shape may accept it. Fall through to the engine.
   *
   * This conservative approach is ontology-agnostic: it never produces false
   * negatives, only true positives. The engine remains the authority for
   * rejection.
   */
  private validateAgainstConstraintIndex(
    _propertyIri: string,
    value: string,
    constraint: {
      patterns: RegExp[]
      inValues: Set<string> | null
      datatypeOnly: boolean
    }
  ): ShaclValidationResult | null {
    // Datatype-only properties (e.g. sh:datatype xsd:string with no further
    // value constraints) trivially accept any string value.
    if (constraint.datatypeOnly) {
      return { conforms: true, violations: [] }
    }

    // If there are patterns, ALL must pass for the positive short-circuit.
    for (const pattern of constraint.patterns) {
      if (!pattern.test(value)) {
        // Cannot confirm conformance — fall through to engine.
        return null
      }
    }

    // If there is an sh:in list, value must be present for positive path.
    if (constraint.inValues !== null) {
      if (!constraint.inValues.has(value)) {
        // Cannot confirm conformance — fall through to engine.
        return null
      }
    }

    // All indexed constraints pass → value is definitively valid.
    if (constraint.patterns.length > 0 || constraint.inValues !== null) {
      return { conforms: true, violations: [] }
    }

    // No indexed constraints — fall back to engine.
    return null
  }

  /**
   * Batch-validate many candidate values for one property in a single SHACL
   * engine call. Generic — used for any array-valued slot.
   *
   * The performance win: rdf-validate-shacl's `validate()` walks the entire
   * shapes graph each call. A 27-element array under sequential validation
   * pays that cost 27 times (~80s on a large ontology). Batching pays
   * it once (~3s).
   *
   * Semantics match `validateValue`: a value conforms iff it conforms under
   * at least one target class. Already-cached values are returned directly
   * and excluded from the SHACL call.
   *
   * @returns Map keyed by the stringified value.
   */
  async validateValues(
    propertyIri: string,
    values: ReadonlyArray<string | number | boolean>,
    targetClass?: string
  ): Promise<Map<string, ShaclValidationResult>> {
    const out = new Map<string, ShaclValidationResult>()
    // De-dup early so identical entries never hit the engine twice.
    const uniq = [...new Set(values.map(String))]

    // Cache lookup.
    const stillNeeded: string[] = []
    for (const v of uniq) {
      const cacheKey = makeCacheKey(propertyIri, v, targetClass)
      const cached = this.resultCache.get(cacheKey)
      if (cached) out.set(v, cached)
      else stillNeeded.push(v)
    }
    if (stillNeeded.length === 0) return out

    // ── Fast path: check indexed constraints locally (batch) ──
    // Same correctness invariant as single-value path: only short-circuit
    // the positive case. Values that fail the index fall through to engine.
    const constraint = this.constraintIndex.get(propertyIri)
    const engineNeeded: string[] = []
    if (constraint) {
      for (const v of stillNeeded) {
        if (typeof v === 'string') {
          const fastResult = this.validateAgainstConstraintIndex(propertyIri, v, constraint)
          if (fastResult) {
            out.set(v, fastResult)
            this.resultCache.set(makeCacheKey(propertyIri, v, targetClass), fastResult)
            continue
          }
        }
        engineNeeded.push(v)
      }
    } else {
      engineNeeded.push(...stillNeeded)
    }
    if (engineNeeded.length === 0) return out

    const candidates = targetClass
      ? [targetClass]
      : (this.propertyToTargetClass.get(propertyIri) ?? [])

    // No shape applies — every engine-needed value passes vacuously.
    if (candidates.length === 0) {
      for (const v of engineNeeded) {
        const ok: ShaclValidationResult = { conforms: true, violations: [] }
        out.set(v, ok)
        this.resultCache.set(makeCacheKey(propertyIri, v, targetClass), ok)
      }
      return out
    }

    // Per-target-class iteration: a value conforms iff it conforms under at
    // least one. We collect accumulated violations as we cross-check classes.
    const accumulatedViolations = new Map<string, ShaclViolation[]>()
    const conformed = new Set<string>()

    for (const cls of candidates) {
      const unresolved = engineNeeded.filter((v) => !conformed.has(v))
      if (unresolved.length === 0) break

      const { dataset, valueToFocusIri } = buildBatchCandidateDataset(propertyIri, unresolved, cls)
      this.engineCallCount++
      const report = await this.validator.validate(dataset)

      // Partition violations by focus node IRI, filtering to the path of
      // interest (sibling shapes on the node shape are noise here).
      const violationsByFocus = new Map<string, ShaclViolation[]>()
      for (const r of report.results) {
        const v = toViolation(r)
        if (v.path !== propertyIri) continue
        const focusIri = r.focusNode?.value
        if (!focusIri) continue
        const bucket = violationsByFocus.get(focusIri) ?? []
        bucket.push(v)
        violationsByFocus.set(focusIri, bucket)
      }

      for (const value of unresolved) {
        const focusIri = valueToFocusIri.get(value)
        if (!focusIri) continue
        const vs = violationsByFocus.get(focusIri)
        if (!vs || vs.length === 0) {
          conformed.add(value)
        } else {
          const prev = accumulatedViolations.get(value) ?? []
          accumulatedViolations.set(value, [...prev, ...vs])
        }
      }
    }

    // Finalize: write outcomes to both the result map and the cache.
    for (const value of engineNeeded) {
      const result: ShaclValidationResult = conformed.has(value)
        ? { conforms: true, violations: [] }
        : { conforms: false, violations: accumulatedViolations.get(value) ?? [] }
      out.set(value, result)
      this.resultCache.set(makeCacheKey(propertyIri, value, targetClass), result)
    }
    return out
  }

  /** Property IRIs covered by at least one SHACL property shape. */
  knownProperties(): string[] {
    return [...this.propertyToTargetClass.keys()]
  }

  /**
   * Whether `slotKey` (a property *local name*) matches at least one SHACL
   * property shape in the loaded ontology. Used by the slot validator to
   * drop filter keys the LLM invented (e.g. `numberLanes` when the ontology
   * has no such property) before they reach the SPARQL compiler.
   */
  isKnownSlotKey(slotKey: string): boolean {
    return this.resolveSlotIris(slotKey).length > 0
  }

  /**
   * Resolve a slot key (the local name used in SearchSlots, e.g. a leaf local
   * name) to the full property IRI(s) declared in the shapes graph.
   *
   * Returns every IRI whose local name matches — properties can appear in
   * multiple domains (the same local name in more than one domain). Callers can
   * pick by domain or validate against every match.
   */
  resolveSlotIris(slotKey: string): string[] {
    const lookup = this.cachedSlotLookup ?? this.buildSlotLookup()
    return lookup.get(slotKey) ?? []
  }

  private cachedSlotLookup: Map<string, string[]> | null = null

  private buildSlotLookup(): Map<string, string[]> {
    const lookup = new Map<string, string[]>()
    for (const iri of this.propertyToTargetClass.keys()) {
      const localName = extractLocalName(iri)
      const existing = lookup.get(localName) ?? []
      existing.push(iri)
      lookup.set(localName, existing)
    }
    this.cachedSlotLookup = lookup
    return lookup
  }

  /**
   * Validate a slot by its local name. Iterates all candidate property IRIs
   * (handles the multi-domain case). Returns conforms=true only if *every*
   * matching property accepts the value — if a value is valid in one domain
   * but invalid in another we surface the violations and let the caller
   * decide. For the slot pipeline, validation is per-property so the typical
   * case is exactly one match.
   */
  async validateBySlotName(
    slotKey: string,
    value: string | number | boolean
  ): Promise<ShaclValidationResult & { resolvedIris: string[] }> {
    const iris = this.resolveSlotIris(slotKey)
    if (iris.length === 0) return { conforms: true, violations: [], resolvedIris: [] }

    // Validate all resolved IRIs in parallel — each is independent and the
    // engine calls dominate wall-clock time (~3s each on a large graph).
    const results = await Promise.all(iris.map((iri) => this.validateValue(iri, value)))

    const allViolations: ShaclViolation[] = []
    let allConform = true
    for (const result of results) {
      if (!result.conforms) {
        allConform = false
        allViolations.push(...result.violations)
      }
    }
    return { conforms: allConform, violations: allViolations, resolvedIris: iris }
  }

  /**
   * Batch counterpart of `validateBySlotName`. Validates an array of values
   * against every property IRI that the slot key resolves to, in a single
   * SHACL pass per IRI. Returns one entry per input value.
   *
   * Semantics: a value conforms iff it conforms under every resolved IRI
   * (same rule as the single-value method, applied element-wise).
   */
  async validateBySlotNameBatch(
    slotKey: string,
    values: ReadonlyArray<string | number | boolean>
  ): Promise<Map<string, ShaclValidationResult & { resolvedIris: string[] }>> {
    const iris = this.resolveSlotIris(slotKey)
    const out = new Map<string, ShaclValidationResult & { resolvedIris: string[] }>()

    if (iris.length === 0) {
      for (const v of values) {
        out.set(String(v), { conforms: true, violations: [], resolvedIris: [] })
      }
      return out
    }

    // One batch validation per IRI; intersect outcomes per value.
    const perIri = await Promise.all(iris.map((iri) => this.validateValues(iri, values)))

    for (const v of values) {
      const key = String(v)
      let conforms = true
      const violations: ShaclViolation[] = []
      for (const m of perIri) {
        const r = m.get(key)
        if (!r) continue
        if (!r.conforms) {
          conforms = false
          violations.push(...r.violations)
        }
      }
      out.set(key, { conforms, violations, resolvedIris: iris })
    }
    return out
  }
}

/** Extract local name from an IRI (after last / or #). */
