/**
 * Structured logging and observability utilities.
 *
 * Features:
 * - Request-scoped logging with correlation IDs
 * - Structured JSON output (machine-parseable for log aggregators)
 * - Log-level filtering via LOG_LEVEL env variable
 * - Stage timing with nanosecond precision
 * - Silent mode in tests (unless LOG_LEVEL explicitly set)
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

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  requestId: string
  data?: Record<string, unknown>
}

function resolveLogLevel(): LogLevel {
  const explicit = process.env.LOG_LEVEL as LogLevel | undefined
  if (explicit && explicit in LOG_LEVEL_PRIORITY) return explicit

  // Silent in test unless explicitly enabled
  if (process.env.NODE_ENV === 'test') return 'silent'

  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

let activeLogLevel: LogLevel | null = null

function getLogLevel(): LogLevel {
  if (activeLogLevel === null) activeLogLevel = resolveLogLevel()
  return activeLogLevel
}

/** Override the log level programmatically (for testing) */
export function setLogLevel(level: LogLevel): void {
  activeLogLevel = level
}

/** Reset log level to environment-derived default */
export function resetLogLevel(): void {
  activeLogLevel = null
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[getLogLevel()]
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry)
}

/** Generate a unique request ID using cryptographic randomness */
export function generateRequestId(): string {
  return `req_${crypto.randomUUID()}`
}

/** HTTP header name for request correlation */
export const REQUEST_ID_HEADER = 'x-request-id'

/**
 * Structured logger bound to a request context.
 * All log entries include requestId for correlation across services.
 */
export class RequestLogger {
  private timings: TimingEntry[] = []
  private startTime: number
  readonly requestId: string

  private context: LogContext

  constructor(context: LogContext) {
    this.context = context
    this.requestId = context.requestId
    this.startTime = performance.now()
  }

  debug(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog('debug')) return
    this.emit('debug', message, data)
  }

  info(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog('info')) return
    this.emit('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    if (!shouldLog('warn')) return
    this.emit('warn', message, data)
  }

  error(message: string, error?: unknown, data?: Record<string, unknown>): void {
    if (!shouldLog('error')) return
    const errorData =
      error instanceof Error
        ? { errorMessage: error.message, errorStack: error.stack }
        : { errorMessage: String(error) }

    this.emit('error', message, { ...errorData, ...data })
  }

  /** Record a timing for a stage. Returns a stop function. */
  time(stage: string): () => void {
    const start = performance.now()
    return () => {
      const durationMs = Math.round(performance.now() - start)
      this.timings.push({ stage, durationMs })
      this.debug(`${stage} completed`, { durationMs })
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

  private emit(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: this.context.requestId,
      data: { ...this.context, ...data },
    }
    const formatted = formatLog(entry)
    switch (level) {
      case 'debug':
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
        console.error(formatted)
        break
    }
  }
}

/**
 * Module-level logger for non-request contexts (startup, background tasks).
 * Uses a fixed context with component identification.
 */
export function createComponentLogger(component: string): RequestLogger {
  return new RequestLogger({ requestId: `sys_${component}`, component })
}
