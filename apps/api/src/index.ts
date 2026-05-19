import { serve } from '@hono/node-server'
import { getConfig } from '@ontology-search/core/config'

import { app } from './app.js'
import { warmup } from './warmup.js'

const port = getConfig().API_PORT

console.info(`Ontology Search API starting on port ${port}`)

const warmupResult = await warmup()

serve({ fetch: app.fetch, port })

if (warmupResult.ready) {
  console.info(`Ontology Search API ready on http://localhost:${port}`)
} else {
  console.warn(
    `Ontology Search API started DEGRADED on http://localhost:${port} — ${warmupResult.errors.length} warmup error(s)`
  )
}
