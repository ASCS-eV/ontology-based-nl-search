import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { errorHandler } from './middleware/error-handler.js'
import { requestId } from './middleware/request-id.js'
import { searchRoutes } from './routes/search.js'
import { statsRoutes } from './routes/stats.js'
import type { AppEnv } from './types.js'

const app = new Hono<AppEnv>()

app.use('*', logger())
app.use('*', cors())
app.use('*', requestId())
app.onError(errorHandler)

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/search', searchRoutes)
app.route('/stats', statsRoutes)

export { app }
