import { type ChildProcess, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

import type { z } from 'zod'

import { redactSecrets } from './artifacts.js'
import { LaunchDescriptorSchema } from './types.js'

type LaunchDescriptor = z.infer<typeof LaunchDescriptorSchema>

export interface LaunchedServer {
  pid: number
  redactedCommand: string[]
  stop(): Promise<void>
}

export function readLaunchDescriptor(path: string): LaunchDescriptor {
  return LaunchDescriptorSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}

export async function launchServer(
  descriptor: LaunchDescriptor,
  signal?: AbortSignal
): Promise<LaunchedServer> {
  const parsed = LaunchDescriptorSchema.parse(descriptor)
  const child = spawn(parsed.executable, parsed.args, {
    shell: false,
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  if (!child.pid) throw new Error('Local model server did not provide a PID')

  const stop = () => stopChild(child, parsed.shutdownTimeoutMs)
  try {
    await waitForReadiness(parsed.readinessUrl, parsed.shutdownTimeoutMs, child, signal)
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
  throw new Error(`Timed out waiting for local model server readiness at ${url}`)
}

async function stopChild(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise<void>((resolve) => child.once('close', () => resolve())),
    delay(timeoutMs),
  ])
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await new Promise<void>((resolve) => child.once('close', () => resolve()))
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer)
          reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
        },
        { once: true }
      )
    }
  })
}
