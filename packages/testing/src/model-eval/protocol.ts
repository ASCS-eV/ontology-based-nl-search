/**
 * Protocol conformance of a tool trace.
 *
 * A *protocol* error is something the model did: calling a tool that is not
 * registered, or emitting arguments the tool schema rejected. It is
 * deliberately distinct from a *transport* failure (timeout, refused
 * connection, HTTP 5xx), which says nothing about the model and must never be
 * scored as if it did — see `EvaluationSample.transportError`.
 */
import { AGENT_TOOL_NAMES, EVALUATION_MAX_AGENT_STEPS } from '@ontology-search/llm/evaluation'

export interface ToolTraceLike {
  step: number
  toolName: string
  output?: unknown
}

const REGISTERED_TOOLS: ReadonlySet<string> = new Set(AGENT_TOOL_NAMES)

/**
 * Classify one run's tool trace. `maxSteps` comes from the policy that was
 * actually evaluated, so the budget the scorer enforces cannot drift from the
 * budget the agent ran under.
 */
export function findProtocolErrors(
  calls: readonly ToolTraceLike[],
  maxSteps: number = EVALUATION_MAX_AGENT_STEPS
): string[] {
  const errors: string[] = []
  for (const call of calls) {
    if (!REGISTERED_TOOLS.has(call.toolName)) {
      errors.push(`Unknown tool "${call.toolName}"`)
    }
    if (call.step >= maxSteps) {
      errors.push(`Tool "${call.toolName}" exceeded the ${maxSteps}-step budget`)
    }
    if (call.output === undefined) {
      errors.push(`Tool "${call.toolName}" had no schema-valid result`)
    }
  }
  return errors
}
