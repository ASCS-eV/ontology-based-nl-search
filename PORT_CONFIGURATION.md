# Port Configuration Guide

This guide explains how to configure service ports for the ontology-based NL search application.

## Overview

The application consists of three main services, each with a configurable port:

| Service | Default Port | Environment Variable | Purpose |
|---------|------|------------------------|---------|
| **API** | 3003 | `API_PORT` | Backend SPARQL query service |
| **Web UI** | 5174 | `WEB_PORT` | Frontend React application |
| **Docs** | 5173 | `DOCS_PORT` | VitePress documentation site |

## Default Configuration

By default, services run on these ports:
- API: http://localhost:3003
- Web: http://localhost:5174
- Docs: http://localhost:5173

If these ports are available, you don't need to change anything—just run `pnpm dev`.

## Changing Ports

### Option 1: Edit `.env.local` (Recommended)

The easiest way to change ports is to edit the `.env.local` file in the repository root:

```bash
# Open .env.local and uncomment/modify these lines:
API_PORT=3003
WEB_PORT=5174
DOCS_PORT=5173
```

Then restart your dev server:
```bash
pnpm dev
```

### Option 2: Export Environment Variables

You can set environment variables directly in your terminal:

**On Linux/Mac:**
```bash
export API_PORT=4000
export WEB_PORT=8080
export DOCS_PORT=8081
pnpm dev
```

**On Windows (PowerShell):**
```powershell
$env:API_PORT = "4000"
$env:WEB_PORT = "8080"
$env:DOCS_PORT = "8081"
pnpm dev
```

**On Windows (Command Prompt):**
```cmd
set API_PORT=4000
set WEB_PORT=8080
set DOCS_PORT=8081
pnpm dev
```

### Option 3: Inline with pnpm

```bash
API_PORT=4000 WEB_PORT=8080 DOCS_PORT=8081 pnpm dev
```

## Common Scenarios

### Hyper-V Port Conflicts

Hyper-V reserves certain port ranges on Windows, which can block your dev servers. Common blocked ranges:
- `49152–65535` (Hyper-V reserved range)

**Solution:** Use ports outside the reserved range:

```bash
# .env.local
API_PORT=3003
WEB_PORT=5174
DOCS_PORT=5173
```

These ports are outside Hyper-V's reserved range and should work fine.

### Running Multiple Instances

If you need to run multiple instances of the application (e.g., for different branches), configure different ports:

**Instance 1 (.env.local):**
```bash
API_PORT=3003
WEB_PORT=5174
DOCS_PORT=5173
```

**Instance 2 (environment variables):**
```bash
API_PORT=4000 WEB_PORT=8080 DOCS_PORT=8081 pnpm dev
```

### Using Non-Standard Ports

Example: Running API on 8000, Web on 3000, Docs on 3001:

```bash
# .env.local
API_PORT=8000
WEB_PORT=3000
DOCS_PORT=3001
```

Then restart:
```bash
pnpm dev
```

**Note:** Update any hardcoded references if you change the API proxy target. The web UI proxies `/api` calls to `http://localhost:{API_PORT}`, but if you have hardcoded API URLs elsewhere, update them too.

## Port Configuration Details

### API Port (API_PORT)

- **Default:** 3003
- **Type:** Integer
- **Configuration:** 
  - Via `.env.local`: `API_PORT=3003`
  - Backend server (`apps/api/src/index.ts`) reads this at startup
- **Usage:** All backend queries, health checks, stats

### Web Port (WEB_PORT)

- **Default:** 5174
- **Type:** Integer
- **Configuration:** 
  - Via `.env.local`: `WEB_PORT=5174`
  - Vite config (`apps/web/vite.config.ts`) reads this at dev startup
- **Usage:** Frontend React application
- **Note:** The API proxy target inside the web UI still points to localhost:3003 by default. If you change `API_PORT`, the web UI will automatically proxy to the new port.

### Docs Port (DOCS_PORT)

- **Default:** 5173
- **Type:** Integer
- **Configuration:** 
  - Via `.env.local`: `DOCS_PORT=5173`
  - VitePress config (`apps/docs/.vitepress/config.ts`) reads this at dev startup
- **Usage:** Documentation site

## Verifying Ports Are Correct

After changing ports, verify all services are running:

```bash
# Check which ports are listening
# On Windows:
netstat -an | findstr "LISTENING"

# On Linux/Mac:
netstat -an | grep LISTEN
# or
lsof -i -P -n | grep LISTEN
```

Or test the services directly:

```bash
# Test API
curl http://localhost:3003/health
curl http://localhost:3003/stats

# Test Web (should return HTML)
curl http://localhost:5174

# Test Docs (should return HTML)
curl http://localhost:5173/docs/
```

## Cleaning Up Zombie Processes

If a port is still in use after you've stopped the dev server, you can force-clean it:

```bash
# Clean all default ports
pnpm run clean:ports

# Clean specific ports
node scripts/clean-ports.mjs 3003 5174 5173
```

This will kill any processes holding those ports.

## Port Configuration in CI/CD

For continuous integration or production deployments, set environment variables before starting the application:

```bash
# Docker
ENV API_PORT=3003 WEB_PORT=5174 DOCS_PORT=5173

# Kubernetes
env:
  - name: API_PORT
    value: "3003"
  - name: WEB_PORT
    value: "5174"
  - name: DOCS_PORT
    value: "5173"

# GitHub Actions
env:
  API_PORT: 3003
  WEB_PORT: 5174
  DOCS_PORT: 5173
```

## Troubleshooting

### "Address already in use" error

**Problem:** One of the services can't bind to its configured port because another process is using it.

**Solutions:**

1. **Check what's using the port:**
   ```bash
   # Windows
   netstat -ano | findstr :5174
   
   # Linux/Mac
   lsof -i :5174
   ```

2. **Change the port in `.env.local`:**
   ```bash
   WEB_PORT=5175
   ```

3. **Kill the process using the port:**
   ```bash
   # Windows PowerShell (replace PID)
   Get-Process | Where-Object {$_.Id -eq 1234} | Stop-Process -Force
   
   # Linux/Mac
   kill -9 1234
   ```

4. **Use the cleanup script:**
   ```bash
   pnpm run clean:ports
   ```

### Port conflicts with Hyper-V

**Problem:** Hyper-V reserves ports in the range 49152–65535, preventing your dev servers from binding.

**Solutions:**

1. **Use ports outside the reserved range** (recommended):
   ```bash
   # .env.local — these ports are safe
   API_PORT=3003
   WEB_PORT=5174
   DOCS_PORT=5173
   ```

2. **Disable Hyper-V** (if you're not using it):
   - Open "Turn Windows features on or off"
   - Uncheck "Hyper-V"
   - Restart Windows

3. **Use WSL 2 backend for Docker** instead of Hyper-V (requires Windows 11 Pro+):
   - Docker Desktop → Settings → General → "Use the WSL 2 based engine"

### Services still not responding after port change

**Debugging steps:**

1. Check `.env.local` is saved:
   ```bash
   cat .env.local | grep PORT
   ```

2. Verify no old processes are using the old ports:
   ```bash
   pnpm run clean:ports
   ```

3. Rebuild and restart:
   ```bash
   pnpm run build
   pnpm dev
   ```

4. Check service logs for errors:
   - API: Look for "Ontology Search API ready" with the new port
   - Web: Look for "VITE" startup message with the new port
   - Docs: Look for "VitePress dev server" message with the new port

## See Also

- [STARTUP.md](./STARTUP.md) — Full startup guide
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development workflow
- `.env.example` — All available environment variables
