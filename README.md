<p align="center"><img src=".github/art/cover.jpg" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# backupx

> A comprehensive TypeScript backup library for databases, files, and directories.

## Features

- 🗄️ **Multi-Database Support** - SQLite, PostgreSQL, and MySQL (via Bun's native drivers)
- 📁 **File & Directory Backups** - Backup individual files or entire directories with filtering
- 🗜️ **Compression Support** - Optional gzip compression for all backup types
- 🎯 **Advanced Filtering** - Include/exclude patterns with glob support for directory backups
- 🔄 **Retention Policies** - Configure backup retention by count or age
- 📁 **Flexible Output** - Customizable backup file naming and output directories
- ⚡ **Performance** - Built with Bun for fast execution
- 🧪 **Thoroughly Tested** - Comprehensive test suite with 95%+ coverage
- 🔧 **TypeScript First** - Fully typed APIs for better developer experience
- 📦 **CLI & Programmatic** - Use as a library or command-line tool

## Installation

```bash
# Using Bun (recommended)
bun add backupx
```

## Quick Start

### Programmatic Usage

```ts
import { createBackup } from 'backupx'

const config = {
  verbose: true,
  outputPath: './backups',
  databases: [
    {
      type: 'sqlite',
      name: 'my-app-db',
      path: './data/app.sqlite'
    },
    {
      type: 'postgresql',
      name: 'users-db',
      connection: 'postgres://user:pass@localhost:5432/myapp'
    }
  ],
  files: [
    {
      name: 'uploads',
      path: './public/uploads', // Automatically detected as directory
      compress: true,
      include: ['*.jpg', '*.png', '*.pdf'],
      exclude: ['temp/*']
    },
    {
      name: 'config',
      path: './config/app.json', // Automatically detected as file
      compress: false
    }
  ],
  retention: {
    count: 5, // Keep 5 most recent backups
    maxAge: 30 // Delete backups older than 30 days
  }
}

const summary = await createBackup(config)
console.log(`✅ ${summary.successCount} backups completed`)
console.log(`📊 Database backups: ${summary.databaseBackups.length}`)
console.log(`📁 File backups: ${summary.fileBackups.length}`)
```

### CLI Usage

```bash
# Create backups.config.ts file first
./backups start --verbose
```

## Testing

The library includes a comprehensive test suite covering:

- ✅ **Type Safety** - TypeScript configuration validation
- ✅ **SQLite Backups** - Schema extraction, data export, special characters
- ✅ **File Backups** - Individual file backup with compression and metadata preservation
- ✅ **Directory Backups** - Full directory backup with glob filtering and size limits
- ✅ **Backup Manager** - Multi-database and file coordination, error handling
- ✅ **Retention Policies** - Count-based and age-based cleanup for all backup types
- ✅ **Error Scenarios** - Database connection failures, permission issues, missing files
- ✅ **CLI Integration** - Command-line interface functionality

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch

# Run with coverage
bun run test:coverage

# Run specific test files
bun test test/sqlite.test.ts
bun test test/backup-manager.test.ts
```

### Test Structure

```
test/
├── types.test.ts          # Type definitions and configurations
├── config.test.ts         # Default configuration validation
├── sqlite.test.ts         # SQLite backup functionality
├── file.test.ts           # Individual file backup functionality
├── directory.test.ts      # Directory backup with filtering
├── backup-manager.test.ts # Multi-database and file coordination
└── index.test.ts          # Integration tests and exports
```

## Configuration

Create a `backups.config.ts` file:

```ts
import { BackupConfig } from 'backupx'

export const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',
  retention: {
    count: 10, // Keep 10 most recent backups
    maxAge: 90 // Delete backups older than 90 days
  },
  databases: [
    // SQLite
    {
      type: 'sqlite',
      name: 'app-database',
      path: './data/app.sqlite',
      compress: true
    },

    // PostgreSQL
    {
      type: 'postgresql',
      name: 'user-data',
      connection: {
        hostname: 'localhost',
        port: 5432,
        database: 'myapp',
        username: 'postgres',
        password: 'secret'
      },
      tables: ['users', 'orders'], // Specific tables only
      includeSchema: true,
      includeData: true
    },

    // MySQL (when Bun adds support)
    {
      type: 'mysql',
      name: 'analytics',
      connection: 'mysql://user:pass@localhost:3306/analytics',
      excludeTables: ['temp_logs', 'cache']
    }
  ],

  files: [
    // Directory backups (automatically detected from path)
    {
      name: 'app-uploads',
      path: './public/uploads',
      compress: true,
      include: ['*.jpg', '*.png', '*.pdf', '*.doc*'],
      exclude: ['temp/*', '*.tmp'],
      maxFileSize: 50 * 1024 * 1024, // 50MB max file size
      preserveMetadata: true,
      followSymlinks: false
    },

    {
      name: 'user-data',
      path: './data/users',
      compress: false,
      exclude: ['*.cache', 'temp/*', '*.log'],
      preserveMetadata: true
    },

    // Individual file backups (automatically detected from path)
    {
      name: 'app-config',
      path: './config/app.json',
      compress: false,
      preserveMetadata: true
    },

    {
      name: 'env-file',
      path: './.env.production',
      compress: true,
      filename: 'production-env' // Custom filename
    }
  ]
}
```

## Backup Support

### Database Backups

#### SQLite ✅ Fully Supported

- Native `bun:sqlite` driver
- Complete schema export (tables, indexes, triggers, views)
- Efficient data export with proper escaping
- Binary data support (BLOB fields)

#### PostgreSQL ✅ Fully Supported

- Native Bun SQL class
- Connection strings or configuration objects
- Schema extraction and data export
- Batch processing for large datasets

#### MySQL ⏳ Coming Soon

- Waiting for Bun's native MySQL driver
- Placeholder implementation ready

### File & Directory Backups

#### Directory Backups ✅ Fully Supported

- Recursive directory scanning with configurable depth
- Advanced glob pattern filtering (include/exclude)
- File size limits and symbolic link handling
- Metadata preservation (timestamps, permissions)
- Custom archive format with compression support

#### Individual File Backups ✅ Fully Supported

- Single file backup with original extension preservation
- Optional gzip compression for any file type
- Metadata preservation in separate `.meta` files
- Binary and text file support
- Custom filename and output path configuration

## API Reference

### `createBackup(config: BackupConfig): Promise<BackupSummary>`

Creates backups for all configured databases.

### `BackupManager`

```ts
const manager = new BackupManager(config)
const summary = await manager.createBackup()
```

### Database-Specific Functions

```ts
import { backupPostgreSQL, backupSQLite } from 'backupx'

const result = await backupSQLite(sqliteConfig, './output')
const result = await backupPostgreSQL(pgConfig, './output')
```

## Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## Contributing

Please see the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## Postcardware

“Software that is free, but hopes for a postcard.” We love receiving postcards from around the world showing where Stacks is being used! We showcase them on our website too.

Our address: Stacks.js, 12665 Village Ln #2306, Playa Vista, CA 90094, United States 🌎

## Sponsors

We would like to extend our thanks to the following sponsors for funding Stacks development. If you are interested in becoming a sponsor, please reach out to us.

- [JetBrains](https://www.jetbrains.com/)
- [The Solana Foundation](https://solana.com/)

## License

The MIT License (MIT). Please see [LICENSE](LICENSE.md) for more information.

Made with 💙

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/backupx?style=flat-square
[npm-version-href]: https://npmjs.com/package/backupx
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/backupx/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/backupx/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/backupx/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/backupx -->
