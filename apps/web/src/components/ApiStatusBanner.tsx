import { useApiHealth } from '../hooks/useApiHealth'

/**
 * Surfaces a not-ready API at the top of every page.
 *
 * The API reports exactly why it is degraded — no ontology, provider
 * unreachable, store missing a capability — and each of those messages already
 * names the command that fixes it. Without this banner they were only visible
 * in the server's terminal, so from the browser a broken setup was
 * indistinguishable from a query that matched nothing.
 */
export function ApiStatusBanner() {
  const health = useApiHealth()
  if (!health || health.status === 'ok') return null

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
        <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs">pnpm dev</code>, and
        check that terminal for the reason it exited. If you moved it with{' '}
        <code className="rounded bg-red-100 px-1 py-0.5 font-mono text-xs">API_PORT</code>, restart
        the web server too so its proxy picks up the new port.
      </Banner>
    )
  }

  return (
    <Banner tone="error">
      <span className="font-medium">
        The API started degraded — searches will not work properly.
      </span>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">
        {health.errors.map((error) => (
          <li key={error} className="whitespace-pre-wrap">
            {error}
          </li>
        ))}
      </ul>
    </Banner>
  )
}

function Banner({ tone, children }: { tone: 'info' | 'error'; children: React.ReactNode }) {
  const palette =
    tone === 'info'
      ? 'border-blue-200 bg-blue-50 text-blue-800'
      : 'border-red-200 bg-red-50 text-red-800'
  return (
    <div role="status" aria-live="polite" className={`border-b px-4 py-2 text-sm ${palette}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  )
}
