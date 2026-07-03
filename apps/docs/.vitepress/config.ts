import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

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
