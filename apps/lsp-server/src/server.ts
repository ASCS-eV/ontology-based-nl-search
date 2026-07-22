import { buildGraphQLSchema } from '@ontology-search/graphql-ir'
import type { GraphQLSchema } from 'graphql'
import {
  createConnection,
  ErrorCodes,
  type InitializeResult,
  MarkupKind,
  PositionEncodingKind,
  ProposedFeatures,
  ResponseError,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

import type { VocabularySource } from './config.js'
import {
  flattenGraphQLDocumentSymbols,
  getGraphQLCompletions,
  getGraphQLDiagnostics,
  getGraphQLDocumentSymbols,
  getGraphQLHover,
} from './graphql-features.js'
import { loadVocabulary } from './vocabulary-loader.js'

const GRAPHQL_LANGUAGE_IDS = new Set(['graphql'])

export interface ServerOptions {
  source: VocabularySource
}

/** Register handlers and listen on the official LSP stdio transport. */
export function startServer(options: ServerOptions): void {
  const connection = createConnection(ProposedFeatures.all)
  const documents = new TextDocuments(TextDocument)
  let schema: GraphQLSchema | null = null
  let shutdownReceived = false
  let markdownHover = false
  let hierarchicalDocumentSymbols = false

  connection.onInitialize(async (params): Promise<InitializeResult> => {
    markdownHover =
      params.capabilities.textDocument?.hover?.contentFormat?.includes(MarkupKind.Markdown) ?? false
    hierarchicalDocumentSymbols =
      params.capabilities.textDocument?.documentSymbol?.hierarchicalDocumentSymbolSupport ?? false

    try {
      schema = buildGraphQLSchema(await loadVocabulary(options.source))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vocabulary initialization failed.'
      throw new ResponseError(
        ErrorCodes.InternalError,
        `Vocabulary initialization failed: ${message}`
      )
    }

    return {
      capabilities: {
        positionEncoding: PositionEncodingKind.UTF16,
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          triggerCharacters: [' ', ':', '$', '(', '[', ',', '@', '{', '\n'],
        },
        hoverProvider: true,
        documentSymbolProvider: true,
      },
      serverInfo: { name: 'ontology-search-lsp' },
    }
  })

  connection.onCompletion(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri)
    if (!schema || !isGraphQLDocument(document)) return []
    return getGraphQLCompletions(schema, document.getText(), position)
  })

  connection.onHover(({ textDocument, position }) => {
    const document = documents.get(textDocument.uri)
    if (!schema || !isGraphQLDocument(document)) return null
    return getGraphQLHover(schema, document.getText(), position, markdownHover)
  })

  connection.onDocumentSymbol(({ textDocument }) => {
    const document = documents.get(textDocument.uri)
    if (!isGraphQLDocument(document)) return []
    const symbols = getGraphQLDocumentSymbols(document.getText())
    return hierarchicalDocumentSymbols
      ? symbols
      : flattenGraphQLDocumentSymbols(textDocument.uri, symbols)
  })

  documents.onDidOpen(({ document }) => publishDiagnostics(document))
  documents.onDidChangeContent(({ document }) => publishDiagnostics(document))
  documents.onDidClose(({ document }) => {
    if (GRAPHQL_LANGUAGE_IDS.has(document.languageId)) {
      void connection.sendDiagnostics({ uri: document.uri, diagnostics: [] })
    }
  })

  connection.onShutdown(() => {
    shutdownReceived = true
  })
  connection.onExit(() => process.exit(shutdownReceived ? 0 : 1))

  documents.listen(connection)
  connection.listen()

  function publishDiagnostics(document: TextDocument): void {
    if (!schema || !GRAPHQL_LANGUAGE_IDS.has(document.languageId)) return
    void connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: getGraphQLDiagnostics(schema, document.getText()),
    })
  }
}

function isGraphQLDocument(document: TextDocument | undefined): document is TextDocument {
  return document !== undefined && GRAPHQL_LANGUAGE_IDS.has(document.languageId)
}
