# Local model evaluation

This repository evaluates local language models against the production natural-language search path. The model fills `SearchSlots`; deterministic SHACL validation and the existing compiler remain responsible for ontology safety and SPARQL. Scenario authoring is outside this benchmark.

The framework commits candidates, gold expectations, schemas, scoring, and tests. Model weights and generated benchmark runs stay local under `.eval-runs/`. The repository does not claim that any candidate passes until a reproducible local run demonstrates it.

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
  --api-key "$OPENAI_API_KEY" \
  --model gpt-5.4-mini \
  --case env-001
```

Authentication is a platform API key against the documented OpenAI endpoint. The key is read from the argument and never written to evaluation artifacts.

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

Alternatively, pass a launch descriptor. The process is spawned directly without a shell in its own process group, readiness is polled, and the whole group is terminated on completion, timeout, or abort so forked inference workers cannot survive holding VRAM:

```json
{
  "executable": "/opt/vllm/bin/vllm",
  "args": ["serve", "Qwen/Qwen3.5-9B", "--revision", "c202236235762e1c871ad0ccb60c8ee5ba337b9a"],
  "readinessUrl": "http://localhost:8000/health",
  "readinessTimeoutMs": 600000,
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

`readinessTimeoutMs` (default 10 minutes) budgets model load; `shutdownTimeoutMs` budgets a graceful stop. They are separate because loading a checkpoint takes minutes while stopping should take seconds.

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

If the tokenizer protocol is absent, capacity is `not-supported` and the command exits 0: the measurement could not be taken, which is not evidence against the candidate. Only a real `failed` outcome exits nonzero. The harness never estimates a pass from character counts. Server-reported token usage is retained when available.

Use `--suite toyverse` to run the separate synthetic ontology-grounding suite. The CLI re-executes this suite in a child process with the committed Toyverse fixture root.

## Gates and interpretation

The protocol gate requires 100% known, schema-valid tool calls and 100% `submit_slots` completion within the step budget. Transport failures — timeouts, refused connections, HTTP errors — are recorded separately from protocol conformance and mark the run inconclusive rather than condemning the model.

The quality gate requires:

- at least 99% submission success;
- at least 90% post-SHACL exact-slot accuracy overall;
- at least 85% in every critical category declared for the suite under test;
- no ontology identifier invented and retained by validation; and
- no more than five percentage points between English and German exact accuracy, applied only when the corpus measured both.

A metric over zero samples is reported as `null` — "not measured" — and never as a score. A run with no measured samples fails rather than passing on absent evidence. Critical categories are declared per suite, so the Toyverse grounding suite is held to the categories it covers rather than to the ENVITED-X set.

Raw-slot exactness and post-SHACL validated exactness are separate. Validated exactness is the production-quality score. Canonicalization sorts domains, filter values, and reference siblings while preserving recursive reference topology; identifiers and enum/IRI values remain case-sensitive. Free-form interpretation summary wording is not scored.

Reports also include field and gap precision/recall, reference topology, lookup efficiency, fallback and compilation rates, p50/p95/MAD latency, server token usage, and peak RAM/VRAM. Peak VRAM is attributed per process via `nvidia-smi --query-compute-apps`, summed across devices over the server's process tree, so another tenant's allocation is never counted as the candidate's; device-wide usage above that figure is reported as competing GPU load instead. A performance sample is retained but marked incomparable after swap growth, server restart, incomplete sampling, or competing GPU load. Missing `nvidia-smi`, permissions, CPU-only collection, ROCm/Metal, and client-only telemetry appear as coverage states rather than zero measurements.

## Artifacts and comparison

Each run writes:

```text
.eval-runs/<runId>/
├── manifest.json
├── samples.ndjson
├── summary.json
└── report.md
```

The manifest records the policy that actually ran — context, temperature, concurrency, step budget, lookup tools, retrieval limits — read from the live policy rather than restated, so the run digest changes whenever the evaluated configuration does. A policy that drifts from the held-constant contract fails the run before any endpoint I/O. Keep all four files together when sharing evidence, but do not commit generated results.

Compare passing quality summaries with:

```bash
pnpm eval:models compare \
  .eval-runs/<run-a> \
  .eval-runs/<run-b>
```

For 16, 24, and 32–48 GiB independently, `compare` selects the smallest passing artifact within two percentage points of the best validated score. A tier with no passing candidate is reported as `none` with the reason; `compare` exits nonzero when any tier is unresolved or a performance run is incomparable.

For reproducibility, report the Git commit, candidate ID, served model/artifact, launch command, server/runtime version, driver version, hardware, profile, complete run directory, and whether any background GPU workload was present.
