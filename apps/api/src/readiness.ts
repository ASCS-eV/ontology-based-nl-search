/**
 * Process-wide warmup readiness, shared between the startup sequence
 * (`index.ts`, which runs `warmup()`) and the `/health` route (`app.ts`,
 * defined as a singleton at import time). Holding it in a tiny module avoids
 * threading the result through the Hono app constructor while still letting
 * `/health` report the real state.
 */
import type { WarmupResult } from './warmup.js'

let readiness: WarmupResult | null = null

/** Record the warmup outcome. Called once, after `warmup()` resolves. */
export function setReadiness(result: WarmupResult): void {
  readiness = result
}

/** The recorded warmup outcome, or `null` while warmup is still running. */
export function getReadiness(): WarmupResult | null {
  return readiness
}
