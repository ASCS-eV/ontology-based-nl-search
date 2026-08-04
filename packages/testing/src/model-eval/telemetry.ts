import { type ChildProcessByStdio, spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { arch, cpus, platform, release, totalmem } from 'node:os'
import type { Readable } from 'node:stream'

import type { z } from 'zod'

import type { CoverageStateSchema, HardwareInventory } from './types.js'

type CoverageState = z.infer<typeof CoverageStateSchema>

/**
 * Another tenant's allocation above this margin marks the sample as sharing
 * the device. Small allocations (a display server, a monitoring agent) are
 * expected on a workstation and do not invalidate a measurement.
 */
const COMPETING_VRAM_MARGIN_BYTES = 512 * 1024 * 1024

export interface TelemetryResult {
  peakRssBytes: number | null
  peakVramBytes: number | null
  peakGpuUtilizationPercent: number | null
  peakGpuTemperatureC: number | null
  peakGpuPowerW: number | null
  cpuTimeMs: number | null
  readBytes: number | null
  writeBytes: number | null
  swapGrowthBytes: number | null
  competingGpuLoad: boolean | null
  processTreeCoverage: CoverageState
  gpuCoverage: CoverageState
  samples: number
  serverRestarted: boolean
}

export interface ProcStat {
  pid: number
  ppid: number
  userJiffies: number
  systemJiffies: number
}

export interface ProcStatus {
  rssBytes: number
  swapBytes: number
}

export interface ProcIo {
  readBytes: number
  writeBytes: number
}

export function parseProcStat(line: string): ProcStat {
  const open = line.indexOf('(')
  const close = line.lastIndexOf(')')
  if (open <= 0 || close <= open) throw new Error('Malformed /proc stat line')
  const pid = Number(line.slice(0, open).trim())
  const rest = line
    .slice(close + 1)
    .trim()
    .split(/\s+/)
  const ppid = Number(rest[1])
  const userJiffies = Number(rest[11])
  const systemJiffies = Number(rest[12])
  if (![pid, ppid, userJiffies, systemJiffies].every(Number.isFinite)) {
    throw new Error('Malformed numeric field in /proc stat line')
  }
  return { pid, ppid, userJiffies, systemJiffies }
}

export function parseProcStatus(text: string): ProcStatus {
  return {
    rssBytes: kibField(text, 'VmRSS'),
    swapBytes: kibField(text, 'VmSwap'),
  }
}

export function parseProcIo(text: string): ProcIo {
  return {
    readBytes: byteField(text, 'read_bytes'),
    writeBytes: byteField(text, 'write_bytes'),
  }
}

export function parseNvidiaCsv(line: string): {
  uuid: string
  model: string
  vramTotalBytes: number
  vramUsedBytes: number
  utilizationPercent: number
  temperatureC: number
  powerW: number
} {
  const fields = line.split(',').map((value) => value.trim())
  if (fields.length !== 7) throw new Error(`Malformed nvidia-smi CSV: ${line}`)
  const number = (index: number): number => {
    const parsed = Number(fields[index])
    if (!Number.isFinite(parsed)) throw new Error(`Malformed nvidia-smi number: ${fields[index]}`)
    return parsed
  }
  return {
    uuid: fields[0]!,
    model: fields[1]!,
    vramTotalBytes: number(2) * 1024 * 1024,
    vramUsedBytes: number(3) * 1024 * 1024,
    utilizationPercent: number(4),
    temperatureC: number(5),
    powerW: number(6),
  }
}

/**
 * One row of `--query-compute-apps`: the memory a SPECIFIC process holds on a
 * specific device. Device-level `memory.used` counts every tenant, so it
 * cannot be attributed to the candidate under test.
 */
export function parseNvidiaComputeAppCsv(line: string): {
  uuid: string
  pid: number
  usedMemoryBytes: number
} {
  const fields = line.split(',').map((value) => value.trim())
  if (fields.length !== 3) throw new Error(`Malformed nvidia-smi compute-app CSV: ${line}`)
  const pid = Number(fields[1])
  const usedMiB = Number(fields[2])
  if (!Number.isInteger(pid) || !Number.isFinite(usedMiB)) {
    throw new Error(`Malformed nvidia-smi compute-app number: ${line}`)
  }
  return { uuid: fields[0]!, pid, usedMemoryBytes: usedMiB * 1024 * 1024 }
}

export function collectHardwareInventory(serverPid?: number): HardwareInventory {
  const memory = readOptional('/proc/meminfo')
  const gpuProbe = probeGpus()
  return {
    platform: platform(),
    release: release(),
    architecture: arch(),
    container: detectContainer(),
    wsl: /microsoft/i.test(`${release()} ${readOptional('/proc/version')}`),
    cpuModel: cpus()[0]?.model ?? 'unknown',
    logicalCores: Math.max(1, cpus().length),
    ramBytes: totalmem(),
    swapBytes: memory ? kibField(memory, 'SwapTotal') : 0,
    cgroupMemoryLimitBytes: readCgroupLimit(),
    gpu: gpuProbe.gpus,
    coverage: {
      processTree:
        platform() !== 'linux'
          ? 'platform-unsupported'
          : serverPid
            ? canReadProc(serverPid)
            : 'client-only',
      gpu: serverPid ? gpuProbe.coverage : 'client-only',
    },
  }
}

export class TelemetrySampler {
  private readonly processSampler: ProcessTreeSampler
  private readonly gpuSampler: NvidiaSampler

  constructor(serverPid?: number, intervalMs = 250) {
    this.processSampler = new ProcessTreeSampler(serverPid, intervalMs)
    // The GPU sampler attributes VRAM by PID, so it needs the live process
    // tree: inference servers fork workers that hold the allocations.
    this.gpuSampler = new NvidiaSampler(
      serverPid === undefined ? undefined : () => this.processSampler.currentPids(),
      intervalMs
    )
  }

  start(): void {
    this.processSampler.start()
    this.gpuSampler.start()
  }

  async stop(): Promise<TelemetryResult> {
    const process = this.processSampler.stop()
    const gpu = await this.gpuSampler.stop()
    return {
      peakRssBytes: process.peakRssBytes,
      peakVramBytes: gpu.peakVramBytes,
      peakGpuUtilizationPercent: gpu.peakUtilizationPercent,
      peakGpuTemperatureC: gpu.peakTemperatureC,
      peakGpuPowerW: gpu.peakPowerW,
      cpuTimeMs: process.cpuTimeMs,
      readBytes: process.readBytes,
      writeBytes: process.writeBytes,
      swapGrowthBytes: process.swapGrowthBytes,
      competingGpuLoad: gpu.competingGpuLoad,
      processTreeCoverage: process.coverage,
      gpuCoverage: gpu.coverage,
      samples: minNonZero(process.samples, gpu.samples),
      serverRestarted: process.serverRestarted,
    }
  }
}

class ProcessTreeSampler {
  private timer?: NodeJS.Timeout
  private coverage: CoverageState
  private samples = 0
  private pids: Set<number> = new Set()
  private peakRssBytes = 0
  private peakSwapBytes = 0
  private initialSwapBytes: number | null = null
  private initialCpuJiffies: number | null = null
  private latestCpuJiffies = 0
  private initialReadBytes: number | null = null
  private latestReadBytes = 0
  private initialWriteBytes: number | null = null
  private latestWriteBytes = 0
  private serverRestarted = false

  constructor(
    private readonly rootPid?: number,
    private readonly intervalMs = 250
  ) {
    this.coverage =
      platform() !== 'linux' ? 'platform-unsupported' : rootPid ? 'complete' : 'client-only'
  }

  start(): void {
    if (this.coverage !== 'complete') return
    this.sample()
    this.timer = setInterval(() => this.sample(), this.intervalMs)
    this.timer.unref()
  }

  /** PIDs most recently observed in the server's process tree. */
  currentPids(): Set<number> {
    return this.pids
  }

  stop(): {
    peakRssBytes: number | null
    cpuTimeMs: number | null
    readBytes: number | null
    writeBytes: number | null
    swapGrowthBytes: number | null
    coverage: CoverageState
    samples: number
    serverRestarted: boolean
  } {
    if (this.timer) clearInterval(this.timer)
    return {
      peakRssBytes: this.samples > 0 ? this.peakRssBytes : null,
      cpuTimeMs:
        this.initialCpuJiffies === null
          ? null
          : (Math.max(0, this.latestCpuJiffies - this.initialCpuJiffies) * 1_000) /
            clockTicksPerSecond(),
      readBytes:
        this.initialReadBytes === null
          ? null
          : Math.max(0, this.latestReadBytes - this.initialReadBytes),
      writeBytes:
        this.initialWriteBytes === null
          ? null
          : Math.max(0, this.latestWriteBytes - this.initialWriteBytes),
      swapGrowthBytes:
        this.initialSwapBytes === null
          ? null
          : Math.max(0, this.peakSwapBytes - this.initialSwapBytes),
      coverage: this.coverage,
      samples: this.samples,
      serverRestarted: this.serverRestarted,
    }
  }

  private sample(): void {
    try {
      if (!this.rootPid || !existsSync(`/proc/${this.rootPid}`)) {
        this.serverRestarted = true
        this.coverage = this.samples === 0 ? 'partial' : this.coverage
        return
      }
      const stats = readProcessTree(this.rootPid)
      if (stats.length === 0) {
        this.coverage = 'partial'
        return
      }
      this.pids = new Set(stats.map((value) => value.stat.pid))
      const rss = stats.reduce((total, value) => total + value.status.rssBytes, 0)
      const swap = stats.reduce((total, value) => total + value.status.swapBytes, 0)
      const cpu = stats.reduce(
        (total, value) => total + value.stat.userJiffies + value.stat.systemJiffies,
        0
      )
      const read = stats.reduce((total, value) => total + value.io.readBytes, 0)
      const write = stats.reduce((total, value) => total + value.io.writeBytes, 0)
      this.initialSwapBytes ??= swap
      this.initialCpuJiffies ??= cpu
      this.initialReadBytes ??= read
      this.initialWriteBytes ??= write
      this.peakRssBytes = Math.max(this.peakRssBytes, rss)
      this.peakSwapBytes = Math.max(this.peakSwapBytes, swap)
      this.latestCpuJiffies = cpu
      this.latestReadBytes = read
      this.latestWriteBytes = write
      this.samples += 1
    } catch (error) {
      this.coverage =
        error instanceof Error && 'code' in error && error.code === 'EACCES'
          ? 'permission-denied'
          : 'partial'
    }
  }
}

/**
 * GPU telemetry from two `nvidia-smi` streams.
 *
 * Device metrics (utilization, temperature, power) are inherently per-device.
 * VRAM is not: `memory.used` is the sum over every tenant, so reporting it as
 * the candidate's footprint credits it with allocations it never made. Peak
 * VRAM therefore comes from `--query-compute-apps`, summed over the PIDs in
 * the server's process tree — which is also correct under tensor parallelism,
 * where the true footprint is the sum across devices rather than any single
 * device's maximum.
 */
class NvidiaSampler {
  private deviceChild?: ChildProcessByStdio<null, Readable, Readable>
  private appsChild?: ChildProcessByStdio<null, Readable, Readable>
  private coverage: CoverageState
  private cycles = 0
  private peakAttributedVramBytes = 0
  private peakDeviceVramBytes = 0
  private attributedAnyRow = false
  private peakUtilizationPercent = 0
  private peakTemperatureC = 0
  private peakPowerW = 0
  private deviceBuffer = ''
  private appsBuffer = ''
  private deviceCycle = new Map<string, number>()
  private appsCycle = new Map<string, number>()
  private seenDeviceUuids = new Set<string>()

  constructor(
    private readonly resolvePids: (() => Set<number>) | undefined,
    private readonly intervalMs = 250
  ) {
    this.coverage =
      platform() === 'darwin'
        ? 'metal-unsupported'
        : existsSync('/dev/kfd')
          ? 'rocm-unsupported'
          : resolvePids
            ? 'complete'
            : 'client-only'
  }

  start(): void {
    if (this.coverage !== 'complete') return
    this.deviceChild = this.spawnQuery(
      '--query-gpu=uuid,name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw',
      (chunk) => this.consumeDevice(chunk)
    )
    this.appsChild = this.spawnQuery('--query-compute-apps=gpu_uuid,pid,used_gpu_memory', (chunk) =>
      this.consumeApps(chunk)
    )
  }

  async stop(): Promise<{
    peakVramBytes: number | null
    peakUtilizationPercent: number | null
    peakTemperatureC: number | null
    peakPowerW: number | null
    competingGpuLoad: boolean | null
    coverage: CoverageState
    samples: number
  }> {
    await Promise.all([terminate(this.deviceChild), terminate(this.appsChild)])
    const measured = this.cycles > 0
    // Without a single attributed row we cannot tell a CPU-only server from a
    // failed attribution, so the coverage state says "partial" rather than
    // reporting a confident zero.
    const coverage: CoverageState =
      !measured && this.coverage === 'complete'
        ? 'tool-missing'
        : measured && this.coverage === 'complete' && !this.attributedAnyRow
          ? 'partial'
          : this.coverage
    return {
      peakVramBytes: this.attributedAnyRow ? this.peakAttributedVramBytes : null,
      peakUtilizationPercent: measured ? this.peakUtilizationPercent : null,
      peakTemperatureC: measured ? this.peakTemperatureC : null,
      peakPowerW: measured ? this.peakPowerW : null,
      competingGpuLoad: this.competingGpuLoad(),
      coverage,
      samples: this.cycles,
    }
  }

  /**
   * Another tenant is present when the device holds materially more memory
   * than this candidate's processes account for.
   */
  private competingGpuLoad(): boolean | null {
    if (this.cycles === 0 || !this.attributedAnyRow) return null
    return this.peakDeviceVramBytes - this.peakAttributedVramBytes > COMPETING_VRAM_MARGIN_BYTES
  }

  private spawnQuery(
    query: string,
    onChunk: (chunk: string) => void
  ): ChildProcessByStdio<null, Readable, Readable> {
    const child = spawn(
      'nvidia-smi',
      [query, '--format=csv,noheader,nounits', `--loop-ms=${this.intervalMs}`],
      { shell: false, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    child.on('error', (error) => {
      this.coverage =
        (error as NodeJS.ErrnoException).code === 'EACCES' ? 'permission-denied' : 'tool-missing'
    })
    child.stdout.on('data', (chunk: Buffer) => onChunk(chunk.toString('utf8')))
    child.stderr.on('data', (chunk: Buffer) => {
      if (/permission/i.test(chunk.toString('utf8'))) this.coverage = 'permission-denied'
    })
    return child
  }

  private consumeDevice(chunk: string): void {
    this.deviceBuffer += chunk
    const lines = this.deviceBuffer.split(/\r?\n/)
    this.deviceBuffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const sample = parseNvidiaCsv(line)
        // One poll emits one row per device. Counting rows would multiply the
        // sample count by the number of GPUs, so a cycle closes when a device
        // repeats.
        if (this.deviceCycle.has(sample.uuid)) this.closeDeviceCycle()
        this.deviceCycle.set(sample.uuid, sample.vramUsedBytes)
        this.seenDeviceUuids.add(sample.uuid)
        this.peakUtilizationPercent = Math.max(
          this.peakUtilizationPercent,
          sample.utilizationPercent
        )
        this.peakTemperatureC = Math.max(this.peakTemperatureC, sample.temperatureC)
        this.peakPowerW = Math.max(this.peakPowerW, sample.powerW)
        if (this.deviceCycle.size === this.seenDeviceUuids.size) this.closeDeviceCycle()
      } catch {
        this.coverage = 'partial'
      }
    }
  }

  private closeDeviceCycle(): void {
    if (this.deviceCycle.size === 0) return
    const total = [...this.deviceCycle.values()].reduce((sum, value) => sum + value, 0)
    this.peakDeviceVramBytes = Math.max(this.peakDeviceVramBytes, total)
    this.cycles += 1
    this.deviceCycle.clear()
  }

  private consumeApps(chunk: string): void {
    this.appsBuffer += chunk
    const lines = this.appsBuffer.split(/\r?\n/)
    this.appsBuffer = lines.pop() ?? ''
    const pids = this.resolvePids?.() ?? new Set<number>()
    for (const line of lines) {
      const trimmed = line.trim()
      // A poll with no compute processes prints a placeholder; it closes the
      // cycle without contributing memory.
      if (!trimmed || /no running processes/i.test(trimmed)) {
        this.closeAppsCycle()
        continue
      }
      try {
        const row = parseNvidiaComputeAppCsv(trimmed)
        if (!pids.has(row.pid)) continue
        const key = `${row.uuid}:${row.pid}`
        if (this.appsCycle.has(key)) this.closeAppsCycle()
        this.appsCycle.set(key, row.usedMemoryBytes)
        this.attributedAnyRow = true
      } catch {
        this.coverage = 'partial'
      }
    }
    this.closeAppsCycle()
  }

  private closeAppsCycle(): void {
    if (this.appsCycle.size === 0) return
    // Sum, not max: under tensor parallelism the candidate's footprint is
    // spread across devices and every shard counts.
    const total = [...this.appsCycle.values()].reduce((sum, value) => sum + value, 0)
    this.peakAttributedVramBytes = Math.max(this.peakAttributedVramBytes, total)
    this.appsCycle.clear()
  }
}

async function terminate(child?: ChildProcessByStdio<null, Readable, Readable>): Promise<void> {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise<void>((resolve) => child.once('close', () => resolve())),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 1_000).unref()
    }),
  ])
  if (child.exitCode === null) child.kill('SIGKILL')
}

function readProcessTree(rootPid: number): Array<{
  stat: ProcStat
  status: ProcStatus
  io: ProcIo
}> {
  const all = new Map<number, ProcStat>()
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue
    try {
      const stat = parseProcStat(readFileSync(`/proc/${entry}/stat`, 'utf8'))
      all.set(stat.pid, stat)
    } catch {
      // Processes may exit between readdir and read; that is normal sampling churn.
    }
  }
  const selected = new Set([rootPid])
  let changed = true
  while (changed) {
    changed = false
    for (const stat of all.values()) {
      if (selected.has(stat.ppid) && !selected.has(stat.pid)) {
        selected.add(stat.pid)
        changed = true
      }
    }
  }
  return [...selected].flatMap((pid) => {
    const stat = all.get(pid)
    if (!stat) return []
    try {
      return [
        {
          stat,
          status: parseProcStatus(readFileSync(`/proc/${pid}/status`, 'utf8')),
          io: parseProcIo(readFileSync(`/proc/${pid}/io`, 'utf8')),
        },
      ]
    } catch {
      return []
    }
  })
}

function probeGpus(): {
  gpus: HardwareInventory['gpu']
  coverage: CoverageState
} {
  if (platform() === 'darwin') return { gpus: [], coverage: 'metal-unsupported' }
  if (existsSync('/dev/kfd')) return { gpus: [], coverage: 'rocm-unsupported' }
  const result = spawnSync(
    'nvidia-smi',
    ['--query-gpu=uuid,name,memory.total', '--format=csv,noheader,nounits'],
    { encoding: 'utf8', shell: false }
  )
  if (result.error) {
    return {
      gpus: [],
      coverage:
        (result.error as NodeJS.ErrnoException).code === 'EACCES'
          ? 'permission-denied'
          : 'tool-missing',
    }
  }
  if (result.status !== 0) {
    return {
      gpus: [],
      coverage: /permission/i.test(result.stderr) ? 'permission-denied' : 'tool-missing',
    }
  }
  const gpus = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const fields = line.split(',').map((value) => value.trim())
      const memoryMiB = Number(fields[2])
      return fields.length === 3 && Number.isFinite(memoryMiB)
        ? [{ uuid: fields[0]!, model: fields[1]!, vramTotalBytes: memoryMiB * 1024 * 1024 }]
        : []
    })
  return { gpus, coverage: gpus.length > 0 ? 'complete' : 'partial' }
}

function detectContainer(): string | null {
  if (existsSync('/.dockerenv')) return 'docker'
  const cgroup = readOptional('/proc/1/cgroup')
  if (/kubepods/i.test(cgroup)) return 'kubernetes'
  if (/docker|containerd/i.test(cgroup)) return 'container'
  return null
}

function readCgroupLimit(): number | null {
  for (const path of ['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']) {
    const value = readOptional(path).trim()
    if (!value || value === 'max') continue
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed < 2 ** 60) return parsed
  }
  return null
}

function canReadProc(pid: number): CoverageState {
  try {
    readFileSync(`/proc/${pid}/stat`, 'utf8')
    return 'complete'
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EACCES' ? 'permission-denied' : 'partial'
  }
}

function readOptional(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

function kibField(text: string, name: string): number {
  const match = text.match(new RegExp(`^${name}:\\s+(\\d+)\\s+kB$`, 'm'))
  return match ? Number(match[1]) * 1024 : 0
}

function byteField(text: string, name: string): number {
  const match = text.match(new RegExp(`^${name}:\\s+(\\d+)$`, 'm'))
  return match ? Number(match[1]) : 0
}

function minNonZero(...values: number[]): number {
  const nonZero = values.filter((value) => value > 0)
  return nonZero.length === 0 ? 0 : Math.min(...nonZero)
}

let cachedClockTicks: number | undefined

/**
 * Resolved on first use, not at import: a module-level `spawnSync` made every
 * consumer of this file — including `eval:models list` and each test file —
 * pay for a subprocess it may never need.
 */
function clockTicksPerSecond(): number {
  if (cachedClockTicks !== undefined) return cachedClockTicks
  const result = spawnSync('getconf', ['CLK_TCK'], { encoding: 'utf8', shell: false })
  const parsed = Number(result.stdout?.trim())
  cachedClockTicks = Number.isFinite(parsed) && parsed > 0 ? parsed : 100
  return cachedClockTicks
}
