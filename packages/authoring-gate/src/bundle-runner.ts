/**
 * Runner for an out-of-process ASAM Quality Checker bundle.
 *
 * The bundles (`qc-opendrive`, `qc-openscenarioxml`) are Python programs that
 * read a framework config file and write a `.xqar`. Running one is strictly
 * better than reimplementing its rules in TypeScript: the rule identities in the
 * result are the bundle's own, so they resolve against the published catalog by
 * construction, and the coverage moves with the bundle rather than with us.
 *
 * This module is the process boundary only — it writes the config, invokes the
 * command, and hands the `.xqar` to {@link parseXqar}. It has no knowledge of
 * which rules a bundle implements, deliberately: whatever the bundle reports is
 * what we report.
 *
 * STANDARDS (criterion #31):
 *   [QC-FW] ASAM Quality Checker Framework — `asam-ev/qc-framework`. The config
 *           file shape (`<Config><Param name="InputFile"…><CheckerBundle
 *           application=…><Param name="resultFile"…>`) is from
 *           `doc/manual/file_formats.md`; the `$ASAM_QC_FRAMEWORK_CONFIG_FILE` /
 *           `$ASAM_QC_FRAMEWORK_WORKING_DIR` invocation contract is from
 *           `doc/manual/manifest_file.md`.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { parseXqar, type XqarIssue } from './xqar.js'

const run = promisify(execFile)

/** What to hand a bundle: one file, and the name it should be checked under. */
export interface BundleRunInput {
  /** File content to check (`.xodr` or `.xosc`). */
  readonly content: string
  /** File name, including the extension the bundle dispatches on. */
  readonly fileName: string
}

/** Options for {@link runCheckerBundle}. */
export interface BundleRunOptions {
  /** The command line to invoke, from `RESIDUAL_EXTERNAL_COMMAND`. */
  readonly command: string
  /** Bundle application name, written into the config file. */
  readonly application?: string
  /** Milliseconds before the bundle is killed. */
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
}

/** Outcome of a bundle run. `issues` is empty both for "clean" and for "failed". */
export interface BundleRunResult {
  readonly issues: readonly XqarIssue[]
  /**
   * Why no result was obtained, when that is the case: the command failed, timed
   * out, or wrote no `.xqar`. Never swallowed — the residual gate reports it as
   * a skipped rule rather than as a pass.
   */
  readonly failure?: string
}

const CONFIG_FILE = 'config.xml'
const RESULT_FILE = 'result.xqar'
const DEFAULT_TIMEOUT_MS = 60_000

/** Minimal XML escaping for the two attribute values we write. */
function attr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * A framework config file naming the input and the result path ([QC-FW]). No
 * `<Checker>` entries are listed, which the framework reads as "report
 * everything the bundle produces" — filtering is this repo's job, downstream,
 * where the gap set is already rule-attributed.
 */
function configXml(inputFile: string, resultFile: string, application: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Config>
  <Param name="InputFile" value="${attr(inputFile)}" />
  <CheckerBundle application="${attr(application)}">
    <Param name="resultFile" value="${attr(resultFile)}" />
  </CheckerBundle>
</Config>
`
}

/**
 * Run a checker bundle over one file and return the issues it reported.
 *
 * Everything happens in a fresh temp directory that is removed afterwards, so
 * concurrent runs cannot see each other's files. A failing bundle is reported,
 * not thrown: the caller turns it into a skipped rule, because "the checker
 * could not run" and "the checker found nothing" must never look alike.
 */
export async function runCheckerBundle(
  input: BundleRunInput,
  options: BundleRunOptions
): Promise<BundleRunResult> {
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const dir = await mkdtemp(join(tmpdir(), 'qc-bundle-'))
  try {
    const inputPath = join(dir, input.fileName)
    const resultPath = join(dir, RESULT_FILE)
    const configPath = join(dir, CONFIG_FILE)
    await writeFile(inputPath, input.content, 'utf8')
    await writeFile(
      configPath,
      configXml(inputPath, resultPath, options.application ?? 'authoringGateExternal'),
      'utf8'
    )

    // The framework passes the config path through the environment and expects
    // the module to run in the working directory it names, so honour both rather
    // than inventing an argument convention a real bundle would not accept.
    // The parent environment is propagated because a bundle needs PATH,
    // PYTHONPATH, a virtualenv and so on. That is subprocess plumbing, not
    // configuration reading — no setting of ours is read here — but the repo's
    // rule is syntactic, so the access is isolated in one named helper.
    const env = {
      ...inheritedEnvironment(),
      ASAM_QC_FRAMEWORK_CONFIG_FILE: configPath,
      ASAM_QC_FRAMEWORK_WORKING_DIR: dir,
    }

    try {
      await run('/bin/sh', ['-c', options.command], {
        cwd: dir,
        env,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: 8 * 1024 * 1024,
        ...(options.signal ? { signal: options.signal } : {}),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return { issues: [], failure: `checker bundle failed: ${describe(error)}` }
    }

    let xqar: string
    try {
      xqar = await readFile(resultPath, 'utf8')
    } catch {
      return { issues: [], failure: `checker bundle wrote no ${RESULT_FILE}` }
    }
    return { issues: parseXqar(xqar) }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * The environment a child bundle inherits. Isolated here so the one unavoidable
 * `process.env` read — a subprocess needs its parent's PATH and interpreter
 * setup — is a single, documented line rather than sprinkled through the runner.
 * This is not a source of configuration: every setting this package reads comes
 * from `getConfig()`.
 */
function inheritedEnvironment(): NodeJS.ProcessEnv {
  // eslint-disable-next-line no-restricted-syntax
  return process.env
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    const withCode = error as Error & { code?: string; stderr?: string }
    const detail = withCode.stderr?.trim()
    return detail ? `${error.message} (${detail.split('\n')[0]})` : error.message
  }
  return String(error)
}
