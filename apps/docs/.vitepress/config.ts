import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Ontology NL Search',
  description: 'Natural language search for ENVITED-X simulation assets',
  base: '/docs/',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Slides', link: '/slides/' },
      { text: 'Architecture', link: '/architecture' },
      { text: 'Search App', link: 'http://localhost:3000' },
    ],
    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Query Flow', link: '/query-flow' },
        ],
      },
      {
        text: 'Presentation',
        items: [{ text: 'Slide Deck', link: '/slides/' }],
      },
      {
        text: 'Technical',
        items: [
          { text: 'Ontology Model', link: '/ontology' },
          { text: 'Agent Design', link: '/agent' },
          { text: 'Data Model', link: '/data' },
          { text: 'Roadmap', link: '/roadmap' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/ASCS-eV/ontology-based-nl-search' }],
  },
})
