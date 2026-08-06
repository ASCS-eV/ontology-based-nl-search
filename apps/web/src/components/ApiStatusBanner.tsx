import { useApiHealth } from '../hooks/useApiHealth'

/**
 * Surfaces a not-fully-working API at the top of every page.
 *
 * The API reports exactly what is wrong — no ontology, provider unreachable,
 * store missing a capability — and each of those messages already names the
 * command that fixes it. Without this banner they were only visible in the
 * server's terminal, so from the browser a broken setup was indistinguishable
 * from a query that matched nothing.
 *
 * Two severities, mirroring `/health`: errors mean the instance is degraded,
 * warnings mean something is unavailable (typically the LLM provider) while
 * the rest of the app still works.
 */
export function ApiStatusBanner() {
  const health = useApiHealth()
  if (!health) return null

  if (health.status === 'starting') {
    return (
      <Banner tone="info">
        <span className="font-medium">The API is still warming up.</span> Loading the ontology,
        indexes and validator — searches will work once it reports ready.
      </Banner>
    )
  }

  if (health.status === 'unreachable') {
    return (
      <Banner tone="error">
        <span className="font-medium">Cannot reach the API.</span> Start it with{' '}
        <Code tone="error">pnpm dev</Code>, and check that terminal for the reason it exited. If you
        moved it with <Code tone="error">API_PORT</Code>, restart the web server too so its proxy
        picks up the new port.
      </Banner>
    )
  }

  if (health.status === 'degraded') {
    return (
      <Banner tone="error">
        <span className="font-medium">
          The API started degraded — searches will not work properly.
        </span>
        <MessageList messages={[...health.errors, ...health.warnings]} />
      </Banner>
    )
  }

  if (health.warnings.length > 0) {
    return (
      <Banner tone="warning">
        <span className="font-medium">
          Natural-language search is unavailable — the rest of the app still works.
        </span>
        <MessageList messages={health.warnings} />
      </Banner>
    )
  }

  return null
}

function MessageList({ messages }: { messages: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-5">
      {messages.map((message) => (
        <li key={message} className="whitespace-pre-wrap">
          {message}
        </li>
      ))}
    </ul>
  )
}

type Tone = 'info' | 'warning' | 'error'

const PALETTE: Record<Tone, { banner: string; code: string }> = {
  info: { banner: 'border-blue-200 bg-blue-50 text-blue-800', code: 'bg-blue-100' },
  warning: { banner: 'border-amber-200 bg-amber-50 text-amber-800', code: 'bg-amber-100' },
  error: { banner: 'border-red-200 bg-red-50 text-red-800', code: 'bg-red-100' },
}

function Code({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <code className={`rounded px-1 py-0.5 font-mono text-xs ${PALETTE[tone].code}`}>
      {children}
    </code>
  )
}

function Banner({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-b px-4 py-2 text-sm ${PALETTE[tone].banner}`}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  )
}
