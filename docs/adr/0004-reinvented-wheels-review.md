# ADR 0004 — Reinvented-wheels review: deliberate keeps

- **Status:** Accepted
- **Date:** 2026-06-22

## Context

The architecture audit asked: are we re-implementing something a well-maintained
library already does well? Three custom utilities were flagged as candidates for
replacement by an off-the-shelf dependency:

1. **The SSE parser** — `@ontology-search/core/sse/parser` (`parseSSEBuffer`),
   versus [`eventsource-parser`](https://www.npmjs.com/package/eventsource-parser).
2. **The LRU cache** — `@ontology-search/core/cache/lru` (`LruCache`), versus
   [`lru-cache`](https://www.npmjs.com/package/lru-cache) (isaacs).
3. **The Levenshtein edit distance** — the `editDistance` helper inside
   `@ontology-search/llm`'s `slot-validator`, versus
   [`fastest-levenshtein`](https://www.npmjs.com/package/fastest-levenshtein).

"Prefer well-maintained libraries" is a real value, but so is not taking a
dependency that buys nothing — every dependency is supply-chain surface, a
version-bump obligation, and a place semantics can silently drift from what our
tests pin. This ADR records the review and the decision for each.

## Decision

**Keep all three custom implementations.** Each is small, correct, covered by
tests that pin its exact semantics, and operates in a regime where the library
alternative gives no measurable benefit — or is not a drop-in at all.

### 1. SSE parser — keep (the alternative is not a drop-in)

`parseSSEBuffer(buffer, pendingEvent)` is a **pure, synchronous** function that
returns `{ events, remainder, pendingEvent }`: the caller owns the cross-chunk
buffering and decides when to read. The web client drives exactly this loop in
`useSearchExecution.ts`, the parser JSON-deserializes the `data:` payload, fires
only on _named_ events, and treats a malformed `data:` line as a dropped event so
one bad frame can't kill the stream (guarded — core C13).

`eventsource-parser` is a **stateful push/callback** API (`createParser({ onEvent })`
fed via `.feed()`), with its own framing and no JSON handling. It is consumer-side
only — the API server produces SSE through Hono's `streamSSE`, not this parser — so
the swap would rewrite the web client's stream-reading loop in `useSearchExecution.ts`
and its `sse-parser.ts` wrapper, trading a tested pure function for a callback object
whose buffering we no longer control, and the existing tests, which call
`parseSSEBuffer` directly, would not cover the rewrite. Not a drop-in; no benefit.
**Keep.**

### 2. LRU cache — keep (low value; would re-emulate our pinned semantics)

`LruCache<K,V>` takes `{ maxSize, ttlMs? }`, uses the O(1) Map-iteration-order
pattern (delete-and-reinsert on hit, delete-first on overflow), and the SPARQL
result-cache wrapper additionally deep-freezes the stored reference and returns it
without a per-hit clone (guarded — core C14, sparql P9). These semantics are
exact and tested.

`lru-cache` (isaacs) is excellent but uses a different option surface (`{ max }`)
and different defaults around refresh-on-get / stale handling; we would have to
configure it specifically to _emulate_ the semantics our tests already pin, for a
cache whose only consumers are a result cache and a rate-limiter bucket store.
The swap is net-neutral at best and adds a dependency. **Keep.**

### 3. Levenshtein — keep (short strings; bespoke wrapper; a swap buys nothing)

`editDistance` is a ~30-line Wagner–Fischer DP with `O(min(n,m))` space and the
usual short-circuits. It is **not** used raw: it feeds a bespoke normalized
`similarity` score, a token-wise scorer, and IRI-local-name matching, all tuned by
thresholds the slot-validator tests pin (llm L5/L8).

`fastest-levenshtein` would be a clean drop-in for `editDistance` _the function_
(the `similarity` wrapper stays intact), and its Myers bit-parallel algorithm is
genuinely faster — **for long strings**. Here the inputs are short identifiers
(property local names, enum values), where the asymptotic win is immaterial and
the constant-factor difference is noise. Replacing a correct, tested, dependency-
free function with a dependency for no measurable speedup is dependency bloat, not
best practice. **Keep** — re-evaluate only if a long-string fuzzy-match workload
ever appears.

## Consequences

- No new dependencies; supply-chain surface unchanged.
- The decision is now discoverable: a future contributor tempted to "just use the
  library" finds the rationale here instead of re-litigating it.
- The keeps are only safe because their semantics are pinned by tests (core C13/C14,
  sparql P9, llm L5/L8). Those tests are the contract; if a behavior they pin ever
  needs to change, this ADR should be revisited alongside them.
- If the regime ever shifts — a streaming consumer that wants a push API, a cache
  that needs stale-while-revalidate, or long-string fuzzy matching — the
  corresponding library becomes the right call and this ADR is superseded for that
  item.

## Alternatives considered

- **Swap all three for libraries.** Rejected: one is not a drop-in (SSE), one would
  be configured to re-emulate our tested semantics (LRU), and one buys no
  measurable benefit on our short-string inputs (Levenshtein).
- **Swap only `fastest-levenshtein`** (the one clean drop-in). Rejected for now: a
  dependency with no measurable benefit on short identifiers is not worth the
  supply-chain/maintenance cost. Recorded as the single item most likely to flip if
  inputs grow.

## Related

- [ADR 0003](./0003-decompose-search-package.md) — the decomposition whose audit
  surfaced these candidates (finding 7).
- Module READMEs (`core`, `sparql`, `llm`) — the requirement tables citing the tests
  that pin these utilities' semantics.
