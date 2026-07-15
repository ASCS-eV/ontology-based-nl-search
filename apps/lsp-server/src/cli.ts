import { PACKAGE_VERSION, parseCliConfig, USAGE, UsageError } from './config.js'
import { startServer } from './server.js'

try {
  const config = parseCliConfig(process.argv.slice(2))
  if (config.action === 'help') {
    process.stdout.write(`${USAGE}\n`)
  } else if (config.action === 'version') {
    process.stdout.write(`${PACKAGE_VERSION}\n`)
  } else {
    startServer({ source: config.source })
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`${message}\n`)
  if (error instanceof UsageError) process.stderr.write(`\n${USAGE}\n`)
  process.exitCode = 2
}
