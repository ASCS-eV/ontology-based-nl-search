# @ontology-search/llm

> LLM interpretation layer: builds the SHACL-grounded prompt, runs the multi-provider slot-filling agent, and validates the returned slots.

**Layer:** `… ← search ← llm`. Top of the library stack, below the apps. Depends on `@ontology-search/core` and `@ontology-search/search`, plus the Vercel AI SDK and provider adapters (`@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/mistral`, `@github/copilot-sdk`).

## Purpose

Turns a natural-language query into a structured `SearchSlots` IR. It builds the system prompt by embedding raw SHACL shapes so the model is grounded in the real ontology, runs the slot-filling agent across multiple providers, and validates and corrects the returned slots against the SHACL vocabulary before they reach the compiler. The model fills a single `submit_slots` tool call — it **never writes SPARQL**.

## Public interface

| Subpath            | Purpose                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `.`                | Facade: `generateStructuredSearch`, `warmupAgentPrompt`, slot validation |
| `./types`          | `LlmStructuredResponse`, `OntologyGap`, and related interpretation types |
| `./prompt-builder` | `buildSystemPrompt`, `ShaclDomainContent`                                |

The `agent/` subdirectory (provider adapters, tool schema, Copilot session, submission router) is intentionally **not** exported — consumers go through the facade so internals can be refactored freely. Providers: OpenAI, Anthropic, claude-cli, vibe-cli/Mistral, Ollama (via the Vercel AI SDK) plus the GitHub Copilot SDK.

## Requirements & invariants

- **The LLM never writes SPARQL.** It fills a single `submit_slots` tool call producing `SearchSlots`; the deterministic compiler in `@ontology-search/search` turns those slots into a query. This is the security boundary.
- Slots returned by the model are validated and corrected against the SHACL `sh:in` vocabulary and property→domain map before they are handed to the compiler.
- The prompt is grounded in the live SHACL graph, not in hardcoded ontology names.
- Callers must supply provider credentials/config via the environment; the facade selects the active provider.

## How to interface

```ts
import { generateStructuredSearch } from '@ontology-search/llm'

const result = await generateStructuredSearch({
  query: 'German highways with 3 lanes',
  // schema/vocab context …
})

// result.slots is the validated SearchSlots IR, ready for the compiler.
```

## See also

- [Root README](../../README.md)
- [Agent Design](../../apps/docs/agent.md)
- [`@ontology-search/search`](../search/README.md) — consumes the slots this layer produces
