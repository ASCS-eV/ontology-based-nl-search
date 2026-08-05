# Startup Guide

## Prerequisites

- **Node.js** satisfying `engines.node` in the root `package.json` (`.nvmrc`
  pins the supported major — `nvm use` selects it). The install fails with the
  expected and running versions if it is not satisfied.
- **pnpm**, the version pinned by `packageManager` in the root `package.json`
  (`corepack enable` honors it automatically).
  Note: pnpm must be able to run `node` — the setup scripts are Node scripts.
  If you installed pnpm as a standalone binary and have no Node on `PATH`,
  install one (`pnpm env use --global 22`) before running `pnpm install`.
- **Git**

Verify both before installing:

```bash
node -v && pnpm -v
```

## Initial Setup (First Time Only)

```bash
# 1. Install dependencies. postinstall checks the Node version, materializes
#    the pinned ontology, and reports anything missing from the setup.
pnpm install

# 2. Create the environment file (`pnpm dev` also creates it if you forget).
cp .env.example .env.local

# 3. Edit .env.local — most importantly AI_PROVIDER. The default (`ollama`)
#    expects a local Ollama serving the model in AI_MODEL:
#        ollama pull qwen3:8b
#    Other providers are documented inline in the file.

# 4. Verify the machine is ready (exits non-zero and says what to fix)
pnpm run check:setup
```

> The ontology is **not** a git submodule. It is pinned by version + sha256 in
> `ontology-package.json` and materialized into `.ontology/` by
> `pnpm run fetch:ontology`, which `pnpm install` runs for you. The remaining
> submodules (`openscenario-api`, `esmini`, `asam-openx-assets`) are only
> needed for the authoring engine's build: `git submodule update --init`.

## Starting the Application

### Option 1: Start All Services at Once (Recommended)

```bash
pnpm dev
```

This will:

- ✅ Clean ports (3003, 5173, 5174)
- ✅ Start API server on port 3003
- ✅ Start web frontend on port 5174
- ✅ Start documentation on port 5173

**Wait for all services to show "ready" before accessing.**

### Option 2: Start Services Individually

Useful for debugging or if you only need specific services:

```bash
# Terminal 1: API server
pnpm run --filter @ontology-search/api dev:clean

# Terminal 2: Web frontend
pnpm run --filter @ontology-search/web dev:clean

# Terminal 3: Documentation (optional)
pnpm run --filter @ontology-search/docs dev
```

## Accessing the Application

Once all services are running:

| Service    | URL                         | Notes                 |
| ---------- | --------------------------- | --------------------- |
| **Web UI** | http://localhost:5174       | Main search interface |
| **API**    | http://localhost:3003       | Backend API           |
| **Docs**   | http://localhost:5173/docs/ | Project documentation |

## Common Issues

### Issue: "Search button is grayed out"

**Cause**: The search button is disabled until you type something.

**Solution**: Type a query in the search box (e.g., "German highways")

### Issue: "White page or blank screen"

**Cause**: Browser cache from previous sessions.

**Solution**:

1. Hard refresh: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac)
2. Or clear browser cache for localhost

### Issue: "Docs show 404"

**Cause**: Documentation server not started.

**Solution**:

```bash
# Check if docs are running
curl http://localhost:5173/docs/

# If not, start docs server
pnpm run --filter @ontology-search/docs dev
```

### Issue: "Port already in use"

**Cause**: Previous dev server wasn't shut down properly, or another application is using one of the ports (e.g., Hyper-V reserves certain ports on Windows).

**Solution**:

```bash
# Clean all development ports
pnpm run clean:ports

# Or clean one service's configured port
node scripts/clean-ports.mjs --api

# Then restart services
pnpm dev
```

**If ports are reserved by Hyper-V or another service:** See [PORT_CONFIGURATION.md](./PORT_CONFIGURATION.md) for how to change ports to avoid conflicts (e.g., use `API_PORT=3003 WEB_PORT=5174 DOCS_PORT=5173` in `.env.local`).

### Issue: "API not responding"

**Cause**: API server crashed or didn't finish warming up.

**Solution**:

```bash
# Check API health
curl http://localhost:3003/health

# Returns 503 {"status":"starting"|"degraded"} during/after a failed warmup,
# and {"status":"ok"} once warmup succeeds.

# Check API stats (also tests database connection)
curl http://localhost:3003/stats

# Should return JSON with asset counts
```

### Issue: "Searches return nothing" / `/health` says `degraded`

**Cause**: No ontology was loaded — almost always because the pinned ontology
cache was never materialized (a failed download on install, e.g. behind a
proxy). The ontology drives the LLM prompt, slot validation, and query
compiler, so without it the API starts **degraded** and every search is empty.
The web UI shows a banner with the same errors `/health` reports.

**Diagnose**:

```bash
# Reports 503 + the missing-ontology error while degraded:
curl -s http://localhost:3003/health

# Or check the sources directly:
pnpm run check:setup
```

**Solution**:

```bash
pnpm run fetch:ontology   # downloads + verifies the pinned distribution
# then restart the API
```

Behind a proxy, export `HTTPS_PROXY` / `NO_PROXY` in the same shell first —
Node does not read them on its own.

If you keep your ontology elsewhere, point `ONTOLOGY_ARTIFACTS_PATH` at it or
create an `ontology-sources.json` (see `ontology-sources.example.json` as
template).

### Note: sample instance data

During warmup, the API loads 5 sample TTL files: `sample-assets.ttl`, `sample-scenarios.ttl`, `sample-ositrace.ttl`, `sample-environment-models.ttl`, and `sample-surface-models.ttl`.

A healthy `/stats` response reports the sample-data totals — currently **358 assets**: 165 HD maps, 70 environment models, 53 OSI traces, 50 scenarios, and 20 surface models. (Exact counts track the sample TTL files and may shift as they evolve; any non-zero `totalAssets` with five domains means the store loaded correctly.)

**Wait time**: first cold start takes roughly **30–60 seconds** under `pnpm dev` (which runs the API via `tsx`). The dominant cost is building the compiler vocabulary (property-path discovery); the API logs `[n/8]` warmup steps so you can watch progress. `/health` returns `503` (`starting`/`degraded`) until warmup succeeds, then `200 ok` — with a `warnings` list when something non-fatal is unavailable, such as an unreachable LLM provider (searches fail with an actionable message, everything else still works).

## Stopping Services

### If started with `pnpm dev`:

- Press **Ctrl+C** in the terminal

### If started individually:

- Press **Ctrl+C** in each terminal

### To force kill:

```bash
pnpm run clean:ports
```

## Verifying Everything Works

Run this checklist:

```bash
# 1. Check all ports are listening
# Should show 3 entries: 3003, 5173, 5174
netstat -an | findstr "3003 5173 5174"

# 2. Test API
curl http://localhost:3003/health
curl http://localhost:3003/stats

# 3. Test Web (should return HTML)
curl http://localhost:5174

# 4. Test Docs (should return HTML with vitepress)
curl http://localhost:5173/docs/
```

## Testing the Search

1. Open http://localhost:5174
2. Type a query: **"German highways with motorway"**
3. Click **Search** button (should be blue and enabled)
4. Wait ~2-5 seconds for results
5. Inspect the interpretation panel to see how your query was understood

### Example Queries

- `"simulation assets"` → Cross-domain search (NEW!)
- `"German HD maps with motorway road types"` → Specific domain search
- `"rain scenarios"` → Scenario domain search
- `"maps from France"` → Location filter
- `"motorway maps with 3 lanes"` → Multiple filters

## Development Workflow

```bash
# Make code changes...

# Run validation before committing
pnpm run validate

# This runs:
# - Type checking
# - Linting
# - Formatting check
# - All unit tests
```

## Need Help?

- Run `pnpm run check:setup` — it checks the Node version, the ontology, and
  `.env.local` (including misspelled keys, which are otherwise ignored silently)
- Check `curl http://localhost:3003/health` — a degraded API lists exactly what
  failed, and the web UI shows the same list in a banner
- Check logs in the terminal where services are running
- Look for error messages in browser console (F12)
- Ensure ports 3003, 5173, 5174 are not used by other applications
