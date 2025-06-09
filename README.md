<p align="center"><img src=".github/art/cover.jpg" alt="Social Card of this repo"></p>

[![npm version][npm-version-src]][npm-version-href]
[![GitHub Actions][github-actions-src]][github-actions-href]
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
<!-- [![npm downloads][npm-downloads-src]][npm-downloads-href] -->
<!-- [![Codecov][codecov-src]][codecov-href] -->

# ts-backups

A TypeScript library for creating database backups with native Bun support for SQLite, PostgreSQL, and MySQL.

## Features

- 🗄️ **Multi-Database Support** - SQLite, PostgreSQL, and MySQL (via Bun's native drivers)
- 🔄 **Retention Policies** - Configure backup retention by count or age
- 📁 **Flexible Output** - Customizable backup file naming and output directories
- ⚡ **Performance** - Built with Bun for fast execution
- 🧪 **Thoroughly Tested** - Comprehensive test suite with 95%+ coverage
- 🔧 **TypeScript First** - Fully typed APIs for better developer experience
- 📦 **CLI & Programmatic** - Use as a library or command-line tool

## Installation

```bash
# Using Bun (recommended)
bun add ts-backups
```

## Quick Start

### Programmatic Usage

```typescript
import { createBackup } from 'ts-backups'

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
  retention: {
    count: 5, // Keep 5 most recent backups
    maxAge: 30 // Delete backups older than 30 days
  }
}

const summary = await createBackup(config)
console.log(`✅ ${summary.successCount} backups completed`)
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
- ✅ **Backup Manager** - Multi-database coordination, error handling
- ✅ **Retention Policies** - Count-based and age-based cleanup
- ✅ **Error Scenarios** - Database connection failures, permission issues
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
├── backup-manager.test.ts # Multi-database backup coordination
└── index.test.ts          # Integration tests and exports
```

### Writing Tests

The test suite uses Bun's built-in test runner with comprehensive setup/teardown:

```typescript
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

describe('Custom Tests', () => {
  beforeEach(async () => {
    // Setup test databases and directories
  })

  afterEach(async () => {
    // Clean up test files
  })

  it('should backup database successfully', async () => {
    // Test implementation
  })
})
```

## Configuration

Create a `backups.config.ts` file:

```typescript
import { BackupConfig } from 'ts-backups'

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
  ]
}
```

## Database Support

### SQLite ✅ Fully Supported
- Native `bun:sqlite` driver
- Complete schema export (tables, indexes, triggers, views)
- Efficient data export with proper escaping
- Binary data support (BLOB fields)

### PostgreSQL ✅ Fully Supported
- Native Bun SQL class
- Connection strings or configuration objects
- Schema extraction and data export
- Batch processing for large datasets

### MySQL ⏳ Coming Soon
- Waiting for Bun's native MySQL driver
- Placeholder implementation ready

## API Reference

### `createBackup(config: BackupConfig): Promise<BackupSummary>`

Creates backups for all configured databases.

### `BackupManager`

```typescript
const manager = new BackupManager(config)
const summary = await manager.createBackup()
```

### Database-Specific Functions

```typescript
import { backupPostgreSQL, backupSQLite } from 'ts-backups'

const result = await backupSQLite(sqliteConfig, './output')
const result = await backupPostgreSQL(pgConfig, './output')
```

## Contributing

We welcome contributions! Please see our [testing guidelines](#testing) for running the test suite.

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `bun test`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE.md) for details.

Made with 💙

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/bun-ts-starter?style=flat-square
[npm-version-href]: https://npmjs.com/package/bun-ts-starter
[github-actions-src]: https://img.shields.io/github/actions/workflow/status/stacksjs/ts-starter/ci.yml?style=flat-square&branch=main
[github-actions-href]: https://github.com/stacksjs/ts-starter/actions?query=workflow%3Aci

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/ts-starter/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/ts-starter -->
