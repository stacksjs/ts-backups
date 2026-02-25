---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "backupx"
  text: "TypeScript Backups"
  tagline: "Comprehensive & performant database and file backup solution."
  image: /images/logo-white.png
  actions:
    - theme: brand
      text: Get Started
      link: /intro
    - theme: alt
      text: View on GitHub
      link: https://github.com/stacksjs/backupx

features:
  - title: "Database Backups"
    icon: 🗄️
    details: "Support for SQLite, PostgreSQL, and MySQL with native Bun drivers. Schema and data backups with custom table filtering."
  - title: "File & Directory Backups"
    icon: 📁
    details: "Backup individual files or entire directories with advanced filtering, compression, and metadata preservation."
  - title: "TypeScript-First"
    icon: 🔧
    details: "Fully typed APIs with comprehensive type safety. Built specifically for Bun runtime with modern JavaScript features."
  - title: "Smart Compression"
    icon: 🗜️
    details: "Optional gzip compression with size comparison and efficiency reporting. Automatic file extension handling."
  - title: "Retention Policies"
    icon: 🧹
    details: "Automatic cleanup of old backups based on count or age. Supports multiple backup types and custom retention rules."
  - title: "High Performance"
    icon: ⚡
    details: "Built for Bun's speed with streaming compression, async operations, and minimal memory footprint."
  - title: "CLI & Library"
    icon: 🛠️
    details: "Use as a library in your code or via the command-line interface. Compiled binaries for all major platforms."
  - title: "Production Ready"
    icon: 🎯
    details: "Comprehensive error handling, verbose logging, and battle-tested with extensive test suite."
---