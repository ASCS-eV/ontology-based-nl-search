/**
 * Choose the `reasoningEffort` for a Copilot session from what the runtime
 * ADVERTISES for that model, never from the model's id.
 *
 * [SDK] `@github/copilot-sdk` `ModelInfo.capabilities.supports.reasoningEffort`
 * and `ModelInfo.supportedReasoningEfforts` — the SDK's own contract for the
 * knob: "Only valid for models where capabilities.supports.reasoningEffort is
 * true. Use client.listModels() to check supported values for each model."
 *
 * Why this exists. The search policy wants the least reasoning a model offers
 * (`'none'`), but whether `'none'` is accepted depends on the model AND on the
 * runtime version, and the wire protocol version does not change with it:
 *
 *  - runtimes up to 1.0.85 forward `'none'` to the provider, which rejects it
 *    for some models (a 400 for `claude-sonnet-5.5`, `grok-4.6`, `gpt-5-mini`)
 *    and accepts it for others (`claude-sonnet-5`, `gpt-5.4`);
 *  - runtimes from 1.0.91 validate it locally against
 *    `supportedReasoningEfforts` and reject it for every model that does not
 *    advertise it — including `claude-sonnet-5` — as `Reasoning effort 'none'
 *    is not supported for model '…'` raised from `sendAndWait`.
 *
 * Both behaviours agree with the advertised list, so that list is the contract.
 * The SDK types the list as `low..max`; real runtimes also report `none`
 * (`gpt-5.4`, `gpt-5.6-sol`), so values are treated as plain strings.
 */

/** Every effort level the runtime can name, weakest first. */
export const EFFORT_ORDER = ['none', 'low', 'medium', 'high', 'xhigh', 'max'] as const

export type Effort = (typeof EFFORT_ORDER)[number]

/** What the runtime reports about one model's reasoning-effort support. */
export interface ModelEffortCapabilities {
  /** `capabilities.supports.reasoningEffort` */
  readonly supportsReasoningEffort: boolean
  /** `supportedReasoningEfforts` (absent for models without the capability). */
  readonly supported: readonly string[]
}

export interface EffortResolution {
  /** Value for `createSession({ reasoningEffort })`; `undefined` leaves the knob unset. */
  readonly effort: Effort | undefined
  /** Set when `effort` differs from the request in a way an operator should know about. */
  readonly adjustment?: string
}

const rank = (effort: string): number => EFFORT_ORDER.indexOf(effort as Effort)

/**
 * Resolve a requested effort against a model's advertised capabilities.
 *
 * - no request → unset;
 * - capabilities unknown (model not listed, listing failed) → an unverifiable
 *   `'none'` is left unset, any other request is forwarded unchanged;
 * - model without the capability → unset (the runtime ignores the knob);
 * - requested level advertised → as requested;
 * - otherwise the nearest advertised level: for `'none'` the weakest one
 *   (least reasoning), for any other level the strongest one not above it,
 *   or the weakest when every advertised level is above it.
 */
export function resolveReasoningEffort(
  requested: Effort | null,
  capabilities: ModelEffortCapabilities | undefined
): EffortResolution {
  if (requested === null) return { effort: undefined }

  if (capabilities === undefined) {
    return requested === 'none'
      ? {
          effort: undefined,
          adjustment:
            "capabilities for the model are unknown, so reasoning effort 'none' cannot be verified; leaving it unset",
        }
      : { effort: requested }
  }

  if (!capabilities.supportsReasoningEffort) {
    return requested === 'none'
      ? { effort: undefined }
      : {
          effort: undefined,
          adjustment: `the model does not support a reasoning effort; requested '${requested}' is ignored`,
        }
  }

  const advertised = capabilities.supported
    .filter((effort) => rank(effort) >= 0)
    .sort((a, b) => rank(a) - rank(b)) as Effort[]
  if (advertised.length === 0) return { effort: undefined }
  if (advertised.includes(requested)) return { effort: requested }

  const weakest = advertised[0]!
  const notAbove = advertised.filter((effort) => rank(effort) <= rank(requested))
  const chosen = requested === 'none' ? weakest : (notAbove.at(-1) ?? weakest)
  return {
    effort: chosen,
    adjustment: `reasoning effort '${requested}' is not advertised for the model (${advertised.join(', ')}); using '${chosen}'`,
  }
}
