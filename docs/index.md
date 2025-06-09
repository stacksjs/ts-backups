---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "backupx"
  text: "TypeScript Backups"
  tagline: "Comprehensive database and file backup solution built for Bun runtime with TypeScript-first design."
  image: /images/logo-white.png
  actions:
    - theme: brand
      text: Get Started
      link: /intro
    - theme: alt
      text: View on GitHub
      link: https://github.com/stacksjs/backupx

features:
  - title: "🗄️ Database Backups"
    details: "Support for SQLite, PostgreSQL, and MySQL with native Bun drivers. Schema and data backups with custom table filtering."
  - title: "📁 File & Directory Backups"
    details: "Backup individual files or entire directories with advanced filtering, compression, and metadata preservation."
  - title: "🔧 TypeScript-First"
    details: "Fully typed APIs with comprehensive type safety. Built specifically for Bun runtime with modern JavaScript features."
  - title: "🗜️ Smart Compression"
    details: "Optional gzip compression with size comparison and efficiency reporting. Automatic file extension handling."
  - title: "🧹 Retention Policies"
    details: "Automatic cleanup of old backups based on count or age. Supports multiple backup types and custom retention rules."
  - title: "⚡ High Performance"
    details: "Built for Bun's speed with streaming compression, async operations, and minimal memory footprint."
  - title: "🛠️ CLI & Library"
    details: "Use as a library in your code or via the command-line interface. Compiled binaries for all major platforms."
  - title: "🎯 Production Ready"
    details: "Comprehensive error handling, verbose logging, and battle-tested with extensive test suite (77 tests)."
---

<Home />
