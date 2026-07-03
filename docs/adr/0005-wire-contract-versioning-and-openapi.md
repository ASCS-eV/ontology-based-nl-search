# ADR 0005 — Wire-contract versioning & OpenAPI: deferred

- **Status:** Accepted (decision: defer)
- **Date:** 2026-06-22

## Context

The architecture audit asked whether the HTTP API should (a) version its wire
contract behind a `/v1` prefix and (b) publish an **OpenAPI** description of the
Hono + Zod routes — the "partner-facing contracts" track noted in
[ADR 0001](./0001-graphql-editor-schema-from-discovery.md#related).

Today's reality:

- The API has **one consumer: the first-party web client.** There is no external
  or partner integrator.
- Client and server already share the wire shapes at the **source level** via
  `@ontology-search/api-types` (a zero-dependency, browser-safe types package both
  `apps/api` and `apps/web` import). Drift between the two is impossible by
  construction — a server-side shape change that the client doesn't match fails
  `tsc` in CI, not at runtime.
- The routes are validated by Zod at the boundary, and every wire contract (status
  codes, SSE event sequence, route shapes conforming to `api-types`) is pinned by
  the `apps/api` test suite (README A1–A21).

OpenAPI and URL versioning earn their keep when **independent, separately-deployed
consumers** need a discoverable, machine-readable, independently-versioned contract
they can't get by importing your types. We have none of that yet.

## Decision

**Defer both `/v1` URL versioning and a published OpenAPI document until the first
external/partner consumer exists.** Adopting them now would be ceremony without a
consumer: a second representation of a contract that already has a single source of
truth (`api-types` + the Zod schemas), adding maintenance surface and a drift risk
(spec vs. code) that the current source-level sharing does not have.

This is a deliberate _not yet_, not a rejection. The triggers and the intended
approach are recorded so the decision isn't silently lost.

### Triggers to revisit (any one flips this ADR)

- A second, independently-deployed consumer of the HTTP API appears (a partner
  integration, a separate service, a public/offered API).
- A consumer needs the contract in a language or toolchain that can't import the
  TypeScript `api-types` package.
- We commit to a backward-compatibility guarantee across releases that requires an
  explicit, versioned, published contract.

### Intended approach when a trigger fires (not built now)

- **OpenAPI from the Zod schemas, not hand-written** — generate the document from
  the existing route Zod schemas (e.g. `@hono/zod-openapi` or an equivalent
  Zod→OpenAPI generator) so the spec is derived from the code and cannot drift,
  preserving the project's single-source-of-truth principle. A hand-maintained
  spec is explicitly rejected.
- **Introduce the `/v1` prefix at the same time**, when there is an external
  contract to stabilize — not before, so we don't ship a version number nobody
  consumes.
- Continue to expose the standardized **Fuseki SPARQL 1.1** endpoint for partners
  who need direct graph access (ADR 0001) — already a well-maintained, standard
  contract requiring no new invention.

## Consequences

- No new dependency, no `/v1` churn, no second contract representation to keep in
  sync today.
- The first-party contract stays enforced where it is strongest: shared types
  (`api-types`) + Zod validation + the route test suite.
- The cost is borne by the _future_ integrator-enablement work, where it belongs;
  this ADR ensures that work starts from "generate OpenAPI from Zod + add `/v1`"
  rather than re-debating the question.

## Alternatives considered

- **Adopt `/v1` + OpenAPI now.** Rejected: no external consumer, and it would add a
  spec that can drift from the code while delivering nothing the shared `api-types`
  package doesn't already deliver for the one consumer we have.
- **Hand-write an OpenAPI spec.** Rejected outright (now and later): it would be a
  second source of truth, exactly the drift the rest of the architecture is designed
  to prevent.

## Related

- [ADR 0001](./0001-graphql-editor-schema-from-discovery.md) — names the
  partner-facing OpenAPI + Fuseki track this ADR scopes and defers.
- [ADR 0003](./0003-decompose-search-package.md) — finding 9, which this closes.
- `apps/api/README.md` — the route contract (A1–A21) currently enforced by tests
  and `@ontology-search/api-types`.
