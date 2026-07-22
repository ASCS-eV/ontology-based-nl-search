import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

import { expect } from 'vitest'
import {
  createMessageConnection,
  type MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node'

const packageRoot = fileURLToPath(new URL('../..', import.meta.url))

export async function exerciseServer(cli: string, vocabularyFile: string): Promise<void> {
  const child = spawn(process.execPath, [cli, '--stdio', '--vocabulary-file', vocabularyFile], {
    cwd: packageRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const stderr: Buffer[] = []
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
  const connection = createMessageConnection(
    new StreamMessageReader(child.stdout),
    new StreamMessageWriter(child.stdin)
  )
  const diagnostics = notificationQueue(connection, 'textDocument/publishDiagnostics')
  connection.listen()

  try {
    const initialized = await withTimeout(
      connection.sendRequest('initialize', {
        processId: process.pid,
        rootUri: null,
        capabilities: {
          general: { positionEncodings: ['utf-16'] },
          textDocument: {
            hover: { contentFormat: ['markdown', 'plaintext'] },
            documentSymbol: { hierarchicalDocumentSymbolSupport: true },
          },
        },
      }) as Promise<{
        capabilities: Record<string, unknown>
      }>,
      'initialize'
    )
    expect(Object.keys(initialized.capabilities).sort()).toEqual([
      'completionProvider',
      'documentSymbolProvider',
      'hoverProvider',
      'positionEncoding',
      'textDocumentSync',
    ])
    expect(initialized.capabilities).toMatchObject({
      positionEncoding: 'utf-16',
      textDocumentSync: 2,
      hoverProvider: true,
      documentSymbolProvider: true,
    })
    connection.sendNotification('initialized', {})

    const uri = 'file:///tmp/ontology-search-lsp-test.graphql'
    const opened = 'query FindMap {\n  hdmap {\n    _all\n  }\n}'
    connection.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: 'graphql', version: 1, text: opened },
    })
    expect(
      (await diagnostics.next('open diagnostics', ({ diagnostics }) => diagnostics.length === 0))
        .diagnostics
    ).toEqual([])

    const completion = await withTimeout(
      connection.sendRequest('textDocument/completion', {
        textDocument: { uri },
        position: { line: 2, character: 4 },
      }) as Promise<Array<{ label: string }>>,
      'completion'
    )
    expect(completion.map((item) => item.label)).toContain('title')

    const invalid = 'query FindMap { hdmap { unknown } }'
    connection.sendNotification('textDocument/didChange', {
      textDocument: { uri, version: 2 },
      contentChanges: [{ range: fullRange(opened), text: invalid }],
    })
    const invalidDiagnostics = await diagnostics.next(
      'change diagnostics',
      ({ diagnostics }) => diagnostics.length > 0
    )
    expect(invalidDiagnostics.diagnostics.map(({ message }) => message).join('\n')).toMatch(
      /unknown/i
    )

    const valid = 'query FindMap { hdmap { title(values: ["Map"]) } }'
    connection.sendNotification('textDocument/didChange', {
      textDocument: { uri, version: 3 },
      contentChanges: [{ range: fullRange(invalid), text: valid }],
    })
    expect(
      (
        await diagnostics.next(
          'clear changed diagnostics',
          ({ diagnostics }) => diagnostics.length === 0
        )
      ).diagnostics
    ).toEqual([])

    const hover = await withTimeout(
      connection.sendRequest('textDocument/hover', {
        textDocument: { uri },
        position: positionOf(valid, 'title', 2),
      }) as Promise<{ contents: { value: string } }>,
      'hover'
    )
    expect(hoverText(hover.contents)).toMatch(/title.*Filter/is)

    const symbols = await withTimeout(
      connection.sendRequest('textDocument/documentSymbol', {
        textDocument: { uri },
      }) as Promise<Array<{ name: string; children?: unknown[] }>>,
      'document symbols'
    )
    expect(symbols[0]?.name).toContain('FindMap')
    expect(JSON.stringify(symbols)).toContain('title')

    connection.sendNotification('textDocument/didClose', { textDocument: { uri } })
    expect(
      (await diagnostics.next('close diagnostics', ({ diagnostics }) => diagnostics.length === 0))
        .diagnostics
    ).toEqual([])

    await withTimeout(connection.sendRequest('shutdown'), 'shutdown')
    const exit = once(child, 'exit')
    connection.sendNotification('exit')
    const [code] = await withTimeout(exit, 'exit')
    expect(code).toBe(0)
  } catch (error) {
    throw new Error(`${String(error)}\nLSP stderr:\n${Buffer.concat(stderr).toString('utf8')}`, {
      cause: error,
    })
  } finally {
    connection.dispose()
    await stopChild(child)
  }
}

function notificationQueue(connection: MessageConnection, method: string) {
  const queued: Array<{ diagnostics: Array<{ message: string }> }> = []
  const waiting: Array<(value: { diagnostics: Array<{ message: string }> }) => void> = []
  connection.onNotification(method, (params) => {
    const value = params as { diagnostics: Array<{ message: string }> }
    const resolve = waiting.shift()
    if (resolve) resolve(value)
    else queued.push(value)
  })
  return {
    next: async (
      label: string,
      matches: (value: { diagnostics: Array<{ message: string }> }) => boolean
    ) => {
      while (true) {
        const value = await withTimeout(
          queued.length > 0
            ? Promise.resolve(queued.shift()!)
            : new Promise<{ diagnostics: Array<{ message: string }> }>((resolve) =>
                waiting.push(resolve)
              ),
          label
        )
        if (matches(value)) return value
      }
    },
  }
}

function hoverText(contents: unknown): string {
  if (typeof contents === 'string') return contents
  if (Array.isArray(contents)) return contents.map(hoverText).join('\n')
  if (contents && typeof contents === 'object' && 'value' in contents) {
    const value = (contents as { value?: unknown }).value
    return typeof value === 'string' ? value : ''
  }
  return ''
}

function fullRange(text: string) {
  return { start: { line: 0, character: 0 }, end: positionAt(text, text.length) }
}

function positionOf(text: string, token: string, inside = 0) {
  const offset = text.indexOf(token)
  if (offset < 0) throw new Error(`Token not found: ${token}`)
  return positionAt(text, offset + inside)
}

function positionAt(text: string, offset: number) {
  const lines = text.slice(0, offset).split('\n')
  return { line: lines.length - 1, character: lines.at(-1)!.length }
}

async function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  const timeoutMs = 5_000
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${timeoutMs} ms.`)),
          timeoutMs
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function stopChild(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 1_000))])
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
}
