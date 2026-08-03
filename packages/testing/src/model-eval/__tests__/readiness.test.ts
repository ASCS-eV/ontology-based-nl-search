/**
 * Server startup and shutdown are budgeted independently.
 *
 * Regression: readiness was polled against `shutdownTimeoutMs`, which the
 * schema caps at two minutes and the documented example set to ten seconds —
 * far below the load time of a real checkpoint, making `--launch` and the
 * whole `cold-load` profile unusable as documented.
 */
import { describe, expect, it } from 'vitest'

import { launchServer } from '../server.js'
import { LaunchDescriptorSchema } from '../types.js'

describe('launch descriptor budgets', () => {
  it('defaults readiness generously and keeps shutdown short', () => {
    const parsed = LaunchDescriptorSchema.parse({
      executable: 'true',
      args: [],
      readinessUrl: 'http://127.0.0.1:1/health',
      shutdownTimeoutMs: 10_000,
    })
    expect(parsed.shutdownTimeoutMs).toBe(10_000)
    // Loading a multi-billion-parameter checkpoint takes minutes.
    expect(parsed.readinessTimeoutMs).toBeGreaterThanOrEqual(60_000)
  })

  it('allows a readiness budget far above the shutdown cap', () => {
    const parsed = LaunchDescriptorSchema.parse({
      executable: 'true',
      args: [],
      readinessUrl: 'http://127.0.0.1:1/health',
      readinessTimeoutMs: 20 * 60_000,
      shutdownTimeoutMs: 5_000,
    })
    expect(parsed.readinessTimeoutMs).toBe(20 * 60_000)
    expect(parsed.readinessTimeoutMs).toBeGreaterThan(120_000)
  })

  it('honours the readiness budget rather than the shutdown budget', async () => {
    const started = performance.now()
    await expect(
      launchServer({
        // Stays alive but never serves the readiness URL.
        executable: 'sleep',
        args: ['30'],
        readinessUrl: 'http://127.0.0.1:1/health',
        readinessTimeoutMs: 1_500,
        shutdownTimeoutMs: 30_000,
      })
    ).rejects.toThrow(/Timed out after 1500 ms/)
    const elapsed = performance.now() - started
    // Bounded by readinessTimeoutMs, not by the much larger shutdown budget.
    expect(elapsed).toBeLessThan(15_000)
  }, 60_000)

  it('names the field to raise when startup is genuinely slow', async () => {
    await expect(
      launchServer({
        executable: 'sleep',
        args: ['30'],
        readinessUrl: 'http://127.0.0.1:1/health',
        readinessTimeoutMs: 1_000,
        shutdownTimeoutMs: 5_000,
      })
    ).rejects.toThrow(/readinessTimeoutMs/)
  }, 60_000)
})
