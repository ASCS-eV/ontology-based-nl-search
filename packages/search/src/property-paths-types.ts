/**
 * Property-path types (ADR 0003) — the data shapes shared by the path-discovery
 * query, graph-traversal, and orchestration layers. Pure types; no imports.
 *
 * @see https://www.w3.org/TR/shacl/ — [SHACL]
 */
export interface PathStep {
  /** Full IRI of the predicate to walk. */
  predicate: string
  /**
   * Target-class IRI of the resource reached by this hop, if any.
   * Leaf steps (the last hop on the path) leave this undefined —
   * the leaf yields a literal value, not a typed sub-resource.
   */
  intermediate?: string
}

/**
 * Whether a leaf property binds a literal value, an IRI, or a typed
 * sub-resource class. Determined from SHACL — `sh:nodeKind sh:IRI`,
 * `sh:class ?C`, or `sh:datatype xsd:foo` on the leaf property shape.
 *
 *  - `iri`        — leaf binds an IRI with no class constraint (e.g.
 *                   `manifest:iri`). The compiler can constrain the
 *                   bound resource separately with a `?leaf a Class`
 *                   pattern to express cross-domain references.
 *  - `class:<IRI>` — leaf binds an IRI typed as the named class. Direct
 *                   reference to a known sub-resource type.
 *  - `literal`    — default; leaf binds a typed literal (xsd:string,
 *                   xsd:integer, …).
 */
export type LeafKind = 'iri' | 'literal' | `class:${string}`

/**
 * A discovered path from an asset class to one of its leaf properties.
 * Independent of any meta-model: every literal predicate
 * comes from `sh:path` declarations in the schema graph.
 */
export interface PropertyPath {
  /** Domain of the leaf property. */
  domain: string
  /** Local name of the leaf property. */
  propertyName: string
  /** Full IRI of the leaf property. */
  propertyIri: string
  /** Asset class IRI at the root of the path. */
  assetClass: string
  /**
   * Predicates to walk, in order, from the asset variable to the
   * leaf property value. The final step's predicate is the leaf
   * property itself.
   */
  steps: PathStep[]
  /**
   * Kind of value bound by the leaf step. See {@link LeafKind}. Used
   * by the compiler to identify cross-reference chains (paths whose
   * leaf binds an IRI / typed class) versus value-filter chains
   * (paths whose leaf binds a literal).
   */
  leafKind: LeafKind
}

/**
 * A discovered cross-domain reference chain.
 *
 * For any ontology that expresses cross-asset references
 * declaratively in SHACL — whether via a manifest pattern, a direct
 * `references` property, or some other structure — the compiler reads
 * the actual predicate chain from this set.
 *
 * Two flavours emerge from {@link LeafKind}:
 *
 *   - `kind: 'iri'`   — the leaf binds an unconstrained IRI. The
 *                       compiler can pair the chain with a runtime
 *                       `?refAsset a <ChildClass>` constraint to
 *                       address any child asset domain via this path.
 *                       (a manifest-style reference uses this shape.)
 *   - `kind: 'class'` — the leaf binds an IRI typed as the named
 *                       child asset class. The chain is the join to
 *                       exactly that child domain; no extra type
 *                       constraint needed.
 */
export interface ReferenceChain {
  /** Parent asset class IRI at the root of the chain. */
  parentClass: string
  /** Parent domain name. */
  parentDomain: string
  /** Predicates to walk from the parent variable to the bound IRI. */
  steps: PathStep[]
  /**
   * `iri` for open-ended IRI-leaf chains (compiler supplies the
   * `?refAsset a <ChildClass>` constraint at emission time);
   * `class` for chains whose leaf SHACL declares `sh:class` directly.
   */
  kind: 'iri' | 'class'
  /**
   * For `kind: 'class'`, the IRI of the constrained child asset class.
   * For `kind: 'iri'`, undefined — child domain is determined at the
   * compiler's call site.
   */
  childClass?: string
  /**
   * For `kind: 'class'`, the resolved child domain name. For `kind:
   * 'iri'`, undefined.
   */
  childDomain?: string
}

/**
 * Derive cross-domain reference chains from the discovered property
 * paths. Selects paths whose leaf binds an IRI or a typed class, then
 * groups them by parent asset class.
 *
 * Ontology-agnostic: works against any SHACL that declares cross-
 * references via `sh:nodeKind sh:IRI` or `sh:class`, regardless of
 * whether the predicate naming follows a manifest pattern.
 */
