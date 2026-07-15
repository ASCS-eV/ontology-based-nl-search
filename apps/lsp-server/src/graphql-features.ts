import type { GraphQLSchema } from 'graphql'
import {
  getAutocompleteSuggestions,
  getDiagnostics,
  getHoverInformation,
  getOutline,
  type OutlineTree,
} from 'graphql-language-service'
import {
  type CompletionItem,
  CompletionItemTag,
  type Diagnostic,
  type DocumentSymbol,
  type Hover,
  MarkupKind,
  type Position,
  type SymbolInformation,
  SymbolKind,
} from 'vscode-languageserver/node'

/** Return protocol-only completion data, dropping GraphQL runtime objects. */
export function getGraphQLCompletions(
  schema: GraphQLSchema,
  text: string,
  position: Position
): CompletionItem[] {
  return getAutocompleteSuggestions(schema, text, position as never).map((item) => ({
    label: item.label,
    ...(item.kind === undefined ? {} : { kind: item.kind }),
    ...(item.detail === undefined ? {} : { detail: item.detail }),
    ...(item.documentation === undefined || item.documentation === null
      ? {}
      : { documentation: item.documentation }),
    ...(item.sortText === undefined ? {} : { sortText: item.sortText }),
    ...(item.filterText === undefined ? {} : { filterText: item.filterText }),
    ...(item.insertText === undefined ? {} : { insertText: item.insertText }),
    ...(item.textEdit === undefined ? {} : { textEdit: item.textEdit }),
    ...(item.additionalTextEdits === undefined
      ? {}
      : { additionalTextEdits: item.additionalTextEdits }),
    ...(item.commitCharacters === undefined ? {} : { commitCharacters: item.commitCharacters }),
    ...(item.command === undefined ? {} : { command: item.command }),
    ...(item.insertTextFormat === undefined ? {} : { insertTextFormat: item.insertTextFormat }),
    ...(item.insertTextMode === undefined ? {} : { insertTextMode: item.insertTextMode }),
    ...(item.preselect === undefined ? {} : { preselect: item.preselect }),
    ...(item.isDeprecated || item.deprecated
      ? { deprecated: true, tags: [CompletionItemTag.Deprecated] }
      : {}),
  }))
}

export function getGraphQLDiagnostics(schema: GraphQLSchema, text: string): Diagnostic[] {
  return getDiagnostics(text, schema).map((diagnostic) => ({
    range: diagnostic.range,
    message: diagnostic.message,
    source: 'ontology-graphql',
    ...(diagnostic.severity === undefined ? {} : { severity: diagnostic.severity }),
    ...(diagnostic.code === undefined ? {} : { code: diagnostic.code }),
    ...(diagnostic.tags === undefined ? {} : { tags: diagnostic.tags }),
    ...(diagnostic.relatedInformation === undefined
      ? {}
      : { relatedInformation: diagnostic.relatedInformation }),
  }))
}

export function getGraphQLHover(
  schema: GraphQLSchema,
  text: string,
  position: Position,
  useMarkdown = true
): Hover | null {
  const contents = getHoverInformation(schema, text, position as never, undefined, {
    useMarkdown,
  })
  const value = hoverText(contents)
  if (!value) return null
  return useMarkdown ? { contents: { kind: MarkupKind.Markdown, value } } : { contents: value }
}

export function getGraphQLDocumentSymbols(text: string): DocumentSymbol[] {
  const outline = getOutline(text)
  if (!outline) return []
  return outline.outlineTrees.map(toDocumentSymbol)
}

/** Flatten hierarchical symbols for clients that did not advertise hierarchy support. */
export function flattenGraphQLDocumentSymbols(
  uri: string,
  symbols: readonly DocumentSymbol[]
): SymbolInformation[] {
  const flattened: SymbolInformation[] = []
  for (const symbol of symbols) appendFlatSymbol(uri, symbol, undefined, flattened)
  return flattened
}

function appendFlatSymbol(
  uri: string,
  symbol: DocumentSymbol,
  containerName: string | undefined,
  target: SymbolInformation[]
): void {
  target.push({
    name: symbol.name,
    kind: symbol.kind,
    location: { uri, range: symbol.range },
    ...(containerName ? { containerName } : {}),
  })
  for (const child of symbol.children ?? []) {
    appendFlatSymbol(uri, child, symbol.name, target)
  }
}

function toDocumentSymbol(tree: OutlineTree): DocumentSymbol {
  const start = toPosition(tree.startPosition)
  const end = toPosition(tree.endPosition ?? tree.startPosition)
  return {
    name: outlineName(tree),
    kind: outlineKind(tree.kind),
    range: { start, end },
    selectionRange: { start, end },
    ...(tree.children.length === 0 ? {} : { children: tree.children.map(toDocumentSymbol) }),
  }
}

function outlineName(tree: OutlineTree): string {
  if (tree.representativeName) return String(tree.representativeName)
  if (tree.plainText) return tree.plainText
  const tokenized = tree.tokenizedText
    ?.map((token) =>
      typeof token.value === 'string'
        ? token.value
        : 'value' in token.value
          ? token.value.value
          : String(token.value)
    )
    .join('')
    .trim()
  return tokenized || tree.kind
}

function outlineKind(kind: string): SymbolKind {
  switch (kind) {
    case 'OperationDefinition':
      return SymbolKind.Function
    case 'FragmentDefinition':
      return SymbolKind.Function
    case 'FragmentSpread':
      return SymbolKind.Variable
    case 'Field':
      return SymbolKind.Field
    default:
      return SymbolKind.Object
  }
}

function toPosition(position: { line: number; character: number }): Position {
  return { line: position.line, character: position.character }
}

function hoverText(contents: ReturnType<typeof getHoverInformation>): string {
  if (typeof contents === 'string') return contents.trim()
  if (Array.isArray(contents)) {
    return contents
      .map((entry) =>
        typeof entry === 'string' ? entry : `\`\`\`${entry.language}\n${entry.value}\n\`\`\``
      )
      .join('\n\n')
      .trim()
  }
  if (contents && 'value' in contents) return contents.value.trim()
  return ''
}
