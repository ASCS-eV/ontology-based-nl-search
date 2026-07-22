import { readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, sep } from 'node:path'

import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// mermaid (bundled into the docs client) transitively pulls in `langium`, whose internal
// modules deep-import `vscode-jsonrpc/lib/common/*`. vscode-jsonrpc@9 added an `exports`
// map that no longer exposes those subpaths, so the workspace's phantom-hoisted v9
// (introduced by the LSP server / graphql-language-service) makes Vite's bundler fail with
// `Missing "./lib/common/events.js" specifier in "vscode-jsonrpc" package`. Redirect the
// bare specifier to the co-installed v8.x copy (which has no `exports` restriction, and is
// the line langium actually depends on) so the deep subpaths resolve as plain file paths.
// Docs-scoped: does not affect the standalone LSP server, which runs on vscode-jsonrpc@9.
function resolveVscodeJsonrpc8Dir(): string | undefined {
  try {
    const nodeRequire = createRequire(import.meta.url)
    // `vitepress` is always resolvable from this config and lives inside the pnpm store,
    // giving us a stable anchor to the `.pnpm` virtual-store directory.
    const anchor = nodeRequire.resolve('vitepress/package.json')
    const marker = `${sep}.pnpm${sep}`
    const idx = anchor.indexOf(marker)
    if (idx === -1) return undefined
    const pnpmDir = anchor.slice(0, idx + marker.length - 1)
    const entry = readdirSync(pnpmDir)
      .filter((name) => /^vscode-jsonrpc@8\./.test(name))
      .sort()
      .pop()
    if (!entry) return undefined
    return join(pnpmDir, entry, 'node_modules', 'vscode-jsonrpc').replace(/\\/g, '/')
  } catch {
    return undefined
  }
}

const vscodeJsonrpcDir = resolveVscodeJsonrpc8Dir()

export default withMermaid(
  defineConfig({
    title: 'Ontology NL Search',
    description:
      'Natural language search over any OWL + SHACL ontology (demonstrated on ENVITED-X simulation assets)',
    base: process.env.VITEPRESS_BASE || '/docs/',
    appearance: false,
    // The docs app's own developer README (how to run/build the site) is not a
    // published docs page — exclude it so VitePress doesn't build it and flag its
    // repo-relative `../../README.md` link (which resolves outside the docs root)
    // as a dead link.
    srcExclude: ['README.md', '**/README.md'],
    ignoreDeadLinks: [
      // localhost links are valid in dev but don't exist at build time
      /^http:\/\/localhost/,
      // PORT_CONFIGURATION.md is at repo root, not under /docs/ base
      /^\/PORT_CONFIGURATION/,
    ],
    vite: {
      resolve: vscodeJsonrpcDir
        ? {
            alias: [
              { find: /^vscode-jsonrpc$/, replacement: vscodeJsonrpcDir },
              { find: /^vscode-jsonrpc\/(.*)$/, replacement: `${vscodeJsonrpcDir}/$1` },
            ],
          }
        : undefined,
      server: {
        port: parseInt(process.env.DOCS_PORT ?? '5173', 10),
        strictPort: true,
      },
    },
    themeConfig: {
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Slides', link: '/slides/' },
        {
          text: 'Docs',
          items: [
            { text: 'Architecture', link: '/architecture' },
            { text: 'Generic Design', link: '/generic-design' },
            { text: 'Query Flow', link: '/query-flow' },
            { text: 'Ontology Model', link: '/ontology' },
            { text: 'Agent Design', link: '/agent' },
            { text: 'Agent Tools', link: '/agent-tools' },
            { text: 'Data Model', link: '/data' },
            { text: 'SPARQL 1.1 Overview', link: '/sparql-reference/sparql-1.1-overview' },
            { text: 'FILTER Functions', link: '/sparql-reference/filter-functions' },
            { text: 'SPARQL Best Practices', link: '/sparql-reference/best-practices' },
            { text: 'IRIs vs Literals', link: '/sparql-reference/iri-vs-literals' },
            { text: 'RDF Schema (RDFS)', link: '/references/rdfs' },
            { text: 'SHACL', link: '/references/shacl' },
            { text: 'Standards Compliance', link: '/standards-audit' },
            { text: 'Roadmap', link: '/roadmap' },
          ],
        },
        { text: 'Search App', link: 'http://localhost:5174' },
      ],
      sidebar: [
        {
          text: 'Presentation',
          items: [{ text: 'Slide Deck', link: '/slides/' }],
        },
        {
          text: 'Architecture',
          items: [
            { text: 'System Architecture', link: '/architecture' },
            { text: 'Generic Design', link: '/generic-design' },
            { text: 'Query Flow', link: '/query-flow' },
          ],
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Ontology Model', link: '/ontology' },
            { text: 'Agent Design', link: '/agent' },
            { text: 'Agent Tools', link: '/agent-tools' },
            { text: 'Data Model', link: '/data' },
          ],
        },
        {
          text: 'SPARQL Reference',
          items: [
            { text: 'SPARQL 1.1 Overview', link: '/sparql-reference/sparql-1.1-overview' },
            { text: 'FILTER Functions', link: '/sparql-reference/filter-functions' },
            { text: 'SPARQL Best Practices', link: '/sparql-reference/best-practices' },
            { text: 'IRIs vs Literals', link: '/sparql-reference/iri-vs-literals' },
          ],
        },
        {
          text: 'RDF & SHACL Reference',
          items: [
            { text: 'RDF Schema (RDFS)', link: '/references/rdfs' },
            { text: 'SHACL', link: '/references/shacl' },
          ],
        },
        {
          text: 'Standards & Compliance',
          items: [{ text: 'Standards Compliance', link: '/standards-audit' }],
        },
        {
          text: 'Project',
          items: [{ text: 'Roadmap', link: '/roadmap' }],
        },
      ],
      socialLinks: [],
      outline: { level: [2, 3] },
    },
    mermaid: {
      theme: 'base',
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: 16,
      securityLevel: 'loose',
      themeVariables: {
        primaryColor: '#dbeafe',
        primaryTextColor: '#0f172a',
        primaryBorderColor: '#2563eb',
        secondaryColor: '#ccfbf1',
        secondaryTextColor: '#0f172a',
        secondaryBorderColor: '#0d9488',
        tertiaryColor: '#f8fafc',
        tertiaryTextColor: '#0f172a',
        tertiaryBorderColor: '#cbd5e1',
        mainBkg: '#ffffff',
        nodeBorder: '#2563eb',
        lineColor: '#475569',
        clusterBkg: '#f8fafc',
        clusterBorder: '#cbd5e1',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '16px',
      },
      flowchart: {
        padding: 28,
        nodeSpacing: 72,
        rankSpacing: 88,
        htmlLabels: true,
        useMaxWidth: true,
        curve: 'basis',
      },
      sequence: {
        useMaxWidth: true,
        actorMargin: 72,
        boxMargin: 16,
        boxTextMargin: 10,
        messageMargin: 42,
        noteMargin: 14,
      },
      themeCSS: `
        .label foreignObject div,
        .nodeLabel p {
          padding: 0.35rem 0.75rem;
          line-height: 1.35;
        }

        .node rect,
        .node polygon,
        .node circle,
        .node ellipse,
        .node path {
          stroke-width: 1.6px;
        }
      `,
    },
  })
)
