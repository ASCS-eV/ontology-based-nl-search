import { type ChildProcess, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

import type { z } from 'zod'

import { redactSecrets } from './artifacts.js'
import { LaunchDescriptorSchema } from './types.js'

type LaunchDescriptor = z.infer<typeof LaunchDescriptorSchema>
/** Pre-default shape: `readinessTimeoutMs` may be omitted by the author. */
type LaunchDescriptorInput = z.input<typeof LaunchDescriptorSchema>

export interface LaunchedServer {
  pid: number
  redactedCommand: string[]
  stop(): Promise<void>
}

export function readLaunchDescriptor(path: string): LaunchDescriptor {
  return LaunchDescriptorSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export async function launchServer(
  descriptor: LaunchDescriptorInput,
  signal?: AbortSignal
): Promise<LaunchedServer> {
  const parsed = LaunchDescriptorSchema.parse(descriptor)
  const child = spawn(parsed.executable, parsed.args, {
    shell: false,
    stdio: ['ignore', 'inherit', 'inherit'],
    // Own process group. Inference servers fork workers that hold VRAM;
    // signalling only the direct child orphans them, and the next run then
    // fails to allocate on a GPU that looks free.
    detached: true,
  })
  if (!child.pid) throw new Error('Local model server did not provide a PID')

  const stop = () => stopChild(child, parsed.shutdownTimeoutMs)
  try {
    await waitForReadiness(parsed.readinessUrl, parsed.readinessTimeoutMs, child, signal)
  } catch (error) {
    await stop()
    throw error
  }

  return {
    pid: child.pid,
    redactedCommand: redactSecrets([parsed.executable, ...parsed.args]),
    stop,
  }
}

async function waitForReadiness(
  url: string,
  timeoutMs: number,
  child: ChildProcess,
  signal?: AbortSignal
): Promise<void> {
  const deadline = performance.now() + timeoutMs
  while (performance.now() < deadline) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
    if (child.exitCode !== null) {
      throw new Error(`Local model server exited before readiness (code ${child.exitCode})`)
    }
    try {
      const response = await fetch(url, { signal })
      if (response.ok) return
    } catch (error) {
      if (signal?.aborted) throw error
    }
    await delay(250, signal)
  }
  throw new Error(
    `Timed out after ${timeoutMs} ms waiting for local model server readiness at ${url}. ` +
      `Raise "readinessTimeoutMs" in the launch descriptor if the model needs longer to load.`
  )
}

async function stopChild(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()))
  signalTree(child, 'SIGTERM')
  await Promise.race([closed, delay(timeoutMs)])
  if (child.exitCode === null && child.signalCode === null) {
    signalTree(child, 'SIGKILL')
    await closed
  }
}

/**
 * Signal the whole process group when we started one, so forked inference
 * workers die with their parent. Falls back to the direct child if the group
 * is already gone.
 */
function signalTree(child: ChildProcess, signal: NodeJS.Signals): void {
  try {
    if (child.pid !== undefined) process.kill(-child.pid, signal)
    else child.kill(signal)
  } catch {
    // ESRCH: the group exited between the check and the signal. Nothing to do.
    try {
      child.kill(signal)
    } catch {
      // Already reaped.
    }
  }
}

/**
 * Sleep, rejecting on abort. The listener is always removed — an earlier
 * revision attached one per readiness poll and accumulated hundreds of live
 * listeners on the run signal over a long model load.
 */
function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
