# AGENTS.md

Cross-tool instructions for AI coding agents (GitHub Copilot CLI, Claude Code,
Codex, and any other agent) working in this repository. This file is the
canonical source for the Token Efficiency Policy below — it is mirrored in
`CLAUDE.md` and `.github/copilot-instructions.md` for tools that only load
their own dedicated instructions file. If you edit the policy, update all
three copies together.

## Token Efficiency Policy

- **Model tiering** — use the smallest model capable of the task: lightweight/
  fast models for exploration, mechanical edits, and running tests/lint/build;
  escalate to a higher-capability model only for cross-package architecture
  work, ontology/standards-compliance reasoning, or changes touching the
  invariants documented in `CLAUDE.md` (module layering, the ontology-name
  budget, the deterministic-compiler guarantee).
- **Parallel, batched tool calls** — batch independent reads/searches/edits
  into one round instead of issuing them sequentially.
- **Targeted reads** — read only the relevant line ranges of large files;
  don't dump whole files into context when a section will do.
- **Scoped validation** — run tests/lint/typecheck scoped to the affected
  package(s) (`pnpm --filter <pkg>`) while iterating; run the full
  `pnpm run validate` once per work cycle before finishing, not after every
  edit.
- **Sub-agent delegation** — delegate exploratory, repetitive, or read-only
  work to lightweight sub-agents/background tasks so the primary context
  stays focused on decision-relevant material.
- **Cached reference data** — reuse the pinned `.ontology/` cache instead of
  re-fetching ontology data per session.
- **Minimal blast radius** — keep changes scoped to the packages required by
  the task, respecting the module layering
  (`core → sparql/ontology → search → llm → api/web`); don't touch unrelated
  layers speculatively.

This applies identically to GitHub Copilot CLI, Claude Code, Codex, and any
other AI coding agent operating in this repository.
