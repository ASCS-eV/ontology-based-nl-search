/**
 * ASAM Quality-Checker rule catalog — the UID identities the semantic and
 * residual gates attribute their violations to.
 *
 * Each entry mirrors a rule from the official ASAM checker bundles so a gap this
 * repo emits at design time carries the SAME `asam.net:…` UID the qc-framework
 * would emit at check time. The agent's repair prompt (task 05) cites the UID, so
 * feedback is traceable to the standard without running the framework.
 *
 * STANDARDS (criterion #31):
 *   [QC-XOSC] ASAM OpenSCENARIO checker bundle — asam-ev/qc-openscenarioxml
 *             (checker_bundle_doc.md). UIDs transcribed verbatim.
 *   [QC-XODR] ASAM OpenDRIVE checker bundle — asam-ev/qc-opendrive (geometry
 *             continuity family). The residual analytic gate implements the
 *             continuity check in-process; see RESIDUAL-QC.md.
 *
 * UIDs are `<entity>:<standard>:<version>:<rule_set>.<name>` per the ASAM
 * OpenSCENARIO XML spec, Annex C (normative checker rules).
 */

/** A qc rule identity: its canonical UID and a human-readable message. */
export interface QcRule {
  /** The canonical `asam.net:…` rule UID. */
  readonly uid: string
  /** A concise, human-readable description (echoed to the repair prompt). */
  readonly message: string
}

export const QC_RULES = {
  /**
   * Every `entityRef` (honoring `$param` indirection) must resolve to a declared
   * `ScenarioObject`. [QC-XOSC] verbatim.
   */
  resolvableEntityReferences: {
    uid: 'asam.net:xosc:1.2.0:reference_control.resolvable_entity_references',
    message: 'A named reference in an EntityRef must resolve to a declared entity.',
  },
  /**
   * Element names must be unique at their level — applied here to entity names
   * and to parameter names (both are named elements). [QC-XOSC] verbatim.
   */
  uniqueElementNames: {
    uid: 'asam.net:xosc:1.2.0:reference_control.unique_element_names_on_same_level',
    message: 'Element names (entities, parameters) must be unique at their level.',
  },
  /**
   * Cross-file `.xosc`→`.xodr` resolution: a road/lane referenced by the scenario
   * must exist in the referenced road network. This generalizes the real
   * per-file rule `reference_control.resolvable_signal_id_in_traffic_signal_state_action`
   * (signal id must exist in the road network) to lane/road references — a
   * capability that is natural over a merged RDF graph but out of reach of the
   * file-scoped qc bundle. Marked as a cross-file extension UID.
   */
  resolvableRoadReference: {
    uid: 'asam.net:xosc:cross-file:resolvable_road_reference',
    message:
      'A road referenced by the scenario must exist in the referenced OpenDRIVE road network.',
  },
  /**
   * The scenario document must validate against the OpenSCENARIO XSD schema.
   * The in-process engine's structural checker is the authoritative gate; this
   * UID attributes its schema/type/enum violations to the same rule the qc
   * bundle's `check_asam_xosc_xml_valid_schema` emits. [QC-XOSC] verbatim.
   */
  schemaValidation: {
    uid: 'asam.net:xosc:1.0.0:xml.valid_schema',
    message: 'The scenario document must validate against the OpenSCENARIO XSD schema.',
  },
  /**
   * Analytic road-geometry continuity: consecutive planView geometry primitives
   * must join with continuous heading (G1) and curvature (G2). Implemented by the
   * in-process residual gate over the lifted `.xodr`. Mirrors the qc-opendrive
   * geometry-continuity family. [QC-XODR].
   */
  geometryContinuity: {
    uid: 'asam.net:xodr:1.7.0:road.geometry.continuity',
    message:
      'Consecutive road geometry primitives must join with continuous heading (G1) and curvature (G2).',
  },
} as const satisfies Record<string, QcRule>

export type QcRuleKey = keyof typeof QC_RULES
