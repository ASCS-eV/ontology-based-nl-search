/**
 * SHACL-validator result types (ADR 0003) — the public ValidationResult /
 * Violation shapes shared by the validator class and its internal helpers.
 * Pure types; no imports (breaks the class↔candidates type cycle).
 *
 * @see https://www.w3.org/TR/shacl/
 */
/** Result of validating a candidate value. */
export interface ShaclValidationResult {
  conforms: boolean
  /** Structured violations (empty when conforms === true). */
  violations: ShaclViolation[]
}

/**
 * The value-local constraints indexed for one property IRI at startup, merged
 * across every property shape that declares that path.
 */
export interface PropertyConstraint {
  /** Anchored `sh:pattern` regexes. */
  patterns: RegExp[]
  /** Union of every `sh:in` vocabulary, or null when the property has none. */
  inValues: Set<string> | null
  /** True when the only constraint is `sh:datatype`, so any lexically valid value passes. */
  datatypeOnly: boolean
  /**
   * The `sh:datatype` IRIs declared for this path. Candidate synthesis builds
   * the literal with the declared datatype rather than guessing one from the
   * host value's runtime type: `sh:datatype` is satisfied only when the
   * literal's datatype IRI *equals* the declared one [SHACL] §4.2.3 — there is
   * no numeric promotion — so an `xsd:integer` literal fails an `xsd:float`
   * shape, and a plain string fails both.
   */
  datatypes: Set<string>
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
