import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

import { activeDesignSystemPlugin } from './vite-plugins/active-design-system'

// The shared .env.local lives at the repo root (same file the API reads), so
// design-system selection (VITE_DESIGN_SYSTEM / DESIGN_SYSTEM_MODULE) is set
// there too.
const envDir = fileURLToPath(new URL('../..', import.meta.url))
// Parent of the repo root — holds sibling checkouts (e.g. an external design
// system pointed at by a path), which dev must be allowed to serve.
const siblingRoot = fileURLToPath(new URL('../../..', import.meta.url))

/** A port from the environment, falling back to this app's documented default. */
function port(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export default defineConfig(({ mode }) => {
  // `loadEnv` merges `.env.local` with the shell environment (shell wins), so
  // ports and the API target honour both. Reading them from `process.env`
  // instead — as this config used to — ignored `.env.local` entirely, even
  // though `.env.example` documents WEB_PORT there.
  const env = loadEnv(mode, envDir, '')
  const externalIsPath = !!env.DESIGN_SYSTEM_MODULE && /^[./]/.test(env.DESIGN_SYSTEM_MODULE)

  return {
    envDir,
    // The external design system may live outside node_modules (a sibling
    // checkout) and carry no React of its own — dedupe so its JSX resolves to
    // the app's single React copy. graphql is deduped too: cm6-graphql's
    // language service does instanceof checks against the GraphQLSchema the
    // editor builds, which fail if graphql resolves to two instances (its CJS
    // and ESM builds) — "Cannot use GraphQLObjectType from another realm".
    resolve: { dedupe: ['react', 'react-dom', 'graphql'] },
    plugins: [
      activeDesignSystemPlugin(env.DESIGN_SYSTEM_MODULE, envDir),
      TanStackRouterVite({ routesDirectory: './src/routes' }),
      react(),
      tailwindcss(),
    ],
    server: {
      port: port(env.WEB_PORT, 5174),
      // Only widen file-serving when a path-based external design system is set.
      ...(externalIsPath ? { fs: { allow: [siblingRoot] } } : {}),
      proxy: {
        '/api': {
          // Derived from API_PORT: a hard-coded target sent every request to
          // the old port the moment someone moved the API, and the browser
          // reported only a failed fetch.
          target: `http://localhost:${port(env.API_PORT, 3003)}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
