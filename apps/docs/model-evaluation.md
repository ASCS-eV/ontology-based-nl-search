# Local model evaluation

This repository evaluates local language models against the production natural-language search path. The model fills `SearchSlots`; deterministic SHACL validation and the existing compiler remain responsible for ontology safety and SPARQL. Scenario authoring is outside this benchmark.

The framework commits candidates, gold expectations, schemas, scoring, and tests. Model weights and generated benchmark runs stay local under `.playground/eval-runs/`. The repository does not claim that any candidate passes until a reproducible local run demonstrates it.

## What is held constant

Every runnable artifact uses:

- a 65,536-token configured context;
- temperature `0`, concurrency `1`, and thinking disabled (or the runtime's documented minimum for a model that cannot fully disable it);
- the production prompt, four lookup tools plus `submit_slots`, the three-step agent limit, SHACL slot pipeline, and SPARQL compiler;
- the committed retrieval limits and exact candidate revision, quantization, parser, and chat-template arguments.

`pnpm eval:models list` prints the candidate inventory. A candidate is an entire runtime artifact—not just a model family. Changing the revision, quantization, tool parser, chat template, server, or context creates a different artifact and requires a separate run.

The ranked inventory is Apache-2.0/MIT-only. Custom-license and noncommercial alternatives are documented as exclusions in `packages/testing/src/model-eval/candidates.json` and are not runnable shortlist entries.

## Hardware tiers

| Tier      | Intended evaluation envelope                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| 16 GiB    | Small dense or low-bit sparse artifacts whose weights and 64k KV estimate leave practical server headroom.                |
| 24 GiB    | Mid-size dense or quantized artifacts; verify actual allocation because runtime kernels and vision encoders add overhead. |
| 32–48 GiB | Larger dense/sparse artifacts, potentially with CPU offload or multiple devices when explicitly recorded.                 |

The manifest records OS, container/WSL state, CPU, logical cores, RAM, swap, cgroup memory limit, GPU UUID/model/VRAM, and telemetry coverage. The estimates in the candidate inventory are planning inputs, not measured capacity guarantees.

## Validate the framework

Run this before contacting a model:

```bash
pnpm eval:models check
```

The command validates candidate uniqueness and licensing, corpus invariants, committed JSON Schema drift, every ENVITED-X expected domain/property/enum/IRI, and the Toyverse suite. Toyverse runs in a separate process with its fixture ontology so the global ontology caches cannot mix.

To intentionally update the JSON Schema 2020-12 artifacts after a type change:

```bash
pnpm eval:models schemas
pnpm eval:models check
```

## Hosted framework smoke test

When no suitable local runtime fits the current machine, run one scored ENVITED-X case through the same production prompt, five tools, three-step policy, SHACL validation, and compiler with a hosted Responses model:

```bash
pnpm eval:models smoke \
  --auth codex-cli \
  --model gpt-5.4-mini \
  --case env-001
```

`codex-cli` reuses the current ChatGPT login from `~/.codex/auth.json`, after checking that the credential file is owner-only and the access token is not expired. The token and account identifier remain in memory and are never printed or written to evaluation artifacts. Run `codex login` first when no valid session exists.

An OpenAI API key is an alternative, not a requirement:

```bash
pnpm eval:models smoke \
  --auth api-key \
  --api-key "$OPENAI_API_KEY" \
  --model gpt-5.4-mini \
  --case env-001
```

The smoke command is deliberately non-ranked: it writes no candidate run and makes no local benchmark claim. Its JSON output reports protocol completion, raw and validated exactness, compilation validity, tool path, server token usage when present, and invented identifiers. A passing smoke proves that one request completed end to end; it does not satisfy the protocol or quality gates.

## Start a compatible runtime

Use the exact revision and parser shown by the candidate manifest. For a vLLM candidate, the shape is:

```bash
vllm serve Qwen/Qwen3.5-9B \
  --revision c202236235762e1c871ad0ccb60c8ee5ba337b9a \
  --max-model-len 65536 \
  --enable-auto-tool-choice \
  --tool-call-parser qwen3_coder \
  --generation-config vllm \
  --chat-template-kwargs '{"enable_thinking":false}'
```

For a llama.cpp variant, serve the pinned quantized artifact through `llama-server` with a 65,536-token context and the candidate's matching tool-call template/parser. Record the actual served artifact with `--model`; the source revision alone does not identify a derived GGUF.

An external server can be sampled by PID:

```bash
pnpm eval:models run \
  --candidate qwen3.5-9b \
  --profile protocol \
  --base-url http://localhost:8000/v1 \
  --server-pid 12345
```

Alternatively, pass a launch descriptor. The process is spawned directly without a shell, readiness is polled, and the child is terminated on completion, timeout, or abort:

```json
{
  "executable": "/opt/vllm/bin/vllm",
  "args": ["serve", "Qwen/Qwen3.5-9B", "--revision", "c202236235762e1c871ad0ccb60c8ee5ba337b9a"],
  "readinessUrl": "http://localhost:8000/health",
  "shutdownTimeoutMs": 10000
}
```

```bash
pnpm eval:models run \
  --candidate qwen3.5-9b \
  --profile quality \
  --base-url http://localhost:8000/v1 \
  --launch .playground/qwen-server.json
```

Arguments and endpoint query parameters resembling API keys, tokens, secrets, or authorization values are redacted in artifacts. Prefer a local descriptor with no secrets. `--api-key` is accepted for protected external endpoints but is never written to the run files.

## Profiles

| Profile            | Protocol                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `protocol`         | The 30 high-risk cases, three repetitions in deterministic repetition-major round-robin order. |
| `quality`          | All 150 cases, three deterministic round-robin repetitions.                                    |
| `warm-performance` | Two excluded warmups, then five measured repetitions.                                          |
| `cold-load`        | A fresh descriptor-launched server for the measured cold request; requires `--launch`.         |
| `capacity`         | Separate synthetic near-64k request, verified with a compatible tokenizer endpoint.            |

Example capacity run against a vLLM-compatible tokenizer endpoint:

```bash
pnpm eval:models run \
  --candidate qwen3.5-9b \
  --profile capacity \
  --base-url http://localhost:8000/v1 \
  --tokenizer-url http://localhost:8000/tokenize \
  --server-pid 12345
```

If the tokenizer protocol is absent, capacity is `not-supported`; the harness never estimates a pass from character counts. Server-reported token usage is retained when available.

Use `--suite toyverse` to run the separate synthetic ontology-grounding suite. The CLI re-executes this suite in a child process with the committed Toyverse fixture root.

## Gates and interpretation

The protocol gate requires 100% known, schema-valid tool calls and 100% `submit_slots` completion within three steps.

The quality gate requires:

- at least 99% submission success;
- at least 90% post-SHACL exact-slot accuracy overall;
- at least 85% in every critical category;
- no ontology identifier invented and retained by validation; and
- no more than five percentage points between English and German exact accuracy.

Raw-slot exactness and post-SHACL validated exactness are separate. Validated exactness is the production-quality score. Canonicalization sorts domains, filter values, and reference siblings while preserving recursive reference topology; identifiers and enum/IRI values remain case-sensitive. Free-form interpretation summary wording is not scored.

Reports also include field and gap precision/recall, reference topology, lookup efficiency, fallback and compilation rates, p50/p95/MAD latency, server token usage, and peak RAM/VRAM. A performance sample is retained but marked incomparable after swap growth, server restart, incomplete sampling, or competing GPU load. Missing `nvidia-smi`, permissions, CPU-only collection, ROCm/Metal, and client-only telemetry appear as coverage states rather than zero measurements.

## Artifacts and comparison

Each run writes:

```text
.playground/eval-runs/<runId>/
├── manifest.json
├── samples.ndjson
├── summary.json
└── report.md
```

The manifest contains the candidate, hardware, endpoint collection mode, corpus digest, and a run digest covering the runtime policy and retrieval settings. Keep all four files together when sharing evidence, but do not commit generated results.

Compare passing quality summaries with:

```bash
pnpm eval:models compare \
  .playground/eval-runs/<run-a> \
  .playground/eval-runs/<run-b>
```

For 16, 24, and 32–48 GiB independently, `compare` selects the smallest passing artifact within two percentage points of the best validated score. It exits nonzero when a requested gate fails, a performance run is incomparable, or a tier has no passing quality candidate.

For reproducibility, report the Git commit, candidate ID, served model/artifact, launch command, server/runtime version, driver version, hardware, profile, complete run directory, and whether any background GPU workload was present.
