/**
 * `NullAuthoringBackend` — a deterministic "engine unavailable" backend.
 *
 * Selected by `AUTHORING_MODE=null`. Lets the authoring pipeline (task 05) and
 * unit tests run without loading the WASM engine: it never touches the engine
 * and `validate` always fails with a single explanatory diagnostic. It reports
 * empty versions, so it is intentionally NOT subjected to `probeEngineVersions`
 * (the probe runs only for the WASM backend).
 */
import type {
  AuthoringBackend,
  AuthoringValidateOptions,
  AuthoringValidationResult,
  EngineInfo,
} from './backend.js'

export class NullAuthoringBackend implements AuthoringBackend {
  async describe(): Promise<EngineInfo> {
    return { engine: 'null', engineCommit: 'none', oscVersions: [], xsd: 'none' }
  }

  async validate(
    _xosc: string,
    _options?: AuthoringValidateOptions
  ): Promise<AuthoringValidationResult> {
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          line: 0,
          col: 0,
          message: 'Authoring engine unavailable (AUTHORING_MODE=null).',
        },
      ],
    }
  }

  async isReady(): Promise<boolean> {
    return true
  }

  async close(): Promise<void> {}
}
