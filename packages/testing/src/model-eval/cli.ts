#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { readSummary } from './artifacts.js'
import { candidateInventory, getCandidate } from './candidates.js'
import { runCapacityEvaluation } from './capacity.js'
import {
  assertCorpusInvariants,
  envitedGoldCases,
  protocolGoldCases,
  toyverseGoldCases,
} from './corpus.js'
import { selectTierWinners } from './gates.js'
import { validateGoldCorpus } from './ontology-validation.js'
import { runEvaluation } from './runner.js'
import { assertSchemaArtifactsCurrent, writeSchemaArtifacts } from './schema-artifacts.js'
import { readLaunchDescriptor } from './server.js'
import { runSmokeEvaluation } from './smoke.js'
import { type GoldCase, profileNames } from './types.js'

export type CliCommand =
  | { command: 'list' }
  | { command: 'check' }
  | { command: 'schemas' }
  | {
      command: 'compare'
      paths: string[]
    }
  | {
      command: 'run'
      candidate: string
      profile: (typeof profileNames)[number]
      baseUrl: string
      model?: string
      apiKey?: string
      serverPid?: number
      launchPath?: string
      tokenizerUrl?: string
      timeoutMs: number
      suite: 'envited-x' | 'toyverse'
    }
  | {
      command: 'smoke'
      auth: 'codex-cli' | 'api-key'
      model: string
      caseId: string
      apiKey?: string
      baseUrl?: string
      codexHome?: string
      timeoutMs: number
    }

export function parseCliArgs(argv: string[]): CliCommand {
  const command = argv[0]
  if (command === 'list' || command === 'check' || command === 'schemas') {
    if (argv.length !== 1) throw new Error(`${command} accepts no arguments`)
    return { command }
  }
  if (command === 'compare') {
    const parsed = parseArgs({
      args: argv.slice(1),
      allowPositionals: true,
      strict: true,
    })
    if (parsed.positionals.length === 0) {
      throw new Error('compare requires at least one run directory or summary.json')
    }
    return { command, paths: parsed.positionals }
  }
  if (command === 'smoke') {
    const parsed = parseArgs({
      args: argv.slice(1),
      allowPositionals: false,
      strict: true,
      options: {
        auth: { type: 'string', default: 'codex-cli' },
        model: { type: 'string', default: 'gpt-5.4-mini' },
        case: { type: 'string', default: 'env-001' },
        'api-key': { type: 'string' },
        'base-url': { type: 'string' },
        'codex-home': { type: 'string' },
        'timeout-ms': { type: 'string', default: '120000' },
      },
    })
    const auth = parsed.values.auth
    if (auth !== 'codex-cli' && auth !== 'api-key') {
      throw new Error(`Invalid --auth "${auth}"`)
    }
    if (auth === 'api-key' && !parsed.values['api-key']) {
      throw new Error('--api-key is required when --auth api-key is used')
    }
    if (auth === 'codex-cli' && parsed.values['api-key']) {
      throw new Error('--api-key cannot be combined with --auth codex-cli')
    }
    if (auth === 'codex-cli' && parsed.values['base-url']) {
      throw new Error('--base-url cannot override the Codex subscription endpoint')
    }
    return {
      command,
      auth,
      model: parsed.values.model!,
      caseId: parsed.values.case!,
      ...(parsed.values['api-key'] ? { apiKey: parsed.values['api-key'] } : {}),
      ...(parsed.values['base-url']
        ? { baseUrl: httpUrl(parsed.values['base-url'], '--base-url') }
        : {}),
      ...(parsed.values['codex-home'] ? { codexHome: resolve(parsed.values['codex-home']) } : {}),
      timeoutMs: positiveInteger(parsed.values['timeout-ms']!, '--timeout-ms'),
    }
  }
  if (command === 'run') {
    const parsed = parseArgs({
      args: argv.slice(1),
      allowPositionals: false,
      strict: true,
      options: {
        candidate: { type: 'string' },
        profile: { type: 'string' },
        'base-url': { type: 'string' },
        model: { type: 'string' },
        'api-key': { type: 'string' },
        'server-pid': { type: 'string' },
        launch: { type: 'string' },
        'tokenizer-url': { type: 'string' },
        'timeout-ms': { type: 'string', default: '120000' },
        suite: { type: 'string', default: 'envited-x' },
      },
    })
    const candidate = required(parsed.values.candidate, '--candidate')
    const profile = required(parsed.values.profile, '--profile')
    const baseUrl = httpUrl(required(parsed.values['base-url'], '--base-url'), '--base-url')
    if (!profileNames.includes(profile as (typeof profileNames)[number])) {
      throw new Error(`Invalid --profile "${profile}"`)
    }
    if (!['envited-x', 'toyverse'].includes(parsed.values.suite ?? '')) {
      throw new Error(`Invalid --suite "${parsed.values.suite}"`)
    }
    const serverPid = optionalPositiveInteger(parsed.values['server-pid'], '--server-pid')
    const timeoutMs = positiveInteger(parsed.values['timeout-ms']!, '--timeout-ms')
    if (serverPid && parsed.values.launch) {
      throw new Error('--server-pid and --launch are mutually exclusive')
    }
    return {
      command,
      candidate,
      profile: profile as (typeof profileNames)[number],
      baseUrl,
      ...(parsed.values.model ? { model: parsed.values.model } : {}),
      ...(parsed.values['api-key'] ? { apiKey: parsed.values['api-key'] } : {}),
      ...(serverPid ? { serverPid } : {}),
      ...(parsed.values.launch ? { launchPath: parsed.values.launch } : {}),
      ...(parsed.values['tokenizer-url']
        ? { tokenizerUrl: httpUrl(parsed.values['tokenizer-url'], '--tokenizer-url') }
        : {}),
      timeoutMs,
      suite: parsed.values.suite as 'envited-x' | 'toyverse',
    }
  }
  throw new Error(
    'Usage: pnpm eval:models <list|check|smoke|run|compare> (run --candidate ID --profile PROFILE --base-url URL)'
  )
}

export async function main(): Promise<number> {
  // Evaluation constructs its model directly. Test mode only prevents the
  // unrelated production-provider credential guard from blocking ontology
  // loading; no AI_PROVIDER, endpoint, model, or secret is placed in env.
  // Writes the harness's own NODE_ENV before config is parsed — not an
  // application config read, so the getConfig() rule does not apply.
  // eslint-disable-next-line no-restricted-syntax
  process.env['NODE_ENV'] = 'test'
  const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
  const command = parseCliArgs(process.argv.slice(2))
  const schemaDirectory = join(repoRoot, 'packages/testing/src/model-eval/schemas')

  // Toyverse must initialize the ontology stack in its own process. The
  // parent only prepares the fixture root and forwards the original CLI
  // arguments; this keeps singleton ontology caches from ever mixing suites.
  if (
    command.command === 'run' &&
    command.suite === 'toyverse' &&
    command.profile !== 'capacity' &&
    // Reads the harness's private recursion marker, not application config.
    // eslint-disable-next-line no-restricted-syntax
    process.env['MODEL_EVAL_TOYVERSE_CHILD'] !== '1'
  ) {
    return runToyverseInChild(repoRoot)
  }

  if (command.command === 'list') {
    for (const candidate of candidateInventory.candidates) {
      process.stdout.write(
        `${candidate.id.padEnd(28)} ${candidate.cohort.padEnd(11)} ${candidate.hardwareTier.padEnd(5)} GiB  ${candidate.quantization.padEnd(8)} ${candidate.source.license}\n`
      )
    }
    process.stdout.write('\nDocumented exclusions:\n')
    for (const exclusion of candidateInventory.exclusions) {
      process.stdout.write(`- ${exclusion.model}: ${exclusion.reason}\n`)
    }
    return 0
  }

  if (command.command === 'schemas') {
    writeSchemaArtifacts(schemaDirectory)
    process.stdout.write(`Wrote evaluation schemas to ${schemaDirectory}\n`)
    return 0
  }

  if (command.command === 'check') {
    getCandidate(candidateInventory.candidates[0]!.id)
    assertCandidateInventory()
    assertCorpusInvariants()
    assertSchemaArtifactsCurrent(schemaDirectory)
    const envited = await validateGoldCorpus(envitedGoldCases)
    process.stdout.write(
      `ENVITED-X: ${envited.caseCount} cases, ${envited.domainCount} domains, ${envited.propertyCount} properties\n`
    )
    await checkToyverseInChild(repoRoot)
    process.stdout.write('Candidate inventory, corpora, and JSON schemas are current.\n')
    return 0
  }

  if (command.command === 'compare') {
    const summaries = command.paths.map(readSummary)
    const winners = selectTierWinners(summaries)
    for (const winner of winners) {
      process.stdout.write(
        `${winner.tier.padEnd(5)} GiB: ${winner.candidateId} (${(winner.validatedExact * 100).toFixed(1)}%, ${winner.weightEstimateGiB.toFixed(1)} GiB weights)\n`
      )
    }
    return 0
  }

  if (command.command === 'smoke') {
    const gold = envitedGoldCases.find((candidate) => candidate.id === command.caseId)
    if (!gold) throw new Error(`Unknown ENVITED-X smoke case "${command.caseId}"`)
    const abort = installRunAbortHandlers()
    try {
      const result = await runSmokeEvaluation({
        auth: command.auth,
        model: command.model,
        gold,
        ...(command.apiKey ? { apiKey: command.apiKey } : {}),
        ...(command.baseUrl ? { baseUrl: command.baseUrl } : {}),
        ...(command.codexHome ? { codexHome: command.codexHome } : {}),
        timeoutMs: command.timeoutMs,
        signal: abort.signal,
      })
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      return result.passed ? 0 : 1
    } finally {
      abort.dispose()
    }
  }

  const cases: GoldCase[] = command.suite === 'toyverse' ? toyverseGoldCases : envitedGoldCases
  const protocolCases =
    command.suite === 'toyverse'
      ? toyverseGoldCases.filter((gold) => gold.risk === 'high')
      : protocolGoldCases
  const abort = installRunAbortHandlers()
  try {
    if (command.profile === 'capacity') {
      const result = await runCapacityEvaluation({
        repoRoot,
        candidateId: command.candidate,
        baseUrl: command.baseUrl,
        ...(command.model ? { servedModel: command.model } : {}),
        ...(command.apiKey ? { apiKey: command.apiKey } : {}),
        ...(command.serverPid ? { serverPid: command.serverPid } : {}),
        ...(command.launchPath ? { launch: readLaunchDescriptor(command.launchPath) } : {}),
        ...(command.tokenizerUrl ? { tokenizerUrl: command.tokenizerUrl } : {}),
        timeoutMs: command.timeoutMs,
        signal: abort.signal,
      })
      process.stdout.write(`${result.summary.capacity?.status}: ${result.artifacts.directory}\n`)
      return result.summary.gates.passing ? 0 : 1
    }

    const result = await runEvaluation({
      repoRoot,
      candidateId: command.candidate,
      profile: command.profile,
      baseUrl: command.baseUrl,
      ...(command.model ? { servedModel: command.model } : {}),
      ...(command.apiKey ? { apiKey: command.apiKey } : {}),
      ...(command.serverPid ? { serverPid: command.serverPid } : {}),
      ...(command.launchPath ? { launch: readLaunchDescriptor(command.launchPath) } : {}),
      timeoutMs: command.timeoutMs,
      cases,
      protocolCases,
      signal: abort.signal,
    })
    process.stdout.write(
      `${result.summary.gates.passing ? 'PASS' : 'FAIL'}: ${result.artifacts.directory}\n`
    )
    return result.summary.gates.passing ? 0 : 1
  } finally {
    abort.dispose()
  }
}

function assertCandidateInventory(): void {
  const ids = new Set<string>()
  const artifacts = new Set<string>()
  for (const candidate of candidateInventory.candidates) {
    if (ids.has(candidate.id)) throw new Error(`Duplicate candidate id: ${candidate.id}`)
    ids.add(candidate.id)
    const artifact = [
      candidate.source.huggingFaceId,
      candidate.source.revision,
      candidate.runtime.engine,
      candidate.quantization,
      candidate.runtime.toolParser,
    ].join(':')
    if (artifacts.has(artifact)) throw new Error(`Duplicate runtime artifact: ${candidate.id}`)
    artifacts.add(artifact)
    if (!['Apache-2.0', 'MIT'].includes(candidate.source.license)) {
      throw new Error(`Non-permissive runnable candidate: ${candidate.id}`)
    }
  }
}

async function checkToyverseInChild(repoRoot: string): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'model-eval-toyverse-'))
  const fixture = join(repoRoot, 'packages/testing/fixtures/toyverse')
  writeFileSync(
    join(root, 'ontology-sources.json'),
    JSON.stringify({ sources: [{ path: relative(root, fixture) }] })
  )
  const childPath = join(repoRoot, 'packages/testing/src/model-eval/check-toyverse.ts')
  try {
    const status = await new Promise<number>((resolveStatus, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', childPath], {
        shell: false,
        stdio: 'inherit',
        env: {
          // Forwards the ambient environment to a child process — not a
          // config read, so the getConfig() rule does not apply.
          // eslint-disable-next-line no-restricted-syntax
          ...process.env,
          NODE_ENV: 'test',
          ONTOLOGY_ROOT: root,
        },
      })
      child.once('error', reject)
      child.once('close', (code) => resolveStatus(code ?? 1))
    })
    if (status !== 0) throw new Error(`Toyverse child validation exited ${status}`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

async function runToyverseInChild(repoRoot: string): Promise<number> {
  const root = mkdtempSync(join(tmpdir(), 'model-eval-toyverse-'))
  const fixture = join(repoRoot, 'packages/testing/fixtures/toyverse')
  writeFileSync(
    join(root, 'ontology-sources.json'),
    JSON.stringify({ sources: [{ path: relative(root, fixture) }] })
  )
  const cliPath = fileURLToPath(import.meta.url)
  try {
    return await new Promise<number>((resolveStatus, reject) => {
      const child = spawn(
        process.execPath,
        ['--import', 'tsx', cliPath, ...process.argv.slice(2)],
        {
          shell: false,
          stdio: 'inherit',
          env: {
            // Forwards ambient variables to the isolated ontology process.
            // eslint-disable-next-line no-restricted-syntax
            ...process.env,
            NODE_ENV: 'test',
            ONTOLOGY_ROOT: root,
            MODEL_EVAL_TOYVERSE_CHILD: '1',
          },
        }
      )
      child.once('error', reject)
      child.once('close', (code) => resolveStatus(code ?? 1))
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function findRepoRoot(start: string): string {
  let current = resolve(start)
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current
    const parent = dirname(current)
    if (parent === current) throw new Error(`Could not find repository root above ${start}`)
    current = parent
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`)
  return value
}

function optionalPositiveInteger(value: string | undefined, name: string): number | undefined {
  return value === undefined ? undefined : positiveInteger(value, name)
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

function httpUrl(value: string, name: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL`)
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`${name} must be an absolute HTTP(S) URL`)
  }
  return value
}

function installRunAbortHandlers(): { signal: AbortSignal; dispose(): void } {
  const controller = new AbortController()
  const abort = () => controller.abort(new Error('Evaluation interrupted'))
  process.once('SIGINT', abort)
  process.once('SIGTERM', abort)
  return {
    signal: controller.signal,
    dispose: () => {
      process.off('SIGINT', abort)
      process.off('SIGTERM', abort)
    },
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
      process.exit(1)
    })
}
