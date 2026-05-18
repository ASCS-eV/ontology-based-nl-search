import { serve } from '@hono/node-server'
import { getConfig } from '@ontology-search/core/config'

import { app } from './app.js'
import { warmup } from './warmup.js'

const port = getConfig().API_PORT

console.info(`Ontology Search API starting on port ${port}`)

await warmup()

serve({ fetch: app.fetch, port })

console.info(`Ontology Search API ready on http://localhost:${port}`)
