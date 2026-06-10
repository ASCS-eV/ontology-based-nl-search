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

try {
  execSync('turbo run dev', { stdio: 'inherit', env: process.env })
} catch {
  process.exit(1)
}
