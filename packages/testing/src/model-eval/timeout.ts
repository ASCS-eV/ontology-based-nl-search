/**
 * Abort-aware operation timeout shared by every runner in the harness.
 *
 * The operation receives the combined signal so it can cancel its own I/O,
 * and the race rejects as soon as either the deadline or the caller's abort
 * fires — a runner that only awaited the operation would keep a hung endpoint
 * alive for the whole run.
 */
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parent?: AbortSignal
): Promise<T> {
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = parent ? AbortSignal.any([parent, timeout]) : timeout
  if (signal.aborted) throw signal.reason
  let rejectOnAbort: ((reason: unknown) => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = reject
  })
  const onAbort = () => rejectOnAbort?.(signal.reason)
  signal.addEventListener('abort', onAbort, { once: true })
  try {
    return await Promise.race([operation(signal), aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}
