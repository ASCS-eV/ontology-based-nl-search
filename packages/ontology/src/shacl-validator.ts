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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import datasetFactory from '@rdfjs/dataset'
import type { DatasetCore, NamedNode, Quad, Term } from '@rdfjs/types'
import { DataFactory, Parser } from 'n3'
import SHACLValidator from 'rdf-validate-shacl'

const { namedNode, blankNode, literal, quad } = DataFactory

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/** SHACL constraint component IRIs we surface in violation messages. */
const SH_NS = 'http://www.w3.org/ns/shacl#'

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

  private constructor(validator: SHACLValidator, propertyToTargetClass: Map<string, string[]>) {
    this.validator = validator
    this.propertyToTargetClass = propertyToTargetClass
  }

  /**
   * Build a validator from the workspace ontology Turtle files.
   * Discovers the same artefact tree the schema loader uses.
   */
  static async fromWorkspace(): Promise<ShaclValidator> {
    if (cachedInstance) return cachedInstance
    const shapesDataset = loadShapesFromDisk()
    const propertyToTargetClass = indexPropertyTargetClasses(shapesDataset)
    // The Turtle loader already pulls every workspace shape file into one
    // dataset, so owl:imports references are already satisfied. We provide
    // an empty resolver to suppress the engine's mandatory import-fetch hook.
    const validator = new SHACLValidator(shapesDataset, {
      importGraph: () => datasetFactory.dataset(),
    })
    cachedInstance = new ShaclValidator(validator, propertyToTargetClass)
    return cachedInstance
  }

  /** Reset the cached singleton — test-only hook. */
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
    const candidates = targetClass
      ? [targetClass]
      : (this.propertyToTargetClass.get(propertyIri) ?? [])

    // If the property has no known shape target, there's nothing to validate.
    // This is informational (not a failure) — caller decides whether unknown
    // properties should fall back to looser handling.
    if (candidates.length === 0) {
      return { conforms: true, violations: [] }
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

    return anyConforms
      ? { conforms: true, violations: [] }
      : { conforms: false, violations: allViolations }
  }

  /** Property IRIs covered by at least one SHACL property shape. */
  knownProperties(): string[] {
    return [...this.propertyToTargetClass.keys()]
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

    const allViolations: ShaclViolation[] = []
    let allConform = true
    for (const iri of iris) {
      const result = await this.validateValue(iri, value)
      if (!result.conforms) {
        allConform = false
        allViolations.push(...result.violations)
      }
    }
    return { conforms: allConform, violations: allViolations, resolvedIris: iris }
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

  for (const filePath of discoverShapeFiles()) {
    const turtle = readFileSync(filePath, 'utf-8')
    try {
      const quads = parser.parse(turtle)
      for (const q of quads) ds.add(q as unknown as Quad)
    } catch (err) {
      console.warn(`[shacl-validator] Failed to parse ${filePath}: ${err}`)
    }
  }

  return ds
}

/**
 * Resolve workspace root by walking up from this file. Honours ONTOLOGY_ROOT
 * (the same env var used by schema-loader) so test fixtures can override it.
 */
function findWorkspaceRoot(): string {
  if (process.env['ONTOLOGY_ROOT']) return process.env['ONTOLOGY_ROOT']

  let dir = join(__dirname, '..', '..', '..')
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  return process.cwd()
}

/** Read ontology-sources.json for the artefact roots. */
function getArtifactRoots(): string[] {
  const root = findWorkspaceRoot()
  const configPath = join(root, 'ontology-sources.json')

  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, 'utf-8'))
      const sources = config.sources || []
      return sources.map((s: { path: string }) => join(root, s.path))
    } catch {
      // fall through
    }
  }

  return [
    join(
      root,
      'submodules',
      'hd-map-asset-example',
      'submodules',
      'sl-5-8-asset-tools',
      'submodules',
      'ontology-management-base',
      'artifacts'
    ),
  ]
}

function discoverShapeFiles(): string[] {
  const results: string[] = []
  for (const root of getArtifactRoots()) {
    if (!existsSync(root)) continue
    for (const entry of readdirSync(root)) {
      const domainDir = join(root, entry)
      if (!statSync(domainDir).isDirectory()) continue
      for (const file of readdirSync(domainDir)) {
        if (file.endsWith('.shacl.ttl') || file.endsWith('.owl.ttl')) {
          results.push(join(domainDir, file))
        }
      }
    }
  }
  return results
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
  const rdfType = namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type')

  ds.add(quad(subject, rdfType, namedNode(targetClass)))
  ds.add(quad(subject, namedNode(propertyIri), toLiteralOrIri(value)))
  return ds
}

function toLiteralOrIri(value: string | number | boolean): NamedNode | ReturnType<typeof literal> {
  if (typeof value === 'number') {
    const isInt = Number.isInteger(value)
    return literal(
      String(value),
      namedNode(
        isInt
          ? 'http://www.w3.org/2001/XMLSchema#integer'
          : 'http://www.w3.org/2001/XMLSchema#decimal'
      )
    )
  }
  if (typeof value === 'boolean') {
    return literal(String(value), namedNode('http://www.w3.org/2001/XMLSchema#boolean'))
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
