import type { HeadConfig } from 'vitepress'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { withPwa } from '@vite-pwa/vitepress'
import { defineConfig } from 'vitepress'

import viteConfig from './vite.config'

// https://vitepress.dev/reference/site-config

const analyticsHead: HeadConfig[] = [
  [
    'script',
    {
      'src': 'https://cdn.usefathom.com/script.js',
      'data-site': 'DCOEHMGA',
      'defer': '',
    },
  ],
]

const nav = [
  { text: 'Guide', link: '/intro' },
  { text: 'API', link: '/api/overview' },
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/ts-backups/blob/main/CHANGELOG.md',
  },
  {
    text: 'Resources',
    items: [
      { text: 'Examples', link: '/examples' },
      { text: 'CLI Reference', link: '/cli' },
      { text: 'Configuration', link: '/config' },
      {
        items: [
          {
            text: 'Contributing',
            link: 'https://github.com/stacksjs/ts-backups/blob/main/.github/CONTRIBUTING.md',
          },
          {
            text: 'Issues',
            link: 'https://github.com/stacksjs/ts-backups/issues',
          },
        ],
      },
    ],
  },
]

const sidebar = [
  {
    text: 'Get Started',
    items: [
      { text: 'Introduction', link: '/intro' },
      { text: 'Installation', link: '/install' },
      { text: 'Quick Start', link: '/usage' },
      { text: 'Configuration', link: '/config' },
    ],
  },
  {
    text: 'Features',
    items: [
      { text: 'Database Backups', link: '/features/database-backups' },
      { text: 'File & Directory Backups', link: '/features/file-backups' },
      { text: 'Compression', link: '/features/compression' },
      { text: 'Retention Policies', link: '/features/retention' },
      { text: 'Metadata Preservation', link: '/features/metadata' },
      { text: 'CLI Interface', link: '/features/cli' },
    ],
  },
  {
    text: 'Advanced',
    items: [
      { text: 'Programmatic Usage', link: '/advanced/programmatic' },
      { text: 'Integration Patterns', link: '/advanced/integration' },
      { text: 'Performance Tuning', link: '/advanced/performance' },
      { text: 'Error Handling', link: '/advanced/error-handling' },
      { text: 'Custom Filtering', link: '/advanced/filtering' },
      { text: 'Custom Extensions', link: '/advanced/custom-extensions' },
    ],
  },
  {
    text: 'API Reference',
    items: [
      { text: 'Overview', link: '/api/overview' },
      { text: 'Classes', link: '/api/classes' },
      { text: 'Types', link: '/api/types' },
      { text: 'Functions', link: '/api/functions' },
      { text: 'Constants', link: '/api/constants' },
    ],
  },
  {
    text: 'Examples',
    items: [
      { text: 'Common Patterns', link: '/examples/' },
      { text: 'Web Applications', link: '/examples/web-app' },
      { text: 'CLI Scripts', link: '/examples/cli-scripts' },
      { text: 'Docker & CI/CD', link: '/examples/docker-cicd' },
      { text: 'Production Setup', link: '/examples/production' },
    ],
  },
]

const description = 'A comprehensive TypeScript backup library for databases and files, built for Bun runtime.'
const title = 'ts-backups | TypeScript Backup Library for Databases & Files'

export default withPwa(
  defineConfig({
    lang: 'en-US',
    title: 'ts-backups',
    description,
    metaChunk: true,
    cleanUrls: true,
    lastUpdated: true,

    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: './images/logo-mini.svg' }],
      ['link', { rel: 'icon', type: 'image/png', href: './images/logo.png' }],
      ['meta', { name: 'theme-color', content: '#0A0ABC' }],
      ['meta', { name: 'title', content: title }],
      ['meta', { name: 'description', content: description }],
      ['meta', { name: 'author', content: 'Stacks.js, Inc.' }],
      ['meta', {
        name: 'tags',
        content: 'typescript, database backup, file backup, bun, sqlite, postgresql, mysql, compression, retention',
      }],

      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:locale', content: 'en' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],

      ['meta', { property: 'og:site_name', content: 'ts-backups' }],
      ['meta', { property: 'og:image', content: './images/og-image.jpg' }],
      ['meta', { property: 'og:url', content: 'https://ts-backups.dev/' }],
      ...analyticsHead,
    ],

    themeConfig: {
      search: {
        provider: 'local',
      },
      logo: {
        light: './images/logo-transparent.svg',
        dark: './images/logo-white-transparent.svg',
      },

      nav,
      sidebar,

      editLink: {
        pattern: 'https://github.com/stacksjs/ts-backups/edit/main/docs/:path',
        text: 'Edit this page on GitHub',
      },

      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2025-present Stacks.js, Inc.',
      },

      socialLinks: [
        { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
        { icon: 'bluesky', link: 'https://bsky.app/profile/chrisbreuer.dev' },
        { icon: 'github', link: 'https://github.com/stacksjs/ts-backups' },
        { icon: 'discord', link: 'https://discord.gg/stacksjs' },
      ],
    },

    pwa: {
      manifest: {
        theme_color: '#0A0ABC',
      },
    },

    markdown: {
      theme: {
        light: 'github-light',
        dark: 'github-dark',
      },

      // codeTransformers: [
      //   transformerTwoslash(),
      // ],
    },

    vite: viteConfig,
  }),
)
