import { getAuthoringBackend, probeEngineVersions } from '@ontology-search/authoring'
import { getConfig } from '@ontology-search/core/config'
import { createComponentLogger } from '@ontology-search/core/logging'
import { warmupAgentPrompt, warmupLlmSession } from '@ontology-search/llm'
import { buildDomainRegistry } from '@ontology-search/ontology/domain-registry'
import { ShaclValidator } from '@ontology-search/ontology/shacl-validator'
import { getInitializedStore, warmupCompiler } from '@ontology-search/search'
import { probePropertyPathSupport } from '@ontology-search/sparql'
import { registerPolicyNamespaces } from '@ontology-search/sparql/policy'

const logger = createComponentLogger('warmup')

/** Result of the warmup process — surfaces degraded state for health checks */
export interface WarmupResult {
  ready: boolean
  errors: string[]
  timings: {
    storeMs: number
    vocabMs: number
    compilerMs: number
    shaclMs: number
    sessionMs: number
    /** Optional: absent when the authoring engine is disabled (`AUTHORING_MODE=null`). */
    authoringMs?: number
  }
}

/** Total number of warmup steps — used for `[n/TOTAL]` progress prefixes. */
const TOTAL_STEPS = 7

/**
 * Assert the in-process authoring engine matches the single-source version pin
 * (ADR 0006). A stale/wrong committed `.wasm` — one built for a different
 * OpenSCENARIO/XSD version — would author subtly non-conformant `.xosc` with no
 * signal; probing `describe()` at startup turns that into a loud, health-visible
 * failure instead. Guards build-config drift only (semantic correctness is the
 * golden-conformance suite's job). No-op when the engine is disabled.
 *
 * Exported so the drift behaviour is unit-testable without the full warmup graph.
 */
export async function probeAuthoring(): Promise<void> {
  if (getConfig().AUTHORING_MODE === 'null') return
  // probeEngineVersions calls describe() itself and throws BackendCapabilityError
  // on any version mismatch (or if the engine can't report).
  await probeEngineVersions(getAuthoringBackend())
}

/**
 * Run one named warmup step with start/finish progress logging and
 * error isolation. A failing step is recorded in `errors` (degrading
 * the service) but never aborts the remaining steps — a search API
 * that can't reach the LLM should still serve `/stats`, etc.
 *
 * Returns the step's wall-clock duration so the caller can assemble
 * the timings summary and spot the slow step at a glance.
 */
async function runStep(
  step: number,
  label: string,
  fn: () => Promise<void>,
  errors: string[]
): Promise<number> {
  logger.info(`[${step}/${TOTAL_STEPS}] ${label} — starting`)
  const start = Date.now()
  try {
    await fn()
    const durationMs = Date.now() - start
    logger.info(`[${step}/${TOTAL_STEPS}] ${label} — done`, { durationMs })
    return durationMs
  } catch (error) {
    const durationMs = Date.now() - start
    const msg = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`${label} failed: ${msg}`)
    logger.error(`[${step}/${TOTAL_STEPS}] ${label} — FAILED`, error, { durationMs })
    return durationMs
  }
}

export async function warmup(): Promise<WarmupResult> {
  logger.info('Warming up — initializing store, indexes, validator, and LLM session', {
    steps: TOTAL_STEPS,
  })
  const start = Date.now()
  const errors: string[] = []

  // [1/6] Store init + property-path capability probe. Probe runs first
  // so a store that silently drops `rdfs:subClassOf*` fails loudly at
  // startup rather than returning zero rows for hierarchical queries.
  const storeMs = await runStep(
    1,
    'SPARQL store + capability probe',
    async () => {
      const store = await getInitializedStore()
      await probePropertyPathSupport(store)
    },
    errors
  )

  // [2/6] Register every discovered namespace with the SPARQL policy so
  // compiled queries pass prefix validation regardless of the ontology.
  await runStep(
    2,
    'SPARQL policy namespace registration',
    async () => {
      const registry = await buildDomainRegistry()
      registerPolicyNamespaces(registry.getAllNamespaces())
    },
    errors
  )

  // [3/6] Pre-build the agent context (schema-only vocabulary + store
  // reference) into the agent's module-private cache so the first user
  // request sees a hot cache instead of paying the extraction cost inline.
  const vocabMs = await runStep(
    3,
    'LLM agent context (schema vocabulary)',
    warmupAgentPrompt,
    errors
  )

  // [4/6] Compiler vocabulary — property-path BFS + leaf-kind enrichment
  // + cross-reference chains + concept-expansion index. The single most
  // expensive cold-start step; its sub-phases log their own timings (see
  // `buildPropertyPaths`).
  const compilerMs = await runStep(
    4,
    'Compiler vocabulary (property paths, references, concepts)',
    warmupCompiler,
    errors
  )

  // [5/6] SHACL validator — parse every shape into an RDF/JS dataset for
  // the slot-validation gate.
  const shaclMs = await runStep(
    5,
    'SHACL validator',
    async () => {
      await ShaclValidator.fromWorkspace()
    },
    errors
  )

  // [6/7] LLM session — pre-create so the first query is instant (no-op
  // for providers that don't pool sessions).
  const sessionMs = await runStep(6, 'LLM session', warmupLlmSession, errors)

  // [7/7] Authoring engine capability probe — assert the committed WASM engine
  // reports the pinned OpenSCENARIO/XSD versions, so a stale/wrong artifact
  // degrades /health at startup instead of authoring silently non-conformant
  // `.xosc`. Skipped (0 ms) when AUTHORING_MODE=null.
  const authoringMs = await runStep(7, 'Authoring engine capability probe', probeAuthoring, errors)

  // A fatal misconfiguration (e.g. no ontology sources) rejects the shared
  // store init promise, so several dependent steps surface the same message.
  // Collapse duplicates so /health and the logs show it once.
  const uniqueErrors = [...new Set(errors)]
  errors.length = 0
  errors.push(...uniqueErrors)

  const totalMs = Date.now() - start
  const ready = errors.length === 0
  const timings = { storeMs, vocabMs, compilerMs, shaclMs, sessionMs, authoringMs }

  if (ready) {
    logger.info(`Warmup complete in ${totalMs}ms`, { ...timings, totalMs })
  } else {
    logger.warn(`Warmup completed with ${errors.length} error(s) — service DEGRADED`, {
      errors,
      ...timings,
      totalMs,
    })
  }

  return { ready, errors, timings }
}
