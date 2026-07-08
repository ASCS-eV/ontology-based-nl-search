import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // Both suites cold-start their own Oxigraph WASM store: the eval suite
    // against the full workspace ontology, the swap suite against the
    // toyverse fixture. Generous ceiling; hot assertions are fast.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // The suites configure ONTOLOGY_ROOT differently (workspace vs temp
    // fixture root) and the store is a per-process singleton — files must
    // not share a process.
    fileParallelism: false,
    isolate: true,
  },
})
