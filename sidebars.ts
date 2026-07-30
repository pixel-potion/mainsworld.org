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
        'how-it-works/the-worlds',
        'how-it-works/tapes',
        'how-it-works/vibes',
        'how-it-works/crews',
        'how-it-works/signing-in',
      ],
    },
    'the-economy',
    'roadmap',
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
