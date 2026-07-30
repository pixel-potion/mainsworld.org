import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

// The public knowledge base for Main's World — the trusted, community-editable
// source of truth for the app and for SHIP (a Secure Human Interaction Protocol).
// This site is a CURATED PUBLIC SUBSET of the internal docs; nothing here exposes
// secrets, app IDs, security internals, or unshipped economics stated as fact.

const config: Config = {
  title: "Main's World",
  tagline:
    'The first place online where everyone is a verified human — a SHIP, a Secure Human Interaction Protocol.',
  favicon: 'img/favicon.svg',

  // Brand assets are the real ones from the app (public/ in the MW repo), so
  // the knowledge base and mains.world stay visually the same product.
  headTags: [
    {
      tagName: 'link',
      attributes: {rel: 'apple-touch-icon', sizes: '180x180', href: '/img/apple-touch-icon.png'},
    },
    {
      tagName: 'link',
      attributes: {rel: 'icon', type: 'image/png', sizes: '32x32', href: '/img/favicon-32.png'},
    },
    {
      tagName: 'meta',
      attributes: {name: 'theme-color', content: '#0d0221'},
    },
  ],

  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url: 'https://mainsworld.org',
  baseUrl: '/',

  // The public docs repo (separate from the private app repo). Update the org
  // if the repo lands somewhere else.
  organizationName: 'pixel-potion',
  projectName: 'mainsworld.org',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/', // docs are the site — no /docs/ prefix
          sidebarPath: './sidebars.ts',
          // "Edit this page" sends contributors straight to the GitHub editor.
          editUrl: 'https://github.com/pixel-potion/mainsworld.org/edit/main/',
        },
        blog: false, // knowledge base first; a dispatch/blog can come later
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/og.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "Main's World",
      logo: {
        alt: "Main's World",
        src: 'img/favicon.svg',
      },
      items: [
        {type: 'docSidebar', sidebarId: 'knowledge', position: 'left', label: 'Learn'},
        {to: '/manifesto', label: 'Manifesto', position: 'left'},
        {to: '/what-is-ship', label: 'What is SHIP', position: 'left'},
        {to: '/contribute', label: 'Contribute', position: 'right'},
        {
          href: 'https://mains.world',
          label: 'Open the app',
          position: 'right',
        },
        {
          href: 'https://github.com/pixel-potion/mainsworld.org',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {label: 'What is SHIP', to: '/what-is-ship'},
            {label: 'How Main’s World works', to: '/how-it-works/the-worlds'},
            {label: 'The economy', to: '/the-economy'},
            {label: 'Glossary', to: '/glossary'},
          ],
        },
        {
          title: 'Read',
          items: [
            {label: 'Manifesto', to: '/manifesto'},
            {label: 'Whitepaper', to: '/whitepaper'},
            {label: 'Roadmap', to: '/roadmap'},
            {label: 'FAQ', to: '/faq'},
          ],
        },
        {
          title: 'Take part',
          items: [
            {label: 'Open the app', href: 'https://mains.world'},
            {label: 'Request a feature or report a bug', href: 'https://mainsworld.featurebase.app/'},
            {label: '@itsamainsworld on X', href: 'https://x.com/itsamainsworld'},
            {label: 'Contribute', to: '/contribute'},
            {label: 'GitHub', href: 'https://github.com/pixel-potion/mainsworld.org'},
          ],
        },
      ],
      copyright: `Main's World — a knowledge base by Mains, for Mains. Openly licensed. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
