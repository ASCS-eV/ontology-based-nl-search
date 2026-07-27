/**
 * The out-of-process checker-bundle seam.
 *
 * A real ASAM bundle is a Python program that is not a dependency of this repo,
 * so the runner is exercised against stub commands that honour the same contract
 * ([QC-FW] `doc/manual/manifest_file.md`): read the config file named by
 * `$ASAM_QC_FRAMEWORK_CONFIG_FILE`, write the `.xqar` its `resultFile` param
 * names. What is under test is the boundary — config in, issues out, and the
 * failure modes staying distinguishable from "found nothing".
 */
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runCheckerBundle } from '../bundle-runner.js'
import { XQAR_LEVEL } from '../xqar.js'

/** A bundle-shaped stub: reads the config, echoes the input path, writes .xqar. */
const STUB = `#!/bin/sh
set -e
config="$ASAM_QC_FRAMEWORK_CONFIG_FILE"
input=$(sed -n 's/.*name="InputFile" value="\\([^"]*\\)".*/\\1/p' "$config")
result=$(sed -n 's/.*name="resultFile" value="\\([^"]*\\)".*/\\1/p' "$config")
rows=$(grep -c "geometry" "$input" || true)
cat > "$result" <<XQAR
<?xml version="1.0" encoding="UTF-8"?>
<CheckerResults version="1.0.0">
  <CheckerBundle name="qcOpenDriveStub" version="1.0.0" description="stub" build_date="" summary="1 issue">
    <Checker checkerId="check_asam_xodr_road_geometry_parampoly3_length_match" description="" summary="1 issue">
      <Issue description="Length does not match (\${rows} geometries seen)" issueId="0" level="1" ruleUID="asam.net:xodr:1.7.0:road.geometry.parampoly3.length_match">
        <Locations description="road 1"><FileLocation column="7" row="3" /></Locations>
      </Issue>
    </Checker>
  </CheckerBundle>
</CheckerResults>
XQAR
`

const XODR = `<?xml version="1.0"?>
<OpenDRIVE>
  <road id="1" length="10"><planView><geometry s="0" x="0" y="0" hdg="0" length="10"><line/></geometry></planView></road>
</OpenDRIVE>
`

let dir: string
let stubPath: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'qc-stub-'))
  stubPath = join(dir, 'stub-bundle.sh')
  await writeFile(stubPath, STUB, 'utf8')
  await chmod(stubPath, 0o755)
})

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('runCheckerBundle', () => {
  it('invokes the command with the framework contract and imports its issues', async () => {
    const result = await runCheckerBundle(
      { content: XODR, fileName: 'road.xodr' },
      { command: stubPath }
    )
    expect(result.failure).toBeUndefined()
    expect(result.issues).toHaveLength(1)
    const [issue] = result.issues
    // The bundle's own rule identity, carried verbatim.
    expect(issue?.ruleUid).toBe('asam.net:xodr:1.7.0:road.geometry.parampoly3.length_match')
    expect(issue?.level).toBe(XQAR_LEVEL.error)
    expect(issue?.location).toEqual({ row: 3, column: 7 })
    // The stub read the staged input through the config file, not by guessing.
    expect(issue?.description).toContain('1 geometries seen')
  })

  it('reports a non-zero exit as a failure rather than as a clean run', async () => {
    const result = await runCheckerBundle(
      { content: XODR, fileName: 'road.xodr' },
      { command: 'exit 3' }
    )
    expect(result.issues).toEqual([])
    expect(result.failure).toMatch(/checker bundle failed/)
  })

  it('reports a bundle that writes no result file', async () => {
    const result = await runCheckerBundle(
      { content: XODR, fileName: 'road.xodr' },
      { command: 'true' }
    )
    expect(result.issues).toEqual([])
    expect(result.failure).toMatch(/wrote no result\.xqar/)
  })

  it('cleans up its working directory', async () => {
    const before = await mkdtemp(join(tmpdir(), 'qc-probe-'))
    await rm(before, { recursive: true, force: true })
    const result = await runCheckerBundle(
      { content: XODR, fileName: 'road.xodr' },
      { command: `sh -c 'pwd > ${join(dir, 'cwd.txt')}; true'` }
    )
    expect(result.failure).toMatch(/wrote no result\.xqar/)
    const cwd = (await readFile(join(dir, 'cwd.txt'), 'utf8')).trim()
    // The command ran in the temp working dir, and that dir is gone afterwards.
    await expect(readFile(join(cwd, 'config.xml'), 'utf8')).rejects.toThrow()
  })

  it('honours an already-aborted signal before spawning', async () => {
    await expect(
      runCheckerBundle(
        { content: XODR, fileName: 'road.xodr' },
        { command: stubPath, signal: AbortSignal.abort() }
      )
    ).rejects.toThrow(/abort/i)
  })
})
