#!/usr/bin/env node
/**
 * Reproducible build of `wasm/osc-engine.{mjs,wasm}` from the pinned RAC
 * submodule (`submodules/openscenario-api`, Apache-2.0). This automates the
 * exact recipe documented in native/BUILD.md — the committed artifacts are the
 * output of this script.
 *
 * Prerequisites on PATH (not installed by this repo):
 *   - Emscripten SDK (`em++`)   — the C++ → WASM toolchain
 *   - A JDK 11+  (`java`)       — runs the vendored ANTLR 4.8 jar for codegen
 *   - CMake      (`cmake`)      — used only as a cross-platform archive extractor
 *
 * Run: `pnpm --filter @ontology-search/authoring-wasm build:wasm`
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const NATIVE = dirname(fileURLToPath(import.meta.url))
const PKG = dirname(NATIVE)
const REPO = join(PKG, '..', '..')
const SUB = join(REPO, 'submodules', 'openscenario-api')
const CPP = join(SUB, 'cpp')

const ANTLR_JAR = join(CPP, 'thirdparty', 'antlr', 'antlr-4.8-complete.jar')
const ANTLR_ZIP = join(CPP, 'thirdparty', 'antlr', 'antlr4-4.8.zip')
const PATCH = join(NATIVE, 'patches', '0001-emscripten-portability.patch')
const EMBIND = join(NATIVE, 'osc_engine_embind.cpp')

const BUILD = join(PKG, '.build')
const OUT = join(PKG, 'wasm')

const EMXX = resolveTool('em++')
const JAVA = resolveTool('java')
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
      if (existsSync(candidate)) return candidate
    }
  }
  throw new Error(
    `required tool not found on PATH: ${name} (need emsdk's em++, a JDK's java, and cmake)`
  )
}

/** Recursively collect `.cpp` files under `dir`, skipping any path segment in `exclude`. */
function collectCpp(dir, exclude = []) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (exclude.includes(entry.name)) continue
    if (entry.isDirectory()) out.push(...collectCpp(full, exclude))
    else if (entry.name.endsWith('.cpp')) out.push(full)
  }
  return out
}

function assertPrereqs() {
  if (!existsSync(CPP)) {
    throw new Error(
      `RAC submodule missing at ${SUB} — run: git submodule update --init submodules/openscenario-api`
    )
  }
  for (const f of [ANTLR_JAR, ANTLR_ZIP]) {
    if (!existsSync(f)) throw new Error(`vendored ANTLR artifact missing: ${f}`)
  }
}

/** Apply the Emscripten portability patch to the submodule, idempotently. */
function applyPatch() {
  try {
    run('git', ['-C', SUB, 'apply', '--reverse', '--check', PATCH], { stdio: 'ignore' })
    console.log('• portability patch already applied')
  } catch {
    run('git', ['-C', SUB, 'apply', PATCH])
    console.log('• portability patch applied')
  }
}

/** Extract the vendored ANTLR 4.8 C++ runtime; return its source root. */
function extractAntlrRuntime() {
  const dst = join(BUILD, 'antlr')
  mkdirSync(dst, { recursive: true })
  run(CMAKE, ['-E', 'tar', 'xf', ANTLR_ZIP], { cwd: dst })
  return join(dst, 'antlr4-4.8', 'runtime', 'Cpp', 'runtime', 'src')
}

/** Generate C++ from a set of grammars into `outDir`. */
function generateGrammar(grammars, outDir, pkg) {
  mkdirSync(outDir, { recursive: true })
  const pkgArgs = pkg ? ['-package', pkg] : []
  run(JAVA, [
    '-jar',
    ANTLR_JAR,
    ...grammars,
    '-Dlanguage=Cpp',
    '-o',
    outDir,
    '-visitor',
    '-listener',
    ...pkgArgs,
  ])
  return outDir
}

function main() {
  assertPrereqs()
  rmSync(BUILD, { recursive: true, force: true })
  mkdirSync(BUILD, { recursive: true })
  mkdirSync(OUT, { recursive: true })

  applyPatch()

  const antlrSrc = extractAntlrRuntime()
  const genXml = generateGrammar(
    [
      join(CPP, 'openScenarioLib', 'src', 'antlr', 'XMLLexer.g4'),
      join(CPP, 'openScenarioLib', 'src', 'antlr', 'XMLParser.g4'),
    ],
    join(BUILD, 'gen', 'xml')
  )
  const genExpr = generateGrammar(
    [
      join(CPP, 'expressionsLib', 'src', 'antlr', 'OscExprLexer.g4'),
      join(CPP, 'expressionsLib', 'src', 'antlr', 'OscExprParser.g4'),
    ],
    join(BUILD, 'gen', 'expr'),
    'OscExpression'
  )

  // Include roots: the engine keeps headers alongside sources, so we add every
  // directory under the compiled trees plus the generated + third-party roots.
  const includeRoots = [
    antlrSrc,
    genXml,
    genExpr,
    join(CPP, 'openScenarioLib', 'src'),
    join(CPP, 'openScenarioLib', 'generated', 'v1_3'),
    join(CPP, 'expressionsLib', 'inc'),
    join(CPP, 'expressionsLib', 'generated'),
    join(CPP, 'externalLibs'),
    join(CPP, 'common'),
    join(CPP, 'applications', 'expressionsTester', 'thirdParty', 'nlohmann', 'inc'),
  ]
  const includeDirs = new Set()
  for (const root of includeRoots) {
    if (!existsSync(root)) continue
    includeDirs.add(root)
    const stack = [root]
    while (stack.length) {
      const d = stack.pop()
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) {
          const full = join(d, e.name)
          includeDirs.add(full)
          stack.push(full)
        }
      }
    }
  }
  const incArgs = [...includeDirs].map((d) => `-I${d}`)

  const CFLAGS = [
    '-std=c++17',
    '-Oz',
    '-fexceptions',
    '-DSUPPORT_OSC_1_3',
    '-Wno-deprecated-declarations',
    '-Wno-inconsistent-missing-override',
  ]

  // The three source sets, mirroring what actually links (see BUILD.md):
  //  - antlr4 runtime (single-threaded)
  //  - expressionsLib libs (minus the dead stub) + generated OscExpr grammar
  //  - openScenarioLib src (v1_3 only) + generated/v1_3 + generated XML grammar
  //    + TinyXML2 + our embind entrypoint
  const sources = [
    ...collectCpp(antlrSrc),
    ...collectCpp(join(CPP, 'expressionsLib', 'src'), ['OscExprEvaluator.cpp']),
    ...collectCpp(genExpr),
    ...collectCpp(join(CPP, 'openScenarioLib', 'src'), ['v1_0', 'v1_1', 'v1_2']),
    ...collectCpp(join(CPP, 'openScenarioLib', 'generated', 'v1_3')),
    ...collectCpp(genXml),
    join(CPP, 'externalLibs', 'TinyXML2', 'tinyxml2.cpp'),
    EMBIND,
  ]

  const objDir = join(BUILD, 'obj')
  mkdirSync(objDir, { recursive: true })
  const objects = []
  let n = 0
  for (const src of sources) {
    const obj = join(objDir, `${n++}_${basenameNoExt(src)}.o`)
    run(EMXX, [...CFLAGS, ...incArgs, '-c', src, '-o', obj])
    objects.push(obj)
  }
  console.log(`• compiled ${objects.length} objects`)

  run(EMXX, [
    '-Oz',
    '-g0',
    '-fexceptions',
    '-lembind',
    '-sMODULARIZE=1',
    '-sEXPORT_ES6=1',
    '-sEXPORT_NAME=createOscEngine',
    '-sALLOW_MEMORY_GROWTH=1',
    '-sEXIT_RUNTIME=0',
    '-sFORCE_FILESYSTEM=1',
    "-sEXPORTED_RUNTIME_METHODS=['FS']",
    ...objects,
    '-o',
    join(OUT, 'osc-engine.mjs'),
  ])
  console.log(`• linked ${join(OUT, 'osc-engine.mjs')} + osc-engine.wasm`)
}

function basenameNoExt(p) {
  const b = p.slice(Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\')) + 1)
  return b.replace(/\.[^.]+$/, '')
}

main()
