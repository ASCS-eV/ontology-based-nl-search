#!/usr/bin/env node
/**
 * Reproducible build of `wasm/esmini.js` from the pinned esmini submodule
 * (`submodules/esmini`, MPL-2.0). This automates esmini's own esminiJS build
 * (see native/BUILD.md) so the committed artifact is exactly the output of this
 * script from the pin in `versions.json`.
 *
 * Unlike packages/authoring-wasm (which hand-drives em++ because its upstream had
 * no Emscripten target), esmini ships its OWN Emscripten CMake target, so we
 * drive that target via `emcmake` — the clean, upstream-aligned path. The single
 * local patch we apply, `patches/0001-esminijs-version-cmake.patch`, is offered
 * upstream (esmini issue #357); the submodule stays pinned pristine.
 *
 * Prerequisites on PATH (not installed by this repo):
 *   - Emscripten SDK (`emcmake`, `em++`) — the C++ → WASM toolchain
 *   - CMake (`cmake`) and Ninja (`ninja`) — the generator esmini's build uses
 *   - git — to fetch esmini's nested `externals/fmt` submodule on demand
 *
 * Run: `pnpm --filter @ontology-search/scenario-viewer-wasm build:wasm`
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  accessSync,
  constants,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { availableParallelism } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NATIVE = dirname(fileURLToPath(import.meta.url))
const PKG = dirname(NATIVE)
const REPO = join(PKG, '..', '..')
const SUB = join(REPO, 'submodules', 'esmini')
const ESMINIJS = join(SUB, 'EnvironmentSimulator', 'Libraries', 'esminiJS')

const VERSION_PATCH = join(NATIVE, 'patches', '0001-esminijs-version-cmake.patch')
const FMT_PATCH = join(SUB, 'scripts', 'patches', 'fmt-11.2.0-emscripten-cstdlib.patch')
const FMT_INCLUDE = join(SUB, 'externals', 'fmt', 'include')

const BUILD = join(PKG, '.build')
const CMAKE_BUILD = join(BUILD, 'cmake')
const PATCHED_FMT = join(BUILD, 'patched-fmt')
const OUT = join(PKG, 'wasm')

const EMCMAKE = resolveTool('emcmake')
const CMAKE = resolveTool('cmake')

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })

/** Resolve an executable to an absolute path, honouring PATHEXT on Windows. */
function resolveTool(name) {
  const exts =
    process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.BAT;.CMD').split(';') : ['']
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue
    for (const ext of exts) {
      const candidate = join(dir, name + ext.toLowerCase())
      if (!existsSync(candidate)) continue
      try {
        if (!statSync(candidate).isFile()) continue
        if (process.platform !== 'win32') accessSync(candidate, constants.X_OK)
      } catch {
        continue
      }
      return candidate
    }
  }
  throw new Error(
    `required tool not found on PATH: ${name} (need emsdk's emcmake/em++, cmake, ninja)`
  )
}

function assertPrereqs() {
  if (!existsSync(join(ESMINIJS, 'CMakeLists.txt'))) {
    throw new Error(
      `esmini submodule missing at ${SUB} — run: git submodule update --init submodules/esmini`
    )
  }
  if (!existsSync(FMT_PATCH)) {
    throw new Error(`esmini fmt compatibility patch missing: ${FMT_PATCH}`)
  }
}

/** Fetch esmini's nested `externals/fmt` submodule if it isn't checked out yet. */
function ensureFmtSubmodule() {
  if (existsSync(join(FMT_INCLUDE, 'fmt', 'format.h'))) {
    console.log('• externals/fmt already present')
    return
  }
  console.log('• initialising esmini externals/fmt submodule')
  run('git', ['-C', SUB, 'submodule', 'update', '--init', 'externals/fmt'])
}

/** Apply the esminiJS version.cmake patch to the submodule, idempotently. */
function applyVersionPatch() {
  try {
    run('git', ['-C', SUB, 'apply', '--reverse', '--check', VERSION_PATCH], { stdio: 'ignore' })
    console.log('• version.cmake patch already applied')
  } catch {
    run('git', ['-C', SUB, 'apply', VERSION_PATCH])
    console.log('• version.cmake patch applied')
  }
}

/**
 * Reproduce esmini's `build.sh` fmt step: copy `externals/fmt/include` to a
 * scratch dir and apply the vendored fmt-11.2.0 Emscripten `<cstdlib>` patch,
 * then point the build at it via `FMT_OVERRIDE_INCLUDE_DIR` (leaving the pinned
 * submodule pristine).
 */
function preparePatchedFmt() {
  rmSync(PATCHED_FMT, { recursive: true, force: true })
  mkdirSync(PATCHED_FMT, { recursive: true })
  cpSync(FMT_INCLUDE, join(PATCHED_FMT, 'include'), { recursive: true })
  // `git apply` SILENTLY skips (exit 0, no-op) files under a gitignored path
  // when run inside the superproject work tree — and `.build/` is gitignored, so
  // a naive apply would leave fmt UNPATCHED and yield a broken artifact. Stop
  // git's repository discovery at BUILD via GIT_CEILING_DIRECTORIES so the copy
  // is treated as standalone (as esmini's own build.sh patches externals/fmt).
  run('git', ['apply', '-p1', FMT_PATCH], {
    cwd: PATCHED_FMT,
    env: { ...process.env, GIT_CEILING_DIRECTORIES: BUILD },
  })
  // Fail loudly if the patch was a no-op: the emitted WASM must never be built
  // from unpatched fmt (undefined std::malloc/std::free under Emscripten).
  const patched = join(PATCHED_FMT, 'include', 'fmt', 'format.h')
  if (!readFileSync(patched, 'utf8').includes('<cstdlib>')) {
    throw new Error(`fmt Emscripten patch did not apply: ${patched} still lacks <cstdlib>`)
  }
  console.log('• prepared patched fmt includes')
  return join(PATCHED_FMT, 'include')
}

function main() {
  assertPrereqs()
  ensureFmtSubmodule()
  rmSync(BUILD, { recursive: true, force: true })
  mkdirSync(BUILD, { recursive: true })
  mkdirSync(OUT, { recursive: true })

  applyVersionPatch()
  const patchedFmtInclude = preparePatchedFmt()

  // Configure esmini's own Emscripten target (Ninja, Release, SINGLE_FILE).
  run(EMCMAKE, [
    CMAKE,
    '-G',
    'Ninja',
    '-DCMAKE_BUILD_TYPE=Release',
    `-DFMT_OVERRIDE_INCLUDE_DIR=${patchedFmtInclude}`,
    '-S',
    ESMINIJS,
    '-B',
    CMAKE_BUILD,
  ])

  run(CMAKE, ['--build', CMAKE_BUILD, '--parallel', String(availableParallelism())])

  // SINGLE_FILE=1 inlines the .wasm, so the build emits only esmini.js.
  const built = join(CMAKE_BUILD, 'esmini.js')
  if (!existsSync(built)) throw new Error(`build did not produce ${built}`)
  cpSync(built, join(OUT, 'esmini.js'))
  console.log(`• copied esmini.js -> ${join(OUT, 'esmini.js')}`)

  writeChecksum()
}

/**
 * Write a `sha256sum`-compatible integrity manifest next to the artifact. The
 * committed manifest lets CI (and verify-checksum.mjs) detect a corrupted or
 * tampered binary — the one file here a reviewer cannot read in a diff.
 */
function writeChecksum() {
  const artifact = join(OUT, 'esmini.js')
  const digest = createHash('sha256').update(readFileSync(artifact)).digest('hex')
  writeFileSync(join(OUT, 'esmini.js.sha256'), `${digest}  esmini.js\n`)
  console.log(`• wrote esmini.js.sha256 (${digest.slice(0, 12)}…)`)
}

main()
