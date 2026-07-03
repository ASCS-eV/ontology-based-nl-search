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

Each contract below is guarded by a named test. The security model rests on L1–L4: the LLM only ever fills a single `submit_slots` tool call, the agent reads that tool channel and never the model's prose, and every value is validated against the live SHACL graph before the deterministic compiler emits SPARQL — so no prompt injection can produce an arbitrary query.

| #   | Requirement / invariant                                                                                                                                                                                                     | Guarded by                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | **The LLM never writes SPARQL** — the agent reads only the tool channel; model text (incl. an injected `DROP ALL` / authored query) is ignored, falling back to compiler-generated SPARQL                                   | `src/agent/__tests__/agent-boundary.test.ts` ("falls back to compiler-generated SPARQL when no tool call is made — LLM text is ignored", "ignores a SPARQL string emitted in result.text…")                                       |
| L2  | **Slots-only via `submit_slots`** — only the `submit_slots` tool is consumed; other/hallucinated tool names are dropped; the first call wins                                                                                | `src/agent/__tests__/agent-boundary.test.ts` ("ignores tool calls with names other than submit_slots", "uses only the first submit_slots when the LLM emits multiple")                                                            |
| L3  | **Forced single tool, no investigation tools** — both adapters expose exactly `submit_slots`; `forcedTool` is always `submit_slots`                                                                                         | `src/agent/__tests__/agent-policy-contract.test.ts` ("Vercel adapter passes only agentTools (submit_slots)…", "Copilot adapter registers exactly one tool (submit_slots)", "AgentPolicy.forcedTool is always submit_slots")       |
| L4  | **Copilot provider holds the same boundary** — only the routed `submit_slots` submission compiles; prose and malformed submissions fall back deterministically                                                              | `src/agent/__tests__/copilot-agent-boundary.test.ts` ("never emits LLM prose as SPARQL…", "a malformed tool submission is rejected by the router → deterministic fallback")                                                       |
| L5  | **Filter values fuzzy-corrected against `sh:in`** — case/typo variants snap to the canonical enum value; unrelated/substring-overlapping values pass through to the SHACL gate                                              | `src/__tests__/slot-validator.test.ts` ("corrects case-insensitive matches", "fuzzy-matches close values", "does not \"correct\" a substring-overlapping value to an unrelated enum")                                             |
| L6  | **SHACL Core gate drops invalid values** — values violating a declared constraint (e.g. ISO `sh:pattern`) and invented filter/range keys are removed and surfaced as gaps                                                   | `src/__tests__/shacl-slot-validation.test.ts` ("drops invalid elements and keeps valid ones", "drops an invented property name and emits an \"unknown property\" gap")                                                            |
| L7  | **Domain correction from surviving properties** — keys not belonging to the chosen domain merge in the property's actual domain(s); multi-domain respected; no phantom domains                                              | `src/__tests__/slot-validator.test.ts` ("corrects domain when filters belong to a different domain", "never injects a phantom domain for an unattributed (empty-domain) property")                                                |
| L8  | **Objective confidence + gap enrichment** — confidence recomputed from the outcome (exact→high, fuzzy→medium, unmatched→low+gap); gaps get nearest-vocabulary suggestions                                                   | `src/__tests__/slot-validator.test.ts` ("recomputes confidence to high for exact matches", "keeps unmatchable values as low-confidence and reports as gap", "enriches gaps with suggestions from vocabulary")                     |
| L9  | **Prompt grounded in the live SHACL graph, not hardcoded names** — raw SHACL Turtle embedded verbatim; domain headers derived mechanically; a new kebab-case domain surfaces with no code change                            | `src/__tests__/prompt-builder.test.ts` ("includes raw SHACL Turtle content", "renders an arbitrary new kebab-case domain id with title-cased words")                                                                              |
| L10 | **Empty-slot fallback is generic and explanatory** — when nothing is submitted, the broadest cross-domain query compiles and the hint draws example property names from the live vocabulary                                 | `src/agent/__tests__/empty-fallback.test.ts` ("derives example property names from the live vocabulary", "falls back to a generic, property-free hint when the vocabulary is empty")                                              |
| L11 | **Concurrent Copilot submissions routed by exact token** — the SubmissionRouter delivers each submission to its registered callback by exact `requestToken` (never recency), strips the token, rejects unknown payloads     | `src/agent/__tests__/submission-router.test.ts` ("routes by exact token regardless of insertion order", "strips requestToken from the payload delivered to the callback", "rejects unknown tokens without invoking any callback") |
| L12 | **Reference-scoped constraints held to the same gates** — cross-references AND-combine, are projected, and their nested `filters`/`ranges` pass the same fuzzy/SHACL validation; unresolvable reference domains are dropped | `src/agent/__tests__/run-slot-pipeline.test.ts` ("projects every referenced asset across multiple reference domains", "drops the references slot when its domain isn't an asset domain")                                          |
| L13 | **Provider facade selected from env, credentials guarded** — `getModel` switches on `AI_PROVIDER`/`AI_MODEL`; a group/world-readable credentials file is refused (criterion #27)                                            | `src/__tests__/provider.test.ts` ("rejects 0644 (group + other readable) credentials with CredentialsPermissionError", "returns the access token for a valid, unexpired credentials file")                                        |

> The slot wire format is held to **JSON Schema 2020-12**: the Zod schemas the `submit_slots` tool serializes come from `@ontology-search/slots`. The `getModel` provider-`switch` branch selection (which `LanguageModel` each `AI_PROVIDER` yields) is review-checklist (only its credential-parsing helpers are unit-tested).

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
