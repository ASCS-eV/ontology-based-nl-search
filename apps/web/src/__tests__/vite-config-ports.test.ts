/**
 * @vitest-environment node
 *
 * Regression tests for how the dev server resolves its ports. Runs under the
 * node environment because loading the real Vite config pulls in esbuild,
 * which refuses to run under this app's default jsdom environment.
 *
 * Two silent misconfigurations lived here:
 *
 *   - the dev-server port was read from `process.env` only, so the `WEB_PORT`
 *     that `.env.example` tells operators to put in `.env.local` did nothing;
 *   - the `/api` proxy target was the literal `http://localhost:3003`, so
 *     moving the API with `API_PORT` left the UI proxying to a dead port and
 *     the browser reported only a failed fetch.
 *
 * The assertions use `process.env`, which `loadEnv` merges over the file, so
 * they hold whatever the developer's own `.env.local` contains.
 */
import { afterEach, describe, expect, it } from 'vitest'

import viteConfig from '../../vite.config'

interface ResolvedServer {
  port?: number
  proxy?: Record<string, { target?: string }>
}

async function resolveServer(): Promise<ResolvedServer> {
  const factory = viteConfig as unknown as (env: {
    mode: string
    command: string
  }) => Promise<{ server?: ResolvedServer }> | { server?: ResolvedServer }
  const resolved = await factory({ mode: 'development', command: 'serve' })
  return resolved.server ?? {}
}

const TOUCHED = ['WEB_PORT', 'API_PORT'] as const
const saved = new Map<string, string | undefined>()

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  saved.clear()
})

function setEnv(key: (typeof TOUCHED)[number], value: string): void {
  if (!saved.has(key)) saved.set(key, process.env[key])
  process.env[key] = value
}

describe('web dev-server port configuration', () => {
  it('takes the dev-server port from the environment', async () => {
    setEnv('WEB_PORT', '4112')
    expect((await resolveServer()).port).toBe(4112)
  })

  it('derives the /api proxy target from API_PORT', async () => {
    setEnv('API_PORT', '4111')
    expect((await resolveServer()).proxy?.['/api']?.target).toBe('http://localhost:4111')
  })

  it('falls back to the documented defaults when nothing is set', async () => {
    setEnv('WEB_PORT', '')
    setEnv('API_PORT', '')
    const server = await resolveServer()
    expect(server.port).toBe(5174)
    expect(server.proxy?.['/api']?.target).toBe('http://localhost:3003')
  })

  it('ignores a non-numeric port instead of listening on NaN', async () => {
    setEnv('WEB_PORT', 'not-a-port')
    expect((await resolveServer()).port).toBe(5174)
  })
})
