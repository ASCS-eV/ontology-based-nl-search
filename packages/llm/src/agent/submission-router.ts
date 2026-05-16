/**
 * Submission router for the Copilot SDK persistent session.
 *
 * The Copilot SDK exposes a single global tool handler per session, so the
 * `submit_slots` callback cannot carry per-request context on its own. We
 * resolve this by embedding a unique `requestToken` in every request's user
 * prompt and requiring the LLM to echo it as a top-level property of the
 * tool call. This router maps tokens back to the in-flight request callback
 * by **exact match** — never by recency — eliminating cross-request races
 * under concurrent SSE clients.
 *
 * @see packages/llm/src/agent/copilot-agent.ts — consumer
 */

import { z } from 'zod'

/**
 * The shape received from the LLM via the `submit_slots` tool call.
 * `requestToken` is consumed by the router and stripped before the
 * remaining `Submission` payload reaches the per-request callback.
 */
export const submissionSchema = z.object({
  requestToken: z.string().min(1),
  slots: z.object({
    domains: z.array(z.string()).optional(),
    filters: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
    ranges: z
      .record(z.string(), z.object({ min: z.number().optional(), max: z.number().optional() }))
      .optional(),
    location: z
      .object({
        country: z.union([z.string(), z.array(z.string())]).optional(),
        state: z.union([z.string(), z.array(z.string())]).optional(),
        region: z.union([z.string(), z.array(z.string())]).optional(),
        city: z.union([z.string(), z.array(z.string())]).optional(),
      })
      .optional(),
    license: z.string().optional(),
  }),
  interpretation: z.object({
    summary: z.string(),
    mappedTerms: z.array(
      z.object({
        input: z.string(),
        mapped: z.string(),
        confidence: z.enum(['high', 'medium', 'low']),
        property: z.string().optional(),
      })
    ),
  }),
  gaps: z.array(
    z.object({
      term: z.string(),
      reason: z.string(),
      suggestions: z.array(z.string()).optional(),
    })
  ),
})

type ParsedSubmission = z.infer<typeof submissionSchema>

/** Submission payload delivered to per-request callbacks (token stripped). */
export type Submission = Omit<ParsedSubmission, 'requestToken'>

export type RouteResult =
  | { ok: true }
  | { ok: false; reason: 'malformed' | 'unknown_token'; details?: string }

export class SubmissionRouter {
  private readonly pending = new Map<string, (submission: Submission) => void>()

  /**
   * Register a per-request callback. Returns an unregister function the
   * caller must invoke (e.g. in a `finally` block) so cancelled or completed
   * requests do not linger in the routing table.
   */
  register(token: string, callback: (submission: Submission) => void): () => void {
    if (this.pending.has(token)) {
      throw new Error(`SubmissionRouter: token already registered (${token})`)
    }
    this.pending.set(token, callback)
    return () => {
      this.pending.delete(token)
    }
  }

  /**
   * Parse raw tool-call params, look up the registered callback by exact
   * token, and deliver the stripped submission. Returns a structured result
   * the tool handler can surface back to the SDK.
   */
  route(params: unknown): RouteResult {
    const parsed = submissionSchema.safeParse(params)
    if (!parsed.success) {
      return { ok: false, reason: 'malformed', details: parsed.error.message }
    }
    const { requestToken, ...submission } = parsed.data
    const callback = this.pending.get(requestToken)
    if (!callback) {
      return { ok: false, reason: 'unknown_token', details: requestToken }
    }
    callback(submission)
    return { ok: true }
  }

  /** Number of in-flight requests. Exposed for tests and observability. */
  size(): number {
    return this.pending.size
  }
}

/**
 * Render the per-request token directive that the LLM must echo back as
 * `submit_slots.requestToken`. Kept here so the producer and the schema stay
 * co-located.
 */
export function renderTokenDirective(token: string): string {
  return `[request_token: ${token}] — echo this verbatim as submit_slots.requestToken`
}
