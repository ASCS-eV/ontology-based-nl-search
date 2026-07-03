#!/usr/bin/env node
/**
 * Dev launcher — sets NODE_OPTIONS for the API server's heap requirement
 * (Oxigraph WASM + SHACL validator + Copilot SDK subprocess ≈ 4–5 GB)
 * then delegates to turbo.
 */
import { execSync } from 'node:child_process'

process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS ?? '', '--max-old-space-size=8192']
  .filter(Boolean)
  .join(' ')

// `turbo run dev` starts one PERSISTENT task per package that has a `dev`
// script. Turbo refuses to run when its concurrency limit is not strictly
// greater than the number of persistent tasks (otherwise the graph can never
// make progress), and the default limit is 10. The workspace now has more than
// 10 dev servers, so pin a generous limit here. Persistent watchers are mostly
// idle after their initial compile, so a high cap is harmless — it only needs
// to exceed the number of packages with a `dev` task.
const DEV_CONCURRENCY = 20

try {
  execSync(`turbo run dev --concurrency=${DEV_CONCURRENCY}`, { stdio: 'inherit', env: process.env })
} catch {
  process.exit(1)
}
