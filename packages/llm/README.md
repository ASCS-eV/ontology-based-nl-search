# @ontology-search/llm

The LLM interpretation layer. Builds the system prompt (embedding raw SHACL
shapes so the model is grounded in the real ontology), runs the slot-filling
agent across multiple providers, and validates/corrects the returned slots
against the SHACL vocabulary before they reach the compiler.

The LLM fills a single `submit_slots` tool call — it **never writes SPARQL**.

**Layer:** depends on `core`, `ontology`, `search`, `sparql` (top of the
library stack, below the apps).

## Exports

| Subpath            | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `.`                | Facade: `generateStructuredSearch`, `warmupAgentPrompt`, slot validation |
| `./types`          | `LlmStructuredResponse`, `OntologyGap`, …                                |
| `./prompt-builder` | `buildSystemPrompt`, `ShaclDomainContent`                                |

The `agent/` subdirectory (provider adapters, tool schema, Copilot session,
submission router) is intentionally **not** exported — consumers go through
the facade so internals can be refactored freely. Providers: OpenAI,
Anthropic, claude-cli, vibe-cli/Mistral, Ollama (via Vercel AI SDK) plus the
GitHub Copilot SDK.

See [Agent Design](../../apps/docs/agent.md).
