/**
 * Load the committed esmini WebAssembly module in the browser.
 *
 * `esmini.js` is an Emscripten MODULARIZE build (`EXPORT_NAME=esmini`,
 * `SINGLE_FILE=1` — the .wasm is base64-inlined), i.e. a classic script that
 * assigns a global factory `window.esmini`, not an ES module. Rather than let
 * the bundler try to parse/transform the ~3 MB glue, we import it as a static
 * asset URL (`?url`) and inject it with a <script> tag, then read the factory
 * off `window`. This mirrors how the package keeps the browser-loading concern
 * (this file) out of the framework-agnostic facade (which only takes a factory).
 *
 * The promise is memoised so the module is fetched and instantiated once, no
 * matter how many viewers mount; a failed load clears the memo so a later mount
 * can retry.
 */
import type { EsminiFactory } from '@ontology-search/scenario-viewer-wasm'
import esminiUrl from '@ontology-search/scenario-viewer-wasm/esmini.js?url'

declare global {
  interface Window {
    esmini?: EsminiFactory
  }
}

let factoryPromise: Promise<EsminiFactory> | null = null

/**
 * Resolve to the esmini module factory, loading `esmini.js` on first call.
 * @param scriptUrl overrides the asset URL (tests inject a stub); defaults to
 *   the bundled artifact.
 */
export function loadEsminiFactory(scriptUrl: string = esminiUrl): Promise<EsminiFactory> {
  if (factoryPromise) return factoryPromise

  factoryPromise = new Promise<EsminiFactory>((resolve, reject) => {
    if (window.esmini) {
      resolve(window.esmini)
      return
    }
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.addEventListener('load', () => {
      if (window.esmini) resolve(window.esmini)
      else {
        factoryPromise = null
        reject(new Error('esmini.js loaded but window.esmini is undefined'))
      }
    })
    script.addEventListener('error', () => {
      factoryPromise = null
      reject(new Error(`failed to load esmini.js from ${scriptUrl}`))
    })
    document.head.appendChild(script)
  })
  return factoryPromise
}

/** Test-only: drop the memoised factory so each test starts clean. */
export function resetEsminiFactoryForTests(): void {
  factoryPromise = null
}
