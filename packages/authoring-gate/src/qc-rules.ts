/**
 * Quality-checker rule catalog — the rule identities the semantic and residual
 * gates attribute their violations to.
 *
 * A rule is either **published by an ASAM checker bundle** (`origin: 'asam'`) or
 * **declared by this repo** (`origin: 'repo'`). The distinction is enforced, not
 * merely documented: `__tests__/qc-rules.test.ts` requires every `asam` UID to
 * appear in the pinned bundle rule lists under `qc-bundles/`, and forbids a
 * `repo` UID from claiming the `asam.net` authority. A gap therefore cannot cite
 * a rule identity that resolves nowhere.
 *
 * UIDs follow the qc-framework grammar
 * `<emanating-entity>:<standard>:<definition-setting>:<rule-set>.<name>`, where
 * the emanating entity is the domain of the organization that *declares* the
 * rule. ASAM declares `asam.net:…`; rules this repo declares carry
 * {@link REPO_RULE_ENTITY} and are versioned independently of ASAM's standards.
 *
 * STANDARDS (criterion #31):
 *   [QC-FW]   ASAM Quality Checker Framework — the rule-UID grammar above and
 *             the `.xqar` result format. Source: `asam-ev/qc-framework`,
 *             `doc/manual/file_formats.md` and `doc/schema/xqar_result_format.xsd`.
 *   [QC-XOSC] ASAM OpenSCENARIO XML checker bundle — `asam-ev/qc-openscenarioxml`.
 *             Rule list pinned by commit and SHA-256 in
 *             `qc-bundles/qc-openscenarioxml.bundle.json`, regenerated from the
 *             bundle's own `checker_bundle_doc.md` by `qc-bundles/refresh.mjs`.
 *   [QC-XODR] ASAM OpenDRIVE checker bundle — `asam-ev/qc-opendrive`, pinned the
 *             same way in `qc-bundles/qc-opendrive.bundle.json`.
 */

import type { SceneGateName } from '@ontology-search/api-types'

/**
 * The emanating entity for rules this repo declares. Rules the ASAM bundles
 * publish keep `asam.net`; ours must not, or a consumer resolving the UID
 * against ASAM's catalog finds nothing.
 */
export const REPO_RULE_ENTITY = 'envited-x.net'

/** Who declares a rule: an ASAM checker bundle, or this repo. */
export type QcRuleOrigin = 'asam' | 'repo'

/** A qc rule identity: its UID, who declares it, and a human-readable message. */
export interface QcRule {
  /** The rule UID, in qc-framework grammar. */
  readonly uid: string
  /** Who declares the rule — gates the UID's authority. See {@link QcRuleOrigin}. */
  readonly origin: QcRuleOrigin
  /**
   * The gate that evaluates this rule. Recorded here rather than in each gate so
   * there is one place that answers "which rules can this gate emit" — the
   * `.xqar` export needs exactly that to declare a checker's `<AddressedRule>`
   * set, and a rule cannot be emitted by a checker that does not declare it.
   */
  readonly gate: SceneGateName
  /** A concise, human-readable description (echoed to the repair prompt). */
  readonly message: string
  /**
   * For a `repo` rule only: the closest **published** ASAM rule, for orientation
   * when reading a report. It is not what this rule checks and never substitutes
   * for {@link QcRule.uid} in attribution — it must itself resolve against a
   * pinned bundle list.
   */
  readonly relatedAsamRule?: string
}

export const QC_RULES = {
  /**
   * Every `entityRef` (honoring `$param` indirection) must resolve to a declared
   * `ScenarioObject`. [QC-XOSC].
   */
  resolvableEntityReferences: {
    uid: 'asam.net:xosc:1.2.0:reference_control.resolvable_entity_references',
    origin: 'asam',
    gate: 'semantic',
    message: 'A named reference in an EntityRef must resolve to a declared entity.',
  },
  /**
   * Element names must be unique at their level — applied here to entity names
   * and to parameter names (both are named elements). [QC-XOSC].
   */
  uniqueElementNames: {
    uid: 'asam.net:xosc:1.2.0:reference_control.unique_element_names_on_same_level',
    origin: 'asam',
    gate: 'semantic',
    message: 'Element names (entities, parameters) must be unique at their level.',
  },
  /**
   * The scenario document must validate against the OpenSCENARIO XSD schema.
   * The in-process engine's structural checker is the authoritative gate; this
   * UID attributes its schema/type/enum violations to the same rule the qc
   * bundle's `check_asam_xosc_xml_valid_schema` emits. [QC-XOSC].
   */
  schemaValidation: {
    uid: 'asam.net:xosc:1.0.0:xml.valid_schema',
    origin: 'asam',
    gate: 'structural',
    message: 'The scenario document must validate against the OpenSCENARIO XSD schema.',
  },
  /**
   * Cross-file `.xosc`→`.xodr` resolution: a road/lane referenced by the scenario
   * must exist in the referenced road network. No ASAM bundle rule covers this —
   * the bundles are file-scoped, while this resolves across two documents in one
   * merged RDF graph — so the rule is ours. The nearest published rule is the
   * per-file signal-id resolution check.
   */
  resolvableRoadReference: {
    uid: `${REPO_RULE_ENTITY}:xosc:1.0.0:reference_control.resolvable_road_reference`,
    origin: 'repo',
    gate: 'semantic',
    relatedAsamRule:
      'asam.net:xosc:1.2.0:reference_control.resolvable_signal_id_in_traffic_signal_state_action',
    message:
      'A road referenced by the scenario must exist in the referenced OpenDRIVE road network.',
  },
  /**
   * The IR carried an action the current lowering cannot express (an unsupported
   * `kind`, or a second maneuver the single-maneuver archetype omits), so the
   * emitted `.xosc` is a valid but INCOMPLETE representation of the request. No
   * ASAM rule can exist for this: a bundle checks a document, it cannot know what
   * the author asked for and the lowering dropped.
   */
  unexpressibleAction: {
    uid: `${REPO_RULE_ENTITY}:xosc:1.0.0:authoring.unexpressible_action`,
    origin: 'repo',
    gate: 'structural',
    message:
      'An action in the request could not be expressed by the lowering and was omitted from the scenario.',
  },
  /**
   * Analytic road-geometry continuity: consecutive planView geometry primitives
   * must join with continuous heading (G1) and curvature (G2), computed over the
   * lifted `.xodr` by the residual gate.
   *
   * `qc-opendrive` publishes **no** analytic G1/G2 continuity rule — its nearest
   * member is the contact-point horizontal-gap check, a positional test at lane
   * contact points rather than a tangent/curvature test at primitive joins. This
   * is therefore a repo rule and is labelled as one; [QC-XODR] is cited for the
   * family, not for the identity.
   */
  geometryContinuity: {
    uid: `${REPO_RULE_ENTITY}:xodr:1.0.0:road.geometry.continuity`,
    origin: 'repo',
    gate: 'residual',
    relatedAsamRule: 'asam.net:xodr:1.7.0:lane_smoothness.contact_point_no_horizontal_gaps',
    message:
      'Consecutive road geometry primitives must join with continuous heading (G1) and curvature (G2).',
  },
  /**
   * No two entities may overlap at scenario start. Decidable only by placing the
   * entities in a simulator, so the in-process backend reports it `skipped`
   * rather than passed (see RESIDUAL-QC.md).
   */
  noCollisionAtScenarioStart: {
    uid: `${REPO_RULE_ENTITY}:xosc:1.0.0:simulation.no_collision_at_scenario_start`,
    origin: 'repo',
    gate: 'residual',
    message: 'No two entities may overlap at scenario start.',
  },
  /**
   * A target the scenario commands must be reachable within the scenario horizon.
   * Simulation-only, like {@link QC_RULES.noCollisionAtScenarioStart}.
   */
  reachableTargetWithinHorizon: {
    uid: `${REPO_RULE_ENTITY}:xosc:1.0.0:simulation.reachable_target_within_horizon`,
    origin: 'repo',
    gate: 'residual',
    message: 'A commanded target must be reachable within the scenario horizon.',
  },
} as const satisfies Record<string, QcRule>

export type QcRuleKey = keyof typeof QC_RULES
