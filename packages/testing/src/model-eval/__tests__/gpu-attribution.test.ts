/**
 * VRAM must be attributed to the process under test.
 *
 * Regression: peak VRAM came from device-level `memory.used`, the sum over
 * every tenant, so another process's allocation was reported as the
 * candidate's footprint — the number the hardware-tier claim rests on.
 */
import { describe, expect, it } from 'vitest'

import { parseNvidiaComputeAppCsv, parseNvidiaCsv } from '../telemetry.js'

describe('nvidia-smi parsing', () => {
  it('reads per-process compute-app rows in MiB', () => {
    expect(parseNvidiaComputeAppCsv('GPU-abc, 4242, 8192')).toEqual({
      uuid: 'GPU-abc',
      pid: 4242,
      usedMemoryBytes: 8192 * 1024 * 1024,
    })
  })

  it('rejects malformed compute-app rows rather than scoring a wrong number', () => {
    expect(() => parseNvidiaComputeAppCsv('GPU-abc, 4242')).toThrow(/compute-app CSV/)
    expect(() => parseNvidiaComputeAppCsv('GPU-abc, not-a-pid, 8192')).toThrow(/compute-app number/)
  })

  it('still reads device rows for utilization, temperature and power', () => {
    const device = parseNvidiaCsv('GPU-abc, RTX 4090, 24564, 20480, 97, 71, 402.5')
    expect(device.vramTotalBytes).toBe(24564 * 1024 * 1024)
    expect(device.utilizationPercent).toBe(97)
    expect(device.powerW).toBe(402.5)
  })

  it('distinguishes device-wide usage from what one process holds', () => {
    // The device reports 20 GiB used; our process accounts for 8 GiB of it.
    // Reporting the device figure would credit the candidate with 12 GiB it
    // never allocated.
    const device = parseNvidiaCsv('GPU-abc, RTX 4090, 24564, 20480, 97, 71, 402.5')
    const ours = parseNvidiaComputeAppCsv('GPU-abc, 4242, 8192')
    expect(ours.usedMemoryBytes).toBeLessThan(device.vramUsedBytes)
  })
})
