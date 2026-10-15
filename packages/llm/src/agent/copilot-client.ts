/**
 * The Copilot SDK client — one per process, shared by search and authoring —
 * and what the runtime tells us about itself and its models.
 *
 * Three pieces of the compatibility contract between this repo, the pinned
 * `@github/copilot-sdk` and the Copilot runtime it spawns live here, so they
 * have one owner instead of being repeated in each adapter:
 *
 *  1. WHICH runtime. The SDK spawns the runtime bundled with its own release
 *     (`TESTED_RUNTIME_VERSION`) unless `COPILOT_CLI_PATH` points elsewhere.
 *     A user-installed CLI auto-updates (1.0.78 → 1.0.98 within weeks) and
 *     moves under the app, so it is reported as unsupported, not silently used.
 *  2. WHAT the runtime says about a model. `listModels()` is the contract for
 *     which `reasoningEffort` values a model accepts; see `reasoning-effort.ts`.
 *  3. WHEN it is checked. A bad request value only fails at `sendAndWait`, long
 *     after startup looked healthy, so the checks are exposed for `verify()`.
 *
 * [SDK] `@github/copilot-sdk` `CopilotClient.getStatus()` / `listModels()`.
 */
import { CopilotClient, type ModelInfo } from '@github/copilot-sdk'
import { getConfig } from '@ontology-search/core/config'
import { AgentError } from '@ontology-search/core/errors'
import { createComponentLogger } from '@ontology-search/core/logging'

import {
  type Effort,
  type ModelEffortCapabilities,
  resolveReasoningEffort,
} from './reasoning-effort.js'

const log = createComponentLogger('copilot-runtime')

/**
 * The Copilot runtime bundled with the pinned SDK release — the one the
 * credential-free CI job (`test:copilot-sdk`) starts and the README's live
 * matrix was last run against.
 *
 * `scripts/copilot-sdk-compat.mjs` fails when this differs from the SDK's own
 * pin, so bumping the SDK cannot silently leave this behind: the bump has to
 * touch this line, which is where the README sends the author to re-run the
 * live matrix.
 */
export const TESTED_RUNTIME_VERSION = '1.0.85'

// ─── Client ──────────────────────────────────────────────────────────────────

let clientPromise: Promise<CopilotClient> | null = null

/**
 * The shared, started client. Concurrent first callers share one start, and a
 * failed start is not cached — so a runtime or login that comes back needs no
 * restart.
 */
export function getCopilotClient(): Promise<CopilotClient> {
  clientPromise ??= startClient().catch((error: unknown) => {
    clientPromise = null
    throw error
  })
  return clientPromise
}

async function startClient(): Promise<CopilotClient> {
  const { GITHUB_TOKEN } = getConfig()
  const client = new CopilotClient({
    ...(GITHUB_TOKEN ? { gitHubToken: GITHUB_TOKEN } : {}),
  })
  await client.start()
  await reportRuntime(client)
  return client
}

/**
 * Log which runtime is serving this process and warn when it is not the tested
 * one. Diagnostic only: it can never fail startup.
 *
 * `COPILOT_CLI_PATH` is read because the SDK itself honours it — it is not a
 * setting of this app (see `scripts/copilot-sdk-compat.mjs`, which clears it).
 */
export async function reportRuntime(
  client: Pick<CopilotClient, 'getStatus'>,
  // eslint-disable-next-line no-restricted-syntax -- the SDK's own variable, not an app setting
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  try {
    const { version, protocolVersion } = await client.getStatus()
    const override = env['COPILOT_CLI_PATH']
    const facts = {
      runtimeVersion: version,
      protocolVersion,
      testedRuntimeVersion: TESTED_RUNTIME_VERSION,
      ...(override ? { runtimeOverride: override } : {}),
    }
    if (override) {
      log.warn(
        `COPILOT_CLI_PATH replaces the runtime bundled with the SDK (${version}); this is not tested or supported`,
        facts
      )
    } else if (version !== TESTED_RUNTIME_VERSION) {
      log.warn(
        `Copilot runtime ${version} differs from ${TESTED_RUNTIME_VERSION}, the version tested with this SDK`,
        facts
      )
    } else {
      log.info('Copilot runtime started', facts)
    }
  } catch {
    // intentional: diagnostics must never affect startup
  }
}

// ─── Model capabilities ──────────────────────────────────────────────────────

const modelLists = new WeakMap<object, Promise<ModelInfo[]>>()

/**
 * Every model the runtime lists for this account, fetched once per client.
 * `undefined` when the listing is unavailable (a failure is not cached, so the
 * next call retries).
 */
async function listModels(
  client: Pick<CopilotClient, 'listModels'>
): Promise<ModelInfo[] | undefined> {
  let pending = modelLists.get(client)
  if (!pending) {
    pending = Promise.resolve().then(() => client.listModels())
    modelLists.set(client, pending)
    pending.catch(() => modelLists.delete(client))
  }
  try {
    return await pending
  } catch {
    return undefined
  }
}

function toCapabilities(info: ModelInfo | undefined): ModelEffortCapabilities | undefined {
  if (!info) return undefined
  return {
    supportsReasoningEffort: info.capabilities?.supports?.reasoningEffort === true,
    supported: info.supportedReasoningEfforts ?? [],
  }
}

const warned = new Set<string>()

/**
 * The `reasoningEffort` to create a session with, resolved against what the
 * runtime advertises for `model` (see `resolveReasoningEffort`). A departure
 * from the request is logged once per model and request, not per session.
 */
export async function resolveSessionEffort(
  client: Pick<CopilotClient, 'listModels'>,
  model: string | undefined,
  requested: Effort | null
): Promise<Effort | undefined> {
  if (requested === null) return undefined
  const info =
    model === undefined ? undefined : (await listModels(client))?.find((m) => m.id === model)
  const { effort, adjustment } = resolveReasoningEffort(requested, toCapabilities(info))
  if (adjustment) {
    const key = `${model}|${requested}|${effort}`
    if (!warned.has(key)) {
      warned.add(key)
      log.warn(`Model '${model}': ${adjustment}`, { model, requested, effective: effort ?? null })
    }
  }
  return effort
}

/**
 * Startup check: the configured model must be one the runtime lists for this
 * account. Without it the first query fails inside the model call, far from the
 * setting that caused it. A listing that cannot be fetched is not an error here
 * (the session creation that follows reports authentication problems).
 */
export async function verifyModelListed(model: string | undefined): Promise<void> {
  if (model === undefined) return
  const models = await listModels(await getCopilotClient())
  if (models === undefined || models.some((m) => m.id === model)) return
  throw new AgentError(
    `Copilot does not list the model '${model}' for this account. Set AI_MODEL to one of: ${models
      .map((m) => m.id)
      .join(', ')} (AI_PROVIDER=copilot, AI_MODEL=${model})`
  )
}

/** Test seam: forget the shared client and everything cached about it. */
export function resetCopilotClientForTests(): void {
  clientPromise = null
  warned.clear()
}
