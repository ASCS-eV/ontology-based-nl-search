import { createServer } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import { withTimeout } from '../runner.js'
import { launchServer } from '../server.js'

const launched: Array<Awaited<ReturnType<typeof launchServer>>> = []

afterEach(async () => {
  await Promise.all(launched.splice(0).map((server) => server.stop()))
})

async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return port
}

describe('local server and runner lifecycle', () => {
  it('launches without a shell, waits for readiness, redacts secrets, and stops', async () => {
    const port = await freePort()
    const server = await launchServer({
      executable: process.execPath,
      args: [
        '-e',
        `require('node:http').createServer((_,res)=>{res.end('ok')}).listen(${port},'127.0.0.1')`,
        '--',
        '--api-key=secret',
      ],
      readinessUrl: `http://127.0.0.1:${port}/health`,
      shutdownTimeoutMs: 2_000,
    })
    launched.push(server)

    expect(server.pid).toBeGreaterThan(0)
    expect(server.redactedCommand).toContain('--api-key=[REDACTED]')
    await server.stop()
    launched.pop()
    expect(() => process.kill(server.pid, 0)).toThrow()
  })

  it('aborts readiness waits and terminates the child', async () => {
    const port = await freePort()
    const controller = new AbortController()
    setTimeout(() => controller.abort(new Error('cancelled')), 50)

    await expect(
      launchServer(
        {
          executable: process.execPath,
          args: ['-e', 'setInterval(() => {}, 1000)'],
          readinessUrl: `http://127.0.0.1:${port}/health`,
          shutdownTimeoutMs: 500,
        },
        controller.signal
      )
    ).rejects.toThrow('cancelled')
  })

  it('times out abort-aware runner operations and propagates parent aborts', async () => {
    const waitForAbort = (signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      })

    await expect(withTimeout(waitForAbort, 20)).rejects.toMatchObject({ name: 'TimeoutError' })

    const controller = new AbortController()
    controller.abort(new Error('parent cancelled'))
    await expect(withTimeout(waitForAbort, 10_000, controller.signal)).rejects.toThrow(
      'parent cancelled'
    )
  })
})
