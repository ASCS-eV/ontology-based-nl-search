/**
 * Proxy-dispatcher configuration tests.
 *
 * Node's `fetch` ignores `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` on its own,
 * so behind a corporate proxy every outbound call fails at the TCP level while
 * the same request succeeds from the shell. These pin the two properties that
 * matter: a dispatcher IS installed when a proxy is configured, and NOTHING is
 * installed otherwise — a direct-connection setup must never be rerouted.
 *
 * `setGlobalDispatcher` is mocked so the assertions observe the decision
 * without mutating this process's real dispatcher (which would silently
 * reroute every other test file in the run).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ installed: [] as unknown[] }))

vi.mock('undici', () => ({
  setGlobalDispatcher: vi.fn((d: unknown) => h.installed.push(d)),
  EnvHttpProxyAgent: class MockEnvHttpProxyAgent {},
}))

import { configureHttpProxyFromEnv } from '../proxy.js'

beforeEach(() => {
  h.installed = []
})

describe('configureHttpProxyFromEnv', () => {
  it('installs no dispatcher when no proxy variable is set', () => {
    const result = configureHttpProxyFromEnv({})

    expect(result.enabled).toBe(false)
    expect(result.sources).toEqual([])
    expect(h.installed).toHaveLength(0)
  })

  it('installs a dispatcher when HTTPS_PROXY is set', () => {
    const result = configureHttpProxyFromEnv({ HTTPS_PROXY: 'http://proxy.corp:8080' })

    expect(result.enabled).toBe(true)
    expect(result.sources).toContain('HTTPS_PROXY')
    expect(h.installed).toHaveLength(1)
  })

  it('honours the lowercase spelling', () => {
    const result = configureHttpProxyFromEnv({ https_proxy: 'http://proxy.corp:8080' })

    expect(result.enabled).toBe(true)
    expect(result.sources).toContain('https_proxy')
  })

  it('treats an empty or whitespace-only proxy variable as unset', () => {
    // An exported-but-empty var is common in CI images; routing through "" would
    // fail every request.
    expect(configureHttpProxyFromEnv({ HTTPS_PROXY: '' }).enabled).toBe(false)
    expect(configureHttpProxyFromEnv({ HTTP_PROXY: '   ' }).enabled).toBe(false)
    expect(h.installed).toHaveLength(0)
  })

  it('reports NO_PROXY so startup logs show the bypass list', () => {
    const result = configureHttpProxyFromEnv({
      HTTPS_PROXY: 'http://proxy.corp:8080',
      NO_PROXY: 'localhost,127.0.0.1',
    })

    expect(result.noProxy).toBe('localhost,127.0.0.1')
  })

  it('reports NO_PROXY even when no proxy is configured', () => {
    // The bypass list is diagnostic either way; surfacing it helps explain why
    // a given host was or was not routed.
    expect(configureHttpProxyFromEnv({ no_proxy: 'localhost' }).noProxy).toBe('localhost')
  })

  it('never returns a proxy VALUE, only variable names', () => {
    // Proxy URLs routinely embed credentials; the result feeds a startup log.
    const secret = 'http://user:pa55w0rd@proxy.corp:8080'
    const result = configureHttpProxyFromEnv({ HTTPS_PROXY: secret })

    expect(JSON.stringify(result)).not.toContain('pa55w0rd')
    expect(JSON.stringify(result)).not.toContain(secret)
  })
})
