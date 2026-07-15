# Ontology GraphQL Language Server

`ontology-search-lsp` is a standalone stdio language server for full
`.graphql` and `.gql` documents written against an ontology-derived search
schema. It consumes the same `VocabularyResponse` contract as the integrated
web editor and provides the same GraphQL schema intelligence to any editor that
can launch an LSP process.

## Requirements

- Node.js 22 or newer
- Exactly one vocabulary source: an HTTP(S) `/vocabulary` response or a local
  JSON file with the same shape
- An LSP client that supports a stdio server process

Build and launch from this repository:

```sh
pnpm --filter @ontology-search/lsp-server build
node apps/lsp-server/dist/cli.js --stdio --vocabulary-file ./vocabulary.json
```

The packed package has no runtime dependency on this monorepo:

```sh
pnpm --filter @ontology-search/lsp-server pack --pack-destination /tmp
npm install --global /tmp/ontology-search-lsp-server-0.1.0.tgz
ontology-search-lsp --stdio --vocabulary-url http://localhost:3003/vocabulary
```

CLI source options override their environment equivalents:

```sh
ONTOLOGY_SEARCH_VOCABULARY_URL=http://localhost:3003/vocabulary \
  ontology-search-lsp --stdio

ONTOLOGY_SEARCH_VOCABULARY_FILE=/absolute/path/vocabulary.json \
  ontology-search-lsp --stdio
```

For an authenticated vocabulary endpoint, set `ONTOLOGY_SEARCH_API_KEY` in the
server process environment. The key is sent as an `Authorization: Bearer`
header, is never accepted as a command-line argument, and is not logged.

## Client Configuration

The portable client model is a command plus arguments and environment:

```json
{
  "command": "ontology-search-lsp",
  "args": ["--stdio", "--vocabulary-file", "/absolute/path/vocabulary.json"],
  "filetypes": ["graphql"]
}
```

Neovim 0.11 or newer can launch it directly:

```lua
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'graphql',
  callback = function()
    vim.lsp.start({
      name = 'ontology-graphql',
      cmd = {
        'ontology-search-lsp',
        '--stdio',
        '--vocabulary-url',
        'http://localhost:3003/vocabulary',
      },
      root_dir = vim.fs.root(0, { '.git' }) or vim.fn.getcwd(),
    })
  end,
})
```

VS Code does not provide a user setting for launching an arbitrary LSP server.
Use a generic LSP client extension and translate the portable command object
above into that extension's server configuration. No ontology-specific VS Code
extension is required by the server protocol.

## Capabilities

The initialize result advertises only implemented features:

| Feature                                                  | Support                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| initialize, shutdown, exit                               | Implemented                                                             |
| UTF-16 incremental text synchronization                  | Implemented                                                             |
| Completion                                               | Implemented for domains, fields, arguments, enum values, and references |
| Push diagnostics                                         | Implemented on open/change; cleared on close                            |
| Hover                                                    | Implemented for GraphQL signatures and ontology descriptions            |
| Document symbols                                         | Hierarchical when advertised by the client; otherwise a flat fallback   |
| Completion resolve, pull/workspace diagnostics           | Deferred, not advertised                                                |
| Definition, references, rename, formatting, code actions | Deferred, not advertised                                                |
| Semantic tokens, workspace discovery, embedded documents | Deferred, not advertised                                                |
| Query execution or editor commands                       | Not supported                                                           |

The server handles full GraphQL documents only. It does not extract embedded
GraphQL from JavaScript, TypeScript, notebooks, or templates.

## Schema Lifecycle

One vocabulary is loaded and validated during `initialize`, and one immutable
schema is retained for the process lifetime. Start a separate process for a
different ontology or after a vocabulary update. Schema hot reload and
multi-workspace discovery are intentionally not implemented.

URL responses are limited to 5 MiB and time out after 10 seconds. Authenticated
requests do not follow redirects. Local JSON and HTTP responses are strictly
validated, including generated GraphQL name collisions, before initialization
succeeds.

## Troubleshooting

- An initialization error means the source could not be read, did not match
  `VocabularyResponse`, or generated an ambiguous GraphQL schema. Run the same
  command with `--help` to verify its source arguments.
- Ordinary logs must never be written to stdout because stdout carries JSON-RPC
  frames. Pre-connection usage errors are written to stderr.
- Browser applications normally cannot launch a child-process stdio server. A
  browser LSP host needs a worker or WebSocket bridge; the integrated web editor
  therefore uses the shared schema in process instead.
- Definition/navigation is intentionally absent because the current vocabulary
  does not include stable ontology source locations.

## Standards and Upstream Implementations

- [Language Server Protocol 3.18](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/),
  including capability negotiation and UTF-16 position encoding
- [JSON-RPC 2.0](https://www.jsonrpc.org/specification), used by LSP framing and
  lifecycle messages
- [GraphQL Specification, September 2025](https://spec.graphql.org/September2025/),
  used for the executable query grammar, schema, and validation rules
- [Microsoft vscode-languageserver-node](https://github.com/microsoft/vscode-languageserver-node),
  the protocol implementation used for stdio and document synchronization
- [GraphQL language service](https://github.com/graphql/graphiql/tree/main/packages/graphql-language-service),
  the runtime-independent completion, diagnostic, hover, and outline engine

The project is licensed under Apache-2.0. The packed bundle includes
`THIRD_PARTY_NOTICES.txt` with the license metadata and complete license text
for every bundled third-party package.
