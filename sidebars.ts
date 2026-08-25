import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// The public knowledge base, in reading order. Manifesto and Whitepaper are the
// marquee reads; the "How it works" group is the reference for how the app runs.
const sidebars: SidebarsConfig = {
  knowledge: [
    'index',
    'what-is-ship',
    'manifesto',
    {
      type: 'category',
      label: 'How Main’s World works',
      collapsed: false,
      items: [
        'how-it-works/getting-started',
        'how-it-works/the-worlds',
        'how-it-works/moments',
        'how-it-works/vibes',
        'how-it-works/crews',
        'how-it-works/safety-alerts',
        'how-it-works/signing-in',
      ],
    },
    'the-economy',
    'your-main-on-chain',
    'country-availability',
    'roadmap',
    'connect-your-app',
    'whitepaper',
    {
      type: 'category',
      label: 'Reference',
      collapsed: false,
      items: ['glossary', 'faq'],
    },
    'contribute',
  ],
};

export default sidebars;
