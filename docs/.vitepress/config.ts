import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Aspect',
  description: 'Card-based identity exploration sandbox',
  base: '/aspect/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
      { text: 'Design', link: '/design/architecture' },
      { text: 'Reference', link: '/reference/' },
      { text: 'exo', link: 'https://exo-place.github.io/' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/' },
        ]
      },
      {
        text: 'Design',
        items: [
          { text: 'Philosophy', link: '/philosophy' },
          { text: 'Architecture', link: '/design/architecture' },
          { text: 'Projection', link: '/design/projection' },
          { text: 'Affordances', link: '/design/affordances' },
          { text: 'World Packs', link: '/design/world-packs' },
          { text: 'Roadmap', link: '/design/roadmap' },
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Concepts', link: '/reference/' },
        ]
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/exo-place/aspect' }
    ],

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/exo-place/aspect/edit/master/docs/:path',
      text: 'Edit this page on GitHub'
    },

    footer: {
      message: 'Released under the MIT License.',
    }
  }
})
