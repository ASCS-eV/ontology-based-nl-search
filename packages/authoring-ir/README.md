# @ontology-search/authoring-ir

> The authoring IR — the structured "scene slots" the LLM fills to author an OpenSCENARIO scenario.

**Layer:** a leaf contract package (rank 0) whose only runtime dependency is `zod`. Importable by any higher layer (`authoring`, `authoring-gate`, `llm`, `api`, `web`) without pulling in the WASM engine, Oxigraph or `fs`.

## Purpose

This is the authoring half of the system's central security invariant, and the exact mirror of `@ontology-search/slots` on the search side: **the LLM emits only this IR, never raw `.xosc`.** A deterministic lowering turns the IR into an OpenSCENARIO document, and the gates validate it. No prompt injection can produce arbitrary XML, because arbitrary XML is not a value the model can express.

The web client edits this same IR — the `.xosc` shown in the UI is read-only and derived — which is why the IR travels over the wire (`SSE_EVENT.SCENE`) and has a Zod schema rather than living only in the server's head.

Like the slot IR, it is **generic by construction**: entities, actions, parameters and references are named by their OpenSCENARIO roles, not by any one scenario's vocabulary.

## Public interface

| Subpath               | Purpose                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                   | Everything below, re-exported.                                                                                                          |
| `./scene`             | The IR types — `AuthoringIR`, `SceneEntity`, `SceneAction` — plus the `createEmptyScene` constructor.                                   |
| `./scene-wire-schema` | The Zod wire schema (`authoringIrWireSchema`) the `submit_scene` tool call and the `/author/refine` request body are validated against. |

## Requirements & invariants

| #   | Requirement / invariant                                                                                                                                                          | Guarding test                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| IR1 | The boundary is **strict**: an unknown top-level key is rejected, not passed through. This is what stops a raw `.xosc` being smuggled in — the IR has no field that carries XML. | `__tests__/scene-wire-schema.test.ts` — "rejects unknown top-level keys"    |
| IR2 | A structurally incomplete scene is rejected: an entity without `ref`, an action without `actor`.                                                                                 | `__tests__/scene-wire-schema.test.ts` — "rejects an entity missing its ref" |
| IR3 | Omitted `entities` / `actions` / `properties` default to empty rather than `undefined`, so consumers never branch on absence.                                                    | `__tests__/scene-wire-schema.test.ts` — "applies defaults for omitted…"     |
| IR4 | Array-valued (IN-style) properties are accepted, and the `$param` indirection round-trips.                                                                                       | `__tests__/scene-wire-schema.test.ts` — "accepts array-valued properties"   |
| IR5 | `createEmptyScene` yields a valid empty IR, optionally archetype-tagged, so a model that never submits still produces a well-formed artifact to attach gaps to.                  | `__tests__/scene-wire-schema.test.ts` — `describe('createEmptyScene')`      |
| IR6 | The IR wire format is held to **JSON Schema 2020-12** (`[JSON-SCHEMA-CORE]`) — the AI SDK serializes this Zod schema for the `submit_scene` tool call.                           | review checklist; `apps/docs/standards-audit.md`                            |
| IR7 | Zero ontology-specific identifiers in source (criterion 9b).                                                                                                                     | review checklist                                                            |

## How to interface

```ts
import type { AuthoringIR, SceneAction } from '@ontology-search/authoring-ir'
import { createEmptyScene } from '@ontology-search/authoring-ir'
import { authoringIrWireSchema } from '@ontology-search/authoring-ir/scene-wire-schema'
```

## See also

- `@ontology-search/authoring` — the backend seam that lowers this IR to `.xosc`.
- `@ontology-search/authoring-gate` — the semantic / structural / residual gates run over it.
- `@ontology-search/slots` — the same idea on the search side.
- ADR [0006](../../docs/adr/0006-authoring-wasm-engine-ops-model.md) — the engine this IR is lowered through.
