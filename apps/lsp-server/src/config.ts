export const PACKAGE_VERSION = '0.1.0'

export const USAGE = `Usage: ontology-search-lsp --stdio (--vocabulary-url <url> | --vocabulary-file <path>)

Options:
  --stdio                    Use the standard LSP stdio transport
  --vocabulary-url <url>     Load VocabularyResponse JSON over HTTP(S)
  --vocabulary-file <path>   Load VocabularyResponse JSON from a local file
  --help                     Show this help
  --version                  Show the package version

Environment:
  ONTOLOGY_SEARCH_VOCABULARY_URL
  ONTOLOGY_SEARCH_VOCABULARY_FILE
  ONTOLOGY_SEARCH_API_KEY`

export class UsageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UsageError'
  }
}

export type VocabularySource = { type: 'url'; value: string } | { type: 'file'; value: string }

export type CliConfig =
  | { action: 'help' }
  | { action: 'version' }
  | { action: 'serve'; stdio: true; source: VocabularySource }

/** Parse the transport and single vocabulary source without exposing credentials. */
export function parseCliConfig(
  args: readonly string[],
  // The publishable server cannot depend on the monorepo-only core config package.
  // eslint-disable-next-line no-restricted-syntax
  env: NodeJS.ProcessEnv = process.env
): CliConfig {
  let stdio = false
  let help = false
  let version = false
  let cliUrl: string | undefined
  let cliFile: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    switch (argument) {
      case '--stdio':
        stdio = true
        break
      case '--help':
      case '-h':
        help = true
        break
      case '--version':
      case '-v':
        version = true
        break
      case '--vocabulary-url':
        cliUrl = readValue(args, ++index, argument)
        break
      case '--vocabulary-file':
        cliFile = readValue(args, ++index, argument)
        break
      default:
        throw new UsageError(`Unknown argument: ${argument}`)
    }
  }

  if (help) return { action: 'help' }
  if (version) return { action: 'version' }
  if (!stdio) throw new UsageError('The LSP server requires --stdio.')
  if (cliUrl && cliFile) throw new UsageError('Choose exactly one vocabulary source.')

  const envUrl = nonEmpty(env.ONTOLOGY_SEARCH_VOCABULARY_URL)
  const envFile = nonEmpty(env.ONTOLOGY_SEARCH_VOCABULARY_FILE)
  const source = cliUrl
    ? { type: 'url' as const, value: cliUrl }
    : cliFile
      ? { type: 'file' as const, value: cliFile }
      : envUrl && !envFile
        ? { type: 'url' as const, value: envUrl }
        : envFile && !envUrl
          ? { type: 'file' as const, value: envFile }
          : null

  if (!source) {
    if (envUrl && envFile) throw new UsageError('Choose exactly one vocabulary source.')
    throw new UsageError('A vocabulary URL or file is required.')
  }
  return { action: 'serve', stdio: true, source }
}

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index]
  if (!value || value.startsWith('--')) throw new UsageError(`${option} requires a value.`)
  return value
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
