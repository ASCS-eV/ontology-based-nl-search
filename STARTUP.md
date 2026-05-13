# Startup Guide

## Prerequisites

- Node.js 22+
- pnpm 10.33.3+
- Git

## Initial Setup (First Time Only)

```bash
# 1. Install dependencies
pnpm install

# 2. Create environment file
cp .env.example .env.local

# 3. Edit .env.local if needed (defaults work for development)
```

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

**Cause**: Previous dev server wasn't shut down properly.

**Solution**:

```bash
# Clean all development ports
pnpm run clean:ports

# Or clean specific ports
node scripts/clean-ports.mjs 3003 5174 5173

# Then restart services
pnpm dev
```

### Issue: "API not responding"

**Cause**: API server crashed or didn't finish warming up.

**Solution**:

```bash
# Check API health
curl http://localhost:3003/health

# Should return: {"status":"ok"}

# Check API stats (also tests database connection)
curl http://localhost:3003/stats

# Should return JSON with asset counts
```

**Wait time**: API warmup takes ~8-12 seconds (loading ontologies + creating LLM session)

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

- Check logs in the terminal where services are running
- Look for error messages in browser console (F12)
- Verify `.env.local` has correct settings
- Ensure ports 3003, 5173, 5174 are not used by other applications
