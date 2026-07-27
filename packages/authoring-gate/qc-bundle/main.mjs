#!/usr/bin/env node
/**
 * Checker-bundle entry point: run this repo's **file-scoped** gate inside the
 * ASAM Quality Checker Framework.
 *
 * The framework invokes a bundle with a config file — on the command line or via
 * `$ASAM_QC_FRAMEWORK_CONFIG_FILE` — reads `InputFile` from it, and expects a
 * `.xqar` at the path the bundle's `resultFile` param names ([QC-FW],
 * `doc/manual/file_formats.md` + `doc/manual/manifest_file.md`). That is the
 * whole contract, and it is deliberately the only thing this file implements:
 * the analysis lives in the package, the framework adapter is a shell.
 *
 * **Scope: one `.xodr`.** The analytic road-geometry gate is file-scoped, so it
 * fits a bundle. The semantic gate does not and is not exposed here: it resolves
 * `.xosc`↔`.xodr` references over a merged RDF graph built from a validated
 * authoring IR, which is not something a per-file checker can be handed. Saying
 * so is more useful than shipping a checker that silently checks less than its
 * name suggests.
 *
 * Usage (normally via the manifest, not by hand):
 *   node main.mjs [config.xml]        # or set $ASAM_QC_FRAMEWORK_CONFIG_FILE
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

// This is a shipped executable, so it consumes the package's build output rather
// than its TypeScript sources. Say so when the build is missing: the framework
// invokes this through a manifest, where a bare module-resolution error would
// surface with no hint about what to do.
let checkGeometryContinuity
let gapsToXqar
try {
  ;({ checkGeometryContinuity, gapsToXqar } = await import('../dist/index.js'))
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
  console.error(
    'authoringGate: package not built — run `pnpm --filter @ontology-search/authoring-gate build`'
  )
  process.exit(2)
}

const BUNDLE = {
  name: 'authoringGate',
  version: '1.0.0',
  description: 'Analytic road-geometry continuity (G1/G2) over an OpenDRIVE road network',
  buildDate: '',
}

/** Read one `<Param name=… value=…/>` out of a framework config file. */
function param(xml, name) {
  const match = new RegExp(`<Param\\s+name="${name}"\\s+value="([^"]*)"`).exec(xml)
  return match?.[1]
}

function main() {
  const configPath = process.argv[2] ?? process.env.ASAM_QC_FRAMEWORK_CONFIG_FILE
  if (!configPath) {
    console.error('no config file: pass one as argv[1] or set ASAM_QC_FRAMEWORK_CONFIG_FILE')
    process.exit(2)
  }

  const config = readFileSync(configPath, 'utf8')
  const inputFile = param(config, 'InputFile')
  if (!inputFile) {
    console.error(`config ${configPath} declares no InputFile param`)
    process.exit(2)
  }
  // Relative paths in a config file are relative to the config file itself, which
  // is what the framework's working-directory convention amounts to.
  const inputPath = resolve(dirname(configPath), inputFile)
  const resultPath = resolve(dirname(configPath), param(config, 'resultFile') ?? 'result.xqar')

  const gaps = checkGeometryContinuity(readFileSync(inputPath, 'utf8'))
  writeFileSync(resultPath, gapsToXqar(gaps, { inputFile: inputPath, bundle: BUNDLE }), 'utf8')
  console.warn(`authoringGate: ${gaps.length} issue(s) → ${resultPath}`)
}

main()
