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
import { readFileSync } from 'node:fs'

import { LruCache } from '@ontology-search/core/cache/lru'
import { getConfig } from '@ontology-search/core/config'
import { createComponentLogger } from '@ontology-search/core/logging'
import { iri, RDF_PREFIXES } from '@ontology-search/core/rdf/prefixes'
import datasetFactory from '@rdfjs/dataset'
import type { DatasetCore, NamedNode, Quad, Term } from '@rdfjs/types'
import { DataFactory, Parser } from 'n3'
import SHACLValidator from 'rdf-validate-shacl'

import { discoverShapeFiles } from './sources.js'

const log = createComponentLogger('shacl-validator')

const { namedNode, blankNode, literal, quad } = DataFactory

/** SHACL constraint component IRIs we surface in violation messages. */
const SH_NS = RDF_PREFIXES.sh

/** Result of validating a candidate value. */
export interface ShaclValidationResult {
  conforms: boolean
  /** Structured violations (empty when conforms === true). */
  violations: ShaclViolation[]
}

/** A single SHACL constraint violation. */
export interface ShaclViolation {
  /** Human-readable message (from sh:resultMessage or the constraint component). */
  message: string
  /** Constraint component IRI that triggered the violation (e.g. sh:PatternConstraintComponent). */
  sourceConstraintComponent: string
  /** Property path being validated (full IRI, when applicable). */
  path?: string
  /** Offending value, as a string. */
  value?: string
}

/**
 * Generic SHACL validator that owns one immutable shapes dataset and exposes
 * candidate-triple validation for the slot pipeline.
 *
 * Construction is asynchronous because shape parsing reads the workspace
 * ontology artifacts from disk. The instance is intended to be created once
 * during warmup and cached for the lifetime of the process.
 */
/** Singleton cached after the first fromWorkspace() call. */
let cachedInstance: ShaclValidator | null = null

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
   * pays that cost 27 times (~80s on the ENVITED-X ontology). Batching pays
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
   * Resolve a slot key (the local name used in SearchSlots, e.g. "country" or
   * "roadTypes") to the full property IRI(s) declared in the shapes graph.
   *
   * Returns every IRI whose local name matches — properties can appear in
   * multiple domains (e.g. roadTypes in hdmap and ositrace). Callers can pick
   * by domain or validate against every match.
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
    // engine calls dominate wall-clock time (~3s each on the ENVITED-X graph).
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
function extractLocalName(iri: string): string {
  const hashIdx = iri.lastIndexOf('#')
  const slashIdx = iri.lastIndexOf('/')
  const idx = Math.max(hashIdx, slashIdx)
  return idx >= 0 ? iri.substring(idx + 1) : iri
}

// ─── Internal: parse Turtle into RDF/JS dataset ──────────────────────────────

/**
 * Discover all *.shacl.ttl and *.owl.ttl files from the workspace ontology
 * sources and parse them into a single in-memory dataset.
 *
 * Mirrors the discovery logic in @ontology-search/search/schema-loader so the
 * SHACL validator sees the same axioms as the SPARQL store.
 */
function loadShapesFromDisk(): DatasetCore {
  const ds = datasetFactory.dataset()
  const parser = new Parser()

  for (const { path: filePath } of discoverShapeFiles({ includeOwl: true })) {
    const turtle = readFileSync(filePath, 'utf-8')
    try {
      const quads = parser.parse(turtle)
      for (const q of quads) ds.add(q as unknown as Quad)
    } catch (err) {
      log.warn('Failed to parse SHACL file', { file: filePath, error: String(err) })
    }
  }

  // Strip SHACL-Advanced constraints rdf-validate-shacl (Zazuko, Core
  // only) can't evaluate. When the engine encounters one of these on a
  // shape we ARE validating against, it throws
  // `Cannot find validator for constraint component <iri>` and aborts
  // the entire validation — taking out every slot under that target
  // class. Removing the triple severs the shape→constraint link; the
  // rest of the Core constraints on the same shape (sh:pattern, sh:in,
  // sh:datatype, …) continue to validate normally.
  //
  // Trade-off: any data-quality rule expressed as `sh:sparql` becomes a
  // no-op for the slot-validation gate. The compiler / store still
  // enforce structural correctness; only the bespoke SPARQL-encoded
  // check is dropped. A single info-level log line records the strip so
  // the operator can verify which shapes are affected.
  stripUnsupportedConstraints(ds)
  return ds
}

/**
 * Predicates whose object encodes a SHACL constraint that
 * `rdf-validate-shacl` 0.6 doesn't implement. Each triple gets removed
 * from the working dataset; the constraint node graphs become
 * orphaned, which the validator ignores.
 */
const UNSUPPORTED_CONSTRAINT_PREDICATES: readonly string[] = [
  `${SH_NS}sparql`,
  // SHACL-Advanced node-expression / rule predicates that show up in
  // some published ontologies and trigger the same constraint-lookup
  // error path. Kept conservative — extend when the validator throws
  // on a different predicate.
  `${SH_NS}rule`,
  `${SH_NS}values`,
]

function stripUnsupportedConstraints(ds: DatasetCore): void {
  const toRemove: Quad[] = []
  for (const unsupported of UNSUPPORTED_CONSTRAINT_PREDICATES) {
    const pred = namedNode(unsupported)
    for (const q of ds.match(null, pred, null, null)) toRemove.push(q as Quad)
  }
  if (toRemove.length === 0) return
  for (const q of toRemove) ds.delete(q)
  const breakdown = new Map<string, number>()
  for (const q of toRemove) {
    const key = q.predicate.value
    breakdown.set(key, (breakdown.get(key) ?? 0) + 1)
  }
  log.info(
    'Stripped SHACL-Advanced constraints rdf-validate-shacl cannot evaluate; affected shapes pass Core-only validation downstream',
    { breakdown: Object.fromEntries(breakdown) }
  )
}

// ─── Internal: property → target class index ─────────────────────────────────

/**
 * Build an index of property IRI → target class IRI(s) by inspecting every
 * sh:NodeShape with a sh:targetClass and walking its sh:property paths.
 *
 * SHACL allows the same property to appear on multiple shapes; we keep all
 * target classes so the validator can iterate them.
 */
function indexPropertyTargetClasses(shapes: DatasetCore): Map<string, string[]> {
  const SH_PROPERTY = `${SH_NS}property`
  const SH_PATH = `${SH_NS}path`
  const SH_TARGET_CLASS = `${SH_NS}targetClass`

  // Step 1: shape → targetClass
  const shapeTargets = new Map<string, string[]>()
  for (const q of shapes.match(null, namedNode(SH_TARGET_CLASS), null, null)) {
    if (q.object.termType !== 'NamedNode') continue
    const subjectKey = termKey(q.subject)
    const existing = shapeTargets.get(subjectKey) ?? []
    existing.push(q.object.value)
    shapeTargets.set(subjectKey, existing)
  }

  // Step 2: shape → property-shape(s) → path
  const index = new Map<string, Set<string>>()
  for (const propLink of shapes.match(null, namedNode(SH_PROPERTY), null, null)) {
    const targets = shapeTargets.get(termKey(propLink.subject))
    if (!targets || targets.length === 0) continue

    for (const pathQ of shapes.match(propLink.object as Term, namedNode(SH_PATH), null, null)) {
      // We only handle the simple-path case (predicate IRI) — sequence/inverse
      // paths are out of scope for slot validation.
      if (pathQ.object.termType !== 'NamedNode') continue
      const propIri = pathQ.object.value
      const set = index.get(propIri) ?? new Set<string>()
      for (const t of targets) set.add(t)
      index.set(propIri, set)
    }
  }

  // Convert to plain arrays for stable iteration.
  const out = new Map<string, string[]>()
  for (const [k, v] of index) out.set(k, [...v])
  return out
}

function termKey(t: Term): string {
  return `${t.termType}:${t.value}`
}

/**
 * Build a fast-path constraint index: property IRI → { patterns, inValues, datatypeOnly }.
 *
 * Extracts sh:pattern, sh:in, and sh:datatype from every property shape in
 * the graph. For property shapes that have ONLY sh:datatype (no sh:pattern,
 * no sh:in, no sh:minLength, no sh:maxLength, no sh:hasValue, no sh:class,
 * no sh:nodeKind) the constraint is trivial: any value of the right type
 * will pass. We mark these as `datatypeOnly: true` so the fast path can
 * short-circuit immediately.
 *
 * This is fully generic — reads only standard SHACL vocabulary, works with
 * any shapes graph.
 */
function indexPropertyConstraints(
  shapes: DatasetCore
): Map<string, { patterns: RegExp[]; inValues: Set<string> | null; datatypeOnly: boolean }> {
  const SH_PROPERTY = `${SH_NS}property`
  const SH_PATH = `${SH_NS}path`
  const SH_PATTERN = `${SH_NS}pattern`
  const SH_IN = `${SH_NS}in`
  const SH_DATATYPE = `${SH_NS}datatype`
  const RDF_FIRST = iri('rdf', 'first')
  const RDF_REST = iri('rdf', 'rest')
  const RDF_NIL = iri('rdf', 'nil')

  // Value-constraining SHACL components that, if present, mean datatype alone
  // is NOT sufficient for validation — the engine must run.
  const VALUE_CONSTRAINT_PREDS = [
    `${SH_NS}minLength`,
    `${SH_NS}maxLength`,
    `${SH_NS}minInclusive`,
    `${SH_NS}maxInclusive`,
    `${SH_NS}minExclusive`,
    `${SH_NS}maxExclusive`,
    `${SH_NS}hasValue`,
    `${SH_NS}class`,
    `${SH_NS}nodeKind`,
    `${SH_NS}languageIn`,
    `${SH_NS}uniqueLang`,
    `${SH_NS}node`,
    `${SH_NS}qualifiedValueShape`,
  ]

  const index = new Map<
    string,
    { patterns: RegExp[]; inValues: Set<string> | null; datatypeOnly: boolean }
  >()

  // Walk all property shapes
  for (const propLink of shapes.match(null, namedNode(SH_PROPERTY), null, null)) {
    const propShape = propLink.object as Term

    // Get path (property IRI)
    let propIri: string | null = null
    for (const pathQ of shapes.match(propShape, namedNode(SH_PATH), null, null)) {
      if (pathQ.object.termType === 'NamedNode') {
        propIri = pathQ.object.value
        break
      }
    }
    if (!propIri) continue

    const entry = index.get(propIri) ?? {
      patterns: [],
      inValues: null,
      datatypeOnly: false,
    }

    // Check if this shape has sh:datatype
    let hasDatatype = false
    for (const dtQ of shapes.match(propShape, namedNode(SH_DATATYPE), null, null)) {
      if (dtQ.object.termType === 'NamedNode') hasDatatype = true
    }

    // Extract sh:pattern (deduplicate by source string)
    let hasPattern = false
    for (const patQ of shapes.match(propShape, namedNode(SH_PATTERN), null, null)) {
      if (patQ.object.termType === 'Literal') {
        hasPattern = true
        try {
          const source = patQ.object.value
          // SHACL patterns are anchored (must match entire string)
          if (!entry.patterns.some((r) => r.source === `^${source}$`)) {
            entry.patterns.push(new RegExp(`^${source}$`))
          }
        } catch {
          // Invalid regex — skip
        }
      }
    }

    // Extract sh:in (RDF list)
    let hasIn = false
    for (const inQ of shapes.match(propShape, namedNode(SH_IN), null, null)) {
      hasIn = true
      const values = new Set<string>()
      let node: Term = inQ.object as Term
      while (node.value !== RDF_NIL) {
        for (const firstQ of shapes.match(node as NamedNode, namedNode(RDF_FIRST), null, null)) {
          if (firstQ.object.termType === 'Literal') {
            values.add(firstQ.object.value)
          } else if (firstQ.object.termType === 'NamedNode') {
            values.add(firstQ.object.value)
          }
        }
        let next: Term | null = null
        for (const restQ of shapes.match(node as NamedNode, namedNode(RDF_REST), null, null)) {
          next = restQ.object as Term
        }
        if (!next) break
        node = next
      }
      if (values.size > 0) {
        entry.inValues = entry.inValues ? new Set([...entry.inValues, ...values]) : values
      }
    }

    // Detect datatype-only: has sh:datatype but no value-constraining components.
    // A previous property shape for the same IRI may already have set patterns or
    // inValues — if so, this shape doesn't qualify as datatypeOnly.
    if (
      hasDatatype &&
      !hasPattern &&
      !hasIn &&
      entry.patterns.length === 0 &&
      entry.inValues === null
    ) {
      let hasOtherConstraint = false
      for (const pred of VALUE_CONSTRAINT_PREDS) {
        let found = false
        for (const _q of shapes.match(propShape, namedNode(pred), null, null)) {
          found = true
          break
        }
        if (found) {
          hasOtherConstraint = true
          break
        }
      }
      if (!hasOtherConstraint) {
        entry.datatypeOnly = true
      }
    }

    // Index this property if it has any fast-path-eligible information
    if (entry.patterns.length > 0 || entry.inValues !== null || entry.datatypeOnly) {
      index.set(propIri, entry)
    }
  }

  return index
}

// ─── Internal: candidate dataset construction ────────────────────────────────

/**
 * Build the minimal data graph the SHACL engine needs to evaluate one slot:
 *
 *   _:b a <targetClass> ;
 *       <propertyIri> <value> .
 *
 * The literal is typed naively (string by default; numbers/booleans get the
 * matching xsd datatype) so sh:datatype constraints fire correctly. SHACL
 * itself enforces any further pattern / range / enum rules.
 */
function buildCandidateDataset(
  propertyIri: string,
  value: string | number | boolean,
  targetClass: string
): DatasetCore {
  const ds = datasetFactory.dataset()
  const subject = blankNode()
  const rdfType = namedNode(iri('rdf', 'type'))

  ds.add(quad(subject, rdfType, namedNode(targetClass)))
  ds.add(quad(subject, namedNode(propertyIri), toLiteralOrIri(value)))
  return ds
}

/**
 * Build a single dataset containing one named focus node per candidate value.
 * Named (rather than blank) so the resulting `ValidationReport.results[].focusNode`
 * carries a stable IRI we can map back to the original value.
 *
 *   <urn:shacl-validator:candidate:0> a <Class> ; <prop> "DE" .
 *   <urn:shacl-validator:candidate:1> a <Class> ; <prop> "europe" .
 *   ...
 *
 * The `urn:shacl-validator:` prefix is internal — user-supplied values are
 * never named nodes themselves (we only validate literal slot values), so
 * there is no collision risk.
 */
const FOCUS_IRI_PREFIX = 'urn:shacl-validator:candidate:'

function buildBatchCandidateDataset(
  propertyIri: string,
  values: ReadonlyArray<string | number | boolean>,
  targetClass: string
): { dataset: DatasetCore; valueToFocusIri: Map<string, string> } {
  const ds = datasetFactory.dataset()
  const rdfType = namedNode(iri('rdf', 'type'))
  const cls = namedNode(targetClass)
  const propNode = namedNode(propertyIri)
  const valueToFocusIri = new Map<string, string>()

  values.forEach((value, idx) => {
    const focusIri = `${FOCUS_IRI_PREFIX}${idx}`
    const focus = namedNode(focusIri)
    ds.add(quad(focus, rdfType, cls))
    ds.add(quad(focus, propNode, toLiteralOrIri(value)))
    valueToFocusIri.set(String(value), focusIri)
  })

  return { dataset: ds, valueToFocusIri }
}

/** Stable cache key for a (propertyIri, value, targetClass) triple. */
function makeCacheKey(
  propertyIri: string,
  value: string | number | boolean,
  targetClass?: string
): string {
  return `${propertyIri} ${typeof value}:${String(value)} ${targetClass ?? ''}`
}

function toLiteralOrIri(value: string | number | boolean): NamedNode | ReturnType<typeof literal> {
  if (typeof value === 'number') {
    const isInt = Number.isInteger(value)
    return literal(String(value), namedNode(isInt ? iri('xsd', 'integer') : iri('xsd', 'decimal')))
  }
  if (typeof value === 'boolean') {
    return literal(String(value), namedNode(iri('xsd', 'boolean')))
  }
  // Strings that look like absolute IRIs become NamedNodes so sh:class /
  // sh:nodeKind constraints can evaluate correctly. Everything else is a
  // plain string literal.
  if (/^https?:\/\//.test(value) || /^urn:/.test(value)) {
    return namedNode(value)
  }
  return literal(value)
}

// ─── Internal: ValidationResult → ShaclViolation ─────────────────────────────

interface ValidatorResult {
  message: Term[]
  path: Term
  sourceConstraintComponent: Term
  value: Term
}

function toViolation(result: ValidatorResult): ShaclViolation {
  const messages = result.message.map((m) => m.value).filter(Boolean)
  const constraint = result.sourceConstraintComponent.value
  const fallback = constraint.startsWith(SH_NS) ? constraint.substring(SH_NS.length) : constraint

  return {
    message: messages.length > 0 ? messages.join('; ') : `Failed ${fallback}`,
    sourceConstraintComponent: constraint,
    path: result.path?.termType === 'NamedNode' ? result.path.value : undefined,
    value: result.value?.value,
  }
}
