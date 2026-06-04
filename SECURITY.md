# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security reports.

Use GitHub's private vulnerability reporting instead: on this repository, go to
the **Security** tab → **Report a vulnerability** ("Privately report a
vulnerability"). That opens a private advisory visible only to maintainers.

When reporting, include where possible:

- affected component (e.g. API server, compiler, SPARQL policy, web client),
- a description and impact assessment,
- reproduction steps or a proof of concept,
- affected version / commit.

We aim to acknowledge a report within **5 business days** and to agree on a
disclosure timeline with the reporter. Please allow us reasonable time to
investigate and ship a fix before any public disclosure.

## Supported versions

This project is pre-1.0; only the latest release line receives security fixes.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
| < 0.1   | ❌        |

## Security model

A few design points relevant to deploying this service safely:

- **The LLM never writes SPARQL.** It fills a structured `SearchSlots` object
  via a single tool call; a deterministic compiler turns slots into SPARQL.
  The same slots always produce the same query, so prompt injection cannot
  produce an arbitrary query.
- **SPARQL policy gate.** Every compiled query passes an allow-list/sandbox
  gate (`@ontology-search/sparql/policy`) before execution; the compiler is
  held to it by a determinism snapshot suite.
- **HTTP boundary.** The API enforces a CORS allowlist (wildcard `*` is
  rejected in production), a request-body/`query` size cap, and an optional
  token-bucket rate limiter.
- **Authentication.** An optional API key (`API_KEY`) gates every route except
  `/health`. In production the server refuses to start unless either `API_KEY`
  is set **or** `API_ALLOW_UNAUTHENTICATED=true` is set to deliberately run
  open (e.g. behind a gateway that authenticates upstream). `/search` invokes
  an LLM per request, so an unauthenticated public endpoint is a cost/abuse
  vector — configure this consciously.
- **Configuration & secrets.** All configuration is validated at startup
  (Zod); secrets are read only from the environment and must never be
  committed. See `.env.example`.

## Dependencies

CI runs `pnpm audit` on production dependencies and fails on moderate-or-higher
advisories. Known low-severity advisories with no compatible patch are
documented in `pnpm-workspace.yaml`.
