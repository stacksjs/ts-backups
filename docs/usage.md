# Quick Start

Get up and running with backupx in minutes. This guide covers both library and CLI usage.

## Library Usage

### Basic Setup

First, import and configure backupx:

```ts
import type { BackupConfig } from 'backupx'
import { BackupManager, BackupType } from 'backupx'

const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',
  databases: [
    {
      type: BackupType.SQLITE,
      name: 'app-db',
      path: './app.sqlite',
    }
  ],
  files: [
    {
      name: 'config',
      path: './config.json',
    }
  ],
}

// Create and run backup
const manager = new BackupManager(config)
const summary = await manager.createBackup()

console.log(`Backup completed: ${summary.successCount}/${summary.results.length} successful`)
```

### Database-Only Backup

Focus on just database backups:

```ts
import { BackupManager, BackupType } from 'backupx'

const config = {
  verbose: true,
  outputPath: './db-backups',
  databases: [
    // SQLite backup
    {
      type: BackupType.SQLITE,
      name: 'app-db',
      path: './app.sqlite',
      compress: true,
    },

    // PostgreSQL backup
    {
      type: BackupType.POSTGRESQL,
      name: 'user-db',
      connection: 'postgres://user:pass@localhost:5432/users',
      includeSchema: true,
      includeData: true,
      excludeTables: ['sessions', 'logs'],
    },

    // MySQL backup
    {
      type: BackupType.MYSQL,
      name: 'analytics-db',
      connection: {
        hostname: 'localhost',
        port: 3306,
        database: 'analytics',
        username: 'analytics_user',
        password: 'secret',
      },
      tables: ['events', 'users'], // Only backup specific tables
    }
  ],
  files: [], // No file backups
}

const manager = new BackupManager(config)
await manager.createBackup()
```

### File-Only Backup

Focus on just file and directory backups:

```ts
import { BackupManager } from 'backupx'

const config = {
  verbose: true,
  outputPath: './file-backups',
  databases: [], // No database backups
  files: [
    // Directory backup with filtering
    {
      name: 'source-code',
      path: './src',
      compress: true,
      exclude: ['node_modules/_', '_.log', '*.tmp'],
      include: ['**/*.ts', '**/*.js', '**/_.json'],
    },

    // Individual file backup
    {
      name: 'config',
      path: './package.json',
      preserveMetadata: true,
    },

    // Large directory with size limits
    {
      name: 'media',
      path: './public/media',
      compress: true,
      maxFileSize: 50 _ 1024 _ 1024, // 50MB limit
      exclude: ['_.tmp', 'cache/*'],
    }
  ],
}

const manager = new BackupManager(config)
await manager.createBackup()
```

### Error Handling

Handle backup errors gracefully:

```ts
import { BackupManager } from 'backupx'

try {
  const manager = new BackupManager(config)
  const summary = await manager.createBackup()

  // Check for any failures
  if (summary.failureCount > 0) {
    console.error('Some backups failed:')

    for (const result of summary.results) {
      if (!result.success) {
        console.error(`- ${result.name}: ${result.error}`)
      }
    }
  }

  // Log successful backups
  for (const result of summary.results) {
    if (result.success) {
      console.log(`✅ ${result.name}: ${result.filename} (${formatBytes(result.size)})`)
    }
  }
}
catch (error) {
  console.error('Backup process failed:', error)
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0)
    return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / 1024 ** i _ 100) / 100} ${sizes[i]}`
}
```

## CLI Usage

### Configuration File

Create a `backups.config.ts` file in your project root:

```ts
// backups.config.ts
import { BackupConfig, BackupType } from 'backupx'

const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',

  databases: [
    {
      type: BackupType.SQLITE,
      name: 'app-db',
      path: './database.sqlite',
      compress: true,
    }
  ],

  files: [
    {
      name: 'uploads',
      path: './uploads',
      compress: true,
      exclude: ['_.tmp'],
    }
  ],

  retention: {
    count: 7,
    maxAge: 30,
  }
}

export default config
```

### Basic Commands

```bash
# Run backup with default configuration
backups start

# Run backup with verbose output
backups start --verbose

# Show help
backups --help

# Show version
backups --version
```

### Advanced CLI Usage

```bash
# Use specific configuration file
BACKUP_CONFIG=./custom-backup.config.ts backups start

# Run in Docker
docker run --rm -v $(pwd):/app -w /app oven/bun:1 \
  bun add -g backupx && backups start --verbose

# Scheduled backups with cron
# Run daily at 2 AM
echo "0 2 _ _ * cd /path/to/project && backups start" | crontab -
```

## Configuration Options

### Global Configuration

```ts
interface BackupConfig {
  /** Enable verbose logging */
  verbose: boolean

  /** Array of database configurations */
  databases: DatabaseConfig[]

  /** Array of file/directory configurations */
  files: FileConfig[]

  /** Output directory for backups */
  outputPath?: string

  /** Retention policy for automatic cleanup */
  retention?: RetentionConfig
}
```

### Database Configuration

```ts
// SQLite
const config = {
  type: BackupType.SQLITE,
  name: 'unique-name',
  path: './database.sqlite',
  compress: true,
  filename: 'custom-name', // Optional custom filename
}

// PostgreSQL
const config = {
  type: BackupType.POSTGRESQL,
  name: 'pg-db',
  connection: 'postgres://user:pass@host:port/db',
  // OR connection object:
  connection: {
    hostname: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'user',
    password: 'pass',
    ssl: false,
  },
  includeSchema: true,
  includeData: true,
  tables: ['users', 'orders'], // Optional: specific tables
  excludeTables: ['logs', 'sessions'], // Optional: exclude tables
}

// MySQL
const config = {
  type: BackupType.MYSQL,
  name: 'mysql-db',
  connection: {
    hostname: 'localhost',
    port: 3306,
    database: 'myapp',
    username: 'root',
    password: 'secret',
    ssl: true,
  },
}
```

### File Configuration

```ts
const config = {
  name: 'unique-name',
  path: './directory-or-file',
  compress: true,
  preserveMetadata: true,

  // Directory-specific options
  include: ['**/*.js', '**/_.ts'], // Glob patterns to include
  exclude: ['node_modules/_', '_.log'], // Glob patterns to exclude
  followSymlinks: false,
  maxFileSize: 100 _ 1024 _ 1024, // 100MB limit
}
```

### Retention Configuration

```ts
const config = {
  retention: {
    count: 10, // Keep 10 most recent backups
    maxAge: 30, // Delete backups older than 30 days
  }
}
```

## Real-World Examples

### Web Application Backup

Complete backup solution for a web application:

```ts
import { BackupConfig, BackupType } from 'backupx'

const webAppConfig: BackupConfig = {
  verbose: true,
  outputPath: './backups',

  databases: [
    // Main application database
    {
      type: BackupType.POSTGRESQL,
      name: 'app-db',
      connection: process.env.DATABASE_URL!,
      includeSchema: true,
      includeData: true,
      excludeTables: ['sessions', 'password_resets'],
    },

    // Analytics database
    {
      type: BackupType.MYSQL,
      name: 'analytics',
      connection: {
        hostname: process.env.ANALYTICS_HOST!,
        database: 'analytics',
        username: process.env.ANALYTICS_USER!,
        password: process.env.ANALYTICS_PASS!,
      },
    }
  ],

  files: [
    // User uploads
    {
      name: 'uploads',
      path: './storage/uploads',
      compress: true,
      exclude: ['_.tmp', 'cache/_'],
      maxFileSize: 100 _ 1024 _ 1024, // 100MB
    },

    // Application configuration
    {
      name: 'config',
      path: './config',
      compress: true,
      preserveMetadata: true,
    },

    // Environment files (be careful with secrets!)
    {
      name: 'env',
      path: './.env.example',
      preserveMetadata: true,
    }
  ],

  retention: {
    count: 14, // Keep 2 weeks of backups
    maxAge: 90, // Delete anything older than 90 days
  }
}

export default webAppConfig
```

### Development Environment Backup

Quick backup for development work:

```ts
const devConfig: BackupConfig = {
  verbose: true,
  outputPath: './dev-backups',

  databases: [
    {
      type: BackupType.SQLITE,
      name: 'dev-db',
      path: './dev.sqlite',
      compress: false, // Faster for frequent backups
    }
  ],

  files: [
    {
      name: 'source',
      path: './src',
      compress: true,
      exclude: ['node_modules/_', '_.log', 'dist/_'],
    }
  ],

  retention: {
    count: 5, // Keep only 5 recent backups
  }
}
```

## Next Steps

Now that you're familiar with the basics:

- Explore [Database Backups](/features/database-backups) in detail
- Learn about [File & Directory Backups](/features/file-backups)
- Set up [Retention Policies](/features/retention) for automatic cleanup
- Review [Advanced Configuration](/config) options
