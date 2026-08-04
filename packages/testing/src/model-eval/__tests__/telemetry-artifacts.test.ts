import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  createRunArtifacts,
  readSamplesNdjson,
  redactEndpoint,
  redactSecrets,
} from '../artifacts.js'
import { performanceComparabilityReasons } from '../runner.js'
import { parseNvidiaCsv, parseProcIo, parseProcStat, parseProcStatus } from '../telemetry.js'

describe('telemetry and artifacts', () => {
  it('parses Linux process and NVIDIA telemetry', () => {
    const stat = ['42', '(server worker)', 'S', '1', ...Array(9).fill('0'), '11', '13']
    expect(parseProcStat(stat.join(' '))).toMatchObject({
      pid: 42,
      ppid: 1,
      userJiffies: 11,
      systemJiffies: 13,
    })
    expect(parseProcStatus('VmRSS:\t10 kB\nVmSwap:\t2 kB\n')).toEqual({
      rssBytes: 10 * 1024,
      swapBytes: 2 * 1024,
    })
    expect(parseProcIo('read_bytes: 12\nwrite_bytes: 34\n')).toEqual({
      readBytes: 12,
      writeBytes: 34,
    })
    expect(parseNvidiaCsv('GPU-1, RTX 4090, 24564, 1024, 77, 68, 320.5')).toMatchObject({
      uuid: 'GPU-1',
      vramUsedBytes: 1024 * 1024 * 1024,
      utilizationPercent: 77,
      temperatureC: 68,
      powerW: 320.5,
    })
  })

  it('marks partial collection, swap, restart, and competing load as incomparable', () => {
    expect(
      performanceComparabilityReasons({
        peakRssBytes: null,
        peakVramBytes: null,
        peakGpuUtilizationPercent: null,
        peakGpuTemperatureC: null,
        peakGpuPowerW: null,
        cpuTimeMs: null,
        readBytes: null,
        writeBytes: null,
        swapGrowthBytes: 1,
        competingGpuLoad: true,
        processTreeCoverage: 'partial',
        gpuCoverage: 'tool-missing',
        samples: 0,
        serverRestarted: true,
      })
    ).toEqual([
      'swap-growth',
      'server-restart',
      'process-tree-sampling-incomplete',
      'gpu-sampling-incomplete',
      'no-telemetry-samples',
      'competing-gpu-load',
    ])
  })

  it('rejects malformed NDJSON with a source line and redacts endpoint secrets', () => {
    const root = mkdtempSync(join(tmpdir(), 'model-eval-artifacts-'))
    const path = join(root, 'samples.ndjson')
    writeFileSync(path, '{}\nnot-json\n')

    expect(() => readSamplesNdjson(path)).toThrow(`${path}:1`)
    expect(redactEndpoint('http://user:pass@localhost:8000/v1?api_key=secret')).toBe(
      'http://localhost:8000/v1?api_key=%5BREDACTED%5D'
    )
    expect(redactSecrets(['server', '--api-key', 'secret', '--token=value'])).toEqual([
      'server',
      '--api-key',
      '[REDACTED]',
      '--token=[REDACTED]',
    ])
  })

  it('initializes every required run artifact path without overwriting a run', () => {
    const root = mkdtempSync(join(tmpdir(), 'model-eval-run-'))
    const artifacts = createRunArtifacts(root, 'test-run')

    expect(existsSync(artifacts.samplesPath)).toBe(true)
    expect(artifacts.manifestPath).toMatch(/manifest\.json$/)
    expect(artifacts.summaryPath).toMatch(/summary\.json$/)
    expect(artifacts.reportPath).toMatch(/report\.md$/)
    expect(() => createRunArtifacts(root, 'test-run')).toThrow()
  })
})
