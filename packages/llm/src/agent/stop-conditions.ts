/**
 * Stop conditions shared by the forced-submission tool loops: search's
 * `submit_slots` and authoring's `submit_scene`.
 */

interface StepWithResults {
  toolResults?: ReadonlyArray<{ toolName: string }>
}

/**
 * Stop once the submission tool has been ACCEPTED: a tool result, not merely a
 * call. A call whose arguments the schema rejects is still a tool call, so the
 * SDK's `hasToolCall` ended the run on it and threw the model's next move away.
 * Here the SDK answers that call with the validation error as its result and
 * the model gets another step to correct it — what the Copilot adapter's
 * `{ accepted: false, error }` reply already allows.
 */
export function hasAcceptedSubmission(toolName: string) {
  return ({ steps }: { steps: ReadonlyArray<StepWithResults> }): boolean =>
    steps.at(-1)?.toolResults?.some((result) => result.toolName === toolName) ?? false
}
