import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'

import Slide from './components/Slide.vue'
import SlideControls from './components/SlideControls.vue'
import SlideDeck from './components/SlideDeck.vue'
import SlideProvider from './components/SlideProvider.vue'
import { installMermaidFit } from './mermaid-fit'
import { installMermaidZoom } from './mermaid-zoom'

import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('SlideProvider', SlideProvider)
    app.component('SlideDeck', SlideDeck)
    app.component('Slide', Slide)
    app.component('SlideControls', SlideControls)
    installMermaidFit() // column-fit for docs-page diagrams
    installMermaidZoom() // pan/zoom canvas for slide diagrams
  },
} satisfies Theme
