import { serve } from '@hono/node-server'
import { getConfig } from '@ontology-search/core/config'
import { createComponentLogger } from '@ontology-search/core/logging'

import { app } from './app.js'
import { warmup } from './warmup.js'

const log = createComponentLogger('api')
const port = getConfig().API_PORT

log.info('Ontology Search API starting', { port })

const warmupResult = await warmup()

serve({ fetch: app.fetch, port })

if (warmupResult.ready) {
  log.info('Ontology Search API ready', { url: `http://localhost:${port}` })
} else {
  log.warn('Ontology Search API started DEGRADED', {
    url: `http://localhost:${port}`,
    warmupErrorCount: warmupResult.errors.length,
  })
}
