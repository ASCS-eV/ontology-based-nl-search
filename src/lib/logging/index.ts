/**
 * Structured logging and observability utilities.
 * Provides request-scoped logging with request IDs for traceability.
 */

export interface LogContext {
  requestId: string
  query?: string
  [key: string]: unknown
}

export interface TimingEntry {
  stage: string
  durationMs: number
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  requestId: string
  data?: Record<string, unknown>
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry)
}

/** Generate a short unique request ID */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Structured logger bound to a request context.
 * All log entries include requestId for correlation.
 */
export class RequestLogger {
  private timings: TimingEntry[] = []
  private startTime: number

  constructor(private context: LogContext) {
    this.startTime = performance.now()
  }

  info(message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      requestId: this.context.requestId,
      data: { ...this.context, ...data },
    }
    // Use console.info in production (captured by hosting platform)
    console.info(formatLog(entry)) // eslint-disable-line no-console
  }

  warn(message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'warn',
      message,
      timestamp: new Date().toISOString(),
      requestId: this.context.requestId,
      data: { ...this.context, ...data },
    }
    console.warn(formatLog(entry))
  }

  error(message: string, error?: unknown, data?: Record<string, unknown>): void {
    const errorData =
      error instanceof Error
        ? { errorMessage: error.message, errorStack: error.stack }
        : { errorMessage: String(error) }

    const entry: LogEntry = {
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      requestId: this.context.requestId,
      data: { ...this.context, ...errorData, ...data },
    }
    console.error(formatLog(entry))
  }

  /** Record a timing for a stage */
  time(stage: string): () => void {
    const start = performance.now()
    return () => {
      const durationMs = Math.round(performance.now() - start)
      this.timings.push({ stage, durationMs })
    }
  }

  /** Get all recorded timings */
  getTimings(): TimingEntry[] {
    return [...this.timings]
  }

  /** Get total elapsed time since logger creation */
  getTotalMs(): number {
    return Math.round(performance.now() - this.startTime)
  }
}
