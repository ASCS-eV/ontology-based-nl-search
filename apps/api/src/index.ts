import { serve } from '@hono/node-server'

import { app } from './app.js'
import { warmup } from './warmup.js'

const port = parseInt(process.env['PORT'] ?? '3003', 10)

console.info(`Ontology Search API starting on port ${port}`)

await warmup()

serve({ fetch: app.fetch, port })

console.info(`Ontology Search API ready on http://localhost:${port}`)
