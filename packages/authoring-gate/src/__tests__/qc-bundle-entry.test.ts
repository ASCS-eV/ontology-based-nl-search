/**
 * The checker-bundle entry point, exercised the way the framework invokes it:
 * a config file in, a `.xqar` at the declared `resultFile` out ([QC-FW],
 * `doc/manual/manifest_file.md`).
 *
 * Running the real `qc-bundle/main.mjs` as a subprocess is the point — a test
 * that imported its internals would not prove the framework contract holds.
 */
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QC_RULES } from '../qc-rules.js'
import { parseXqar } from '../xqar.js'

const run = promisify(execFile)
const ENTRY = fileURLToPath(new URL('../../qc-bundle/main.mjs', import.meta.url))

/** A join with a heading discontinuity, so the gate has something to report. */
const DISCONTINUOUS = `<?xml version="1.0"?>
<OpenDRIVE>
  <road id="1" length="20">
    <planView>
      <geometry s="0" x="0" y="0" hdg="0" length="10"><line/></geometry>
      <geometry s="10" x="10" y="0" hdg="1.5" length="10"><line/></geometry>
    </planView>
  </road>
</OpenDRIVE>
`

let dir: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'qc-entry-'))
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function invoke(input: string, resultName = 'result.xqar'): Promise<string> {
  await writeFile(join(dir, 'road.xodr'), input, 'utf8')
  await writeFile(
    join(dir, 'config.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<Config>
  <Param name="InputFile" value="road.xodr" />
  <CheckerBundle application="authoringGate">
    <Param name="resultFile" value="${resultName}" />
  </CheckerBundle>
</Config>
`,
    'utf8'
  )
  await run(process.execPath, [ENTRY], {
    cwd: dir,
    env: { ...process.env, ASAM_QC_FRAMEWORK_CONFIG_FILE: join(dir, 'config.xml') },
  })
  return readFile(join(dir, resultName), 'utf8')
}

describe('qc-bundle/main.mjs', () => {
  it('writes a .xqar the framework can read, at the configured resultFile', async () => {
    const xqar = await invoke(DISCONTINUOUS)
    const issues = parseXqar(xqar)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues.every((i) => i.ruleUid === QC_RULES.geometryContinuity.uid)).toBe(true)
    expect(xqar).toContain('name="authoringGate"')
    expect(xqar).toContain('<Param name="InputFile"')
  })

  it('honours a non-default resultFile name', async () => {
    const xqar = await invoke(DISCONTINUOUS, 'geometry_report.xqar')
    expect(parseXqar(xqar).length).toBeGreaterThan(0)
  })

  it('emits an empty but well-formed result for a clean road network', async () => {
    const continuous = DISCONTINUOUS.replace('hdg="1.5"', 'hdg="0"')
    const xqar = await invoke(continuous)
    expect(parseXqar(xqar)).toEqual([])
    expect(xqar).toContain('<CheckerResults')
  })

  it('exits non-zero when the config declares no input file', async () => {
    await writeFile(join(dir, 'empty.xml'), '<Config />', 'utf8')
    await expect(
      run(process.execPath, [ENTRY, join(dir, 'empty.xml')], { cwd: dir })
    ).rejects.toThrow()
  })
})
