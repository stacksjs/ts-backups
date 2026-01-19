import type { BunPressOptions } from 'bunpress'

const config: BunPressOptions = {
  name: 'backupx',
  description: 'Database backups made simple',
  url: 'https://backupx.stacksjs.org',
  theme: {
    primaryColor: '#0A0ABC',
  },
  nav: [
    { text: 'Guide', link: '/intro' },
    { text: 'Features', link: '/features/database-backups' },
    { text: 'Advanced', link: '/advanced/configuration' },
    {
      text: 'Changelog',
      link: 'https://github.com/stacksjs/backupx/blob/main/CHANGELOG.md',
    },
  ],
  sidebar: [
    {
      text: 'Introduction',
      items: [
        { text: 'What is Backupx?', link: '/intro' },
        { text: 'Installation', link: '/install' },
        { text: 'Usage', link: '/usage' },
        { text: 'Configuration', link: '/config' },
      ],
    },
    {
      text: 'Guide',
      items: [
        { text: 'Getting Started', link: '/usage' },
        { text: 'CLI Commands', link: '/usage#cli-usage' },
        { text: 'Programmatic API', link: '/usage#programmatic-usage' },
      ],
    },
    {
      text: 'Features',
      items: [
        { text: 'Database Backups', link: '/features/database-backups' },
        { text: 'Scheduled Backups', link: '/features/scheduled-backups' },
        { text: 'Cloud Storage', link: '/features/cloud-storage' },
        { text: 'Encryption', link: '/features/encryption' },
      ],
    },
    {
      text: 'Advanced',
      items: [
        { text: 'Configuration', link: '/advanced/configuration' },
        { text: 'Custom Adapters', link: '/advanced/custom-adapters' },
        { text: 'Performance', link: '/advanced/performance' },
        { text: 'CI/CD Integration', link: '/advanced/ci-cd-integration' },
      ],
    },
  ],
  sitemap: {
    enabled: true,
    baseUrl: 'https://backupx.stacksjs.org',
  },
  robots: {
    enabled: true,
  },
}

export default config
