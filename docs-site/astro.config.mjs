import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://vetro.hifzio.com',
  base: '/',
  integrations: [
    starlight({
      title: 'VetroLog',
      description: 'Zero-config desktop database inspector for mobile developers (Flutter, Android, React Native).',
      logo: {
        src: './src/assets/logo.png',
      },
      social: {
        github: 'https://github.com/Tanvirul-swe/vetrolog',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          autogenerate: { directory: 'getting-started' },
        },
        {
          label: 'Core Inspection Engine',
          autogenerate: { directory: 'core-features' },
        },
        {
          label: 'Intelligent SQL Playground',
          autogenerate: { directory: 'sql-playground' },
        },
        {
          label: 'Framework Guides',
          autogenerate: { directory: 'framework-guides' },
        },
        {
          label: 'Deployment & Operations',
          autogenerate: { directory: 'deployment-and-modes' },
        },
        {
          label: 'Troubleshooting & Support',
          autogenerate: { directory: 'troubleshooting' },
        },
      ],
    }),
  ],
});
