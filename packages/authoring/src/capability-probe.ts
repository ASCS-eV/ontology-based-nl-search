/**
 * Authoring engine capability probe — the analog of
 * `probePropertyPathSupport` in packages/sparql.
 *
 * The ontology (task 01) and the WASM engine (task 08) both derive from the
 * same ASAM model, so a version match only guards *build-config* drift (e.g. a
 * stale or wrong `osc-engine.wasm` artifact) — not semantic drift, which the
 * golden-conformance test guards. Run this at startup so a mis-built engine is
 * rejected loudly instead of silently validating against the wrong OSC/XSD.
 */
import { BackendCapabilityError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'

import type { AuthoringBackend } from './backend.js'

const log = createComponentLogger('authoring-capability-probe')

/** The engine capabilities a backend must report to be accepted. */
export interface ExpectedEngine {
  readonly oscVersions: readonly string[]
  readonly xsd: string
  /** Pinned RAC submodule commit; when set, the build must match exactly. */
  readonly engineCommit?: string
}

/**
 * The versions the pinned WASM engine (packages/authoring-wasm) is built for.
 * Task 01 will centralize these in a model-derived `versions.json`; until then
 * this is the single expected-capability constant.
 */
export const EXPECTED_ENGINE: ExpectedEngine = {
  oscVersions: ['1.3'],
  xsd: '1.3.0',
  engineCommit: '292d0be',
}

/**
 * Assert `backend.describe()` matches `expected`.
 *
 * @throws BackendCapabilityError when the engine cannot report, or reports
 *         versions that differ from the expected pinned build.
 */
export async function probeEngineVersions(
  backend: AuthoringBackend,
  expected: ExpectedEngine = EXPECTED_ENGINE
): Promise<void> {
  let info
  try {
    info = await backend.describe()
  } catch (cause) {
    throw new BackendCapabilityError(
      `Authoring engine did not report its capabilities: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      { cause }
    )
  }

  const mismatches: string[] = []
  for (const version of expected.oscVersions) {
    if (!info.oscVersions.includes(version)) {
      mismatches.push(
        `missing OpenSCENARIO version ${version} (engine reports [${info.oscVersions.join(', ')}])`
      )
    }
  }
  if (info.xsd !== expected.xsd) {
    mismatches.push(`XSD version "${info.xsd}" != expected "${expected.xsd}"`)
  }
  if (expected.engineCommit && info.engineCommit !== expected.engineCommit) {
    mismatches.push(`engine commit "${info.engineCommit}" != expected "${expected.engineCommit}"`)
  }

  if (mismatches.length > 0) {
    throw new BackendCapabilityError(
      `Authoring engine capability drift — the built WASM engine does not match the expected pinned build:\n  ${mismatches.join(
        '\n  '
      )}\nRebuild packages/authoring-wasm from the pinned submodule (native/BUILD.md), or update the expected versions.`
    )
  }

  log.info('Authoring engine capability probe passed', {
    oscVersions: info.oscVersions,
    xsd: info.xsd,
  })
}
