import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'Ontology NL Search',
    description: 'Natural language search for ENVITED-X simulation assets',
    base: '/docs/',
    themeConfig: {
      nav: [
        { text: 'Home', link: '/' },
        { text: 'Slides', link: '/slides/' },
        {
          text: 'Docs',
          items: [
            { text: 'Architecture', link: '/architecture' },
            { text: 'Query Flow', link: '/query-flow' },
            { text: 'Ontology Model', link: '/ontology' },
            { text: 'Agent Design', link: '/agent' },
            { text: 'Data Model', link: '/data' },
            { text: 'Roadmap', link: '/roadmap' },
          ],
        },
        { text: 'Search App ↗', link: 'http://localhost:5174' },
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
          text: 'Project',
          items: [{ text: 'Roadmap', link: '/roadmap' }],
        },
      ],
      socialLinks: [
        { icon: 'github', link: 'https://github.com/ASCS-eV/ontology-based-nl-search' },
      ],
      outline: { level: [2, 3] },
    },
    mermaid: {
      theme: 'neutral',
      flowchart: {
        padding: 20,
        nodeSpacing: 50,
        rankSpacing: 60,
        useMaxWidth: false,
      },
    },
  })
)
