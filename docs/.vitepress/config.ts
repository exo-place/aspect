import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Aspect',
  description: 'Card-based identity exploration sandbox',
  base: '/aspect/',

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/' },
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
        text: 'Reference',
        items: [
          { text: 'Concepts', link: '/reference/' },
        ]
      },
      {
        text: 'Design',
        items: [
          { text: 'Philosophy', link: '/philosophy' },
        ]
      }
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
