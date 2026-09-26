/**
 * Claude Code adapter — slot-filling through the headless Claude Code binary.
 *
 * Serves `AI_PROVIDER=claude-code`: the user's own `claude`, signed in with
 * their own Claude subscription, answers with the slot submission as its
 * structured output. Why the binary, and how its session is isolated, is in
 * ../claude-code-cli.ts.
 *
 * Two deliberate differences from the Vercel and Copilot adapters:
 *
 *  - **One turn, no lookup tools.** The CLI can offer extra tools only through
 *    an MCP server, and the lookups run against this process's in-memory
 *    store; bridging the two is separate work. The retrieved schema context is
 *    in the prompt, which is what the static core already tells the model to
 *    rely on first ("Lookup tools are for misses only").
 *  - **The submission is the structured output**, not a `submit_slots` call, so
 *    the prompt gets one note saying so. It is validated against the same
 *    `slotSubmissionSchema` and runs through the same slot pipeline, so the
 *    "LLM never writes SPARQL" boundary is the one every provider shares.
 *
 * @see ./agent-policy.ts — model and retrieval budgets come from the shared
 *      policy; the step budget and tool choice do not apply to a single turn.
 */
import { createComponentLogger, Stopwatch } from '@ontology-search/core/logging'
import { getPrimaryDomain } from '@ontology-search/ontology/domain-registry'
import type { LlmStructuredResponse } from '@ontology-search/search/types'

import { runClaudeCodeStructured, toCliJsonSchema } from '../claude-code-cli.js'
import { buildRequestPrompt, getAgentContext } from './agent-context.js'
import { getAgentPolicy } from './agent-policy.js'
import { buildEmptyFallbackResponse } from './empty-fallback.js'
import { runSlotPipeline } from './run-slot-pipeline.js'
import { slotSubmissionSchema, SUBMIT_TOOL_NAME } from './tools.js'

const log = createComponentLogger('claude-code-agent')

/** The slot schema as the CLI takes it — derived once; the schema is static. */
const SLOT_SUBMISSION_CLI_SCHEMA = toCliJsonSchema(slotSubmissionSchema)

/**
 * Appended to the system prompt. The static core tells the model to call
 * `submit_slots`; in this transport the structured output is that call.
 */
export const STRUCTURED_SUBMISSION_NOTE =
  `In this session \`${SUBMIT_TOOL_NAME}\` is your structured output: return exactly the ` +
  'object you would pass to it. No lookup tools are available; rely on the schema context above.'

/**
 * Fill search slots from a natural-language query via Claude Code.
 *
 * Same options, same response and the same fallback as the other adapters;
 * a provider fault (no login, unknown model, missing binary) throws an
 * `AgentError` naming the fix.
 */
export async function runClaudeCodeAgent(
  naturalLanguageQuery: string,
  options?: { domain?: string; signal?: AbortSignal }
): Promise<LlmStructuredResponse> {
  const sw = new Stopwatch()
  const policy = getAgentPolicy()
  const targetDomain = options?.domain ?? (await getPrimaryDomain())

  const endSetup = sw.time('setup')
  const { vocabulary } = await getAgentContext()
  endSetup()

  // Same per-query prompt as the other adapters: static core + the schema
  // context retrieved for this query.
  const endRetrieval = sw.time('retrieval')
  const { prompt } = await buildRequestPrompt(naturalLanguageQuery, {
    signal: options?.signal,
    maxDomains: policy.retrieval.maxDomains,
    maxCards: policy.retrieval.maxCards,
    maxContextChars: policy.retrieval.maxContextChars,
  })
  endRetrieval()

  const endLlmCall = sw.time('llm-round-trip')
  const run = await runClaudeCodeStructured({
    model: policy.model,
    systemPrompt: `${prompt}\n\n${STRUCTURED_SUBMISSION_NOTE}`,
    userMessage: naturalLanguageQuery,
    jsonSchema: SLOT_SUBMISSION_CLI_SCHEMA,
    ...(options?.signal === undefined ? {} : { signal: options.signal }),
  })
  endLlmCall()

  const submission = slotSubmissionSchema.safeParse(run.structuredOutput)
  if (submission.success) {
    const response = await runSlotPipeline({
      submission: submission.data,
      vocabulary,
      targetDomain,
      sw,
      query: naturalLanguageQuery,
    })
    return { ...response, timings: sw.getTimings() }
  }

  // Claude Code validates against the JSON Schema itself, so this is rare; but
  // the Zod schema is the canonical gate, and a miss degrades exactly like a
  // missing submission on the other adapters.
  log.info('No valid structured submission — fallback fired', {
    numTurns: run.numTurns,
    issues: submission.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  })
  const fallback = await buildEmptyFallbackResponse(naturalLanguageQuery, vocabulary)
  return { ...fallback, timings: sw.getTimings() }
}
