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
