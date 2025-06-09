# Configuration Reference

This page provides a comprehensive reference for all ts-backups configuration options.

## Configuration File Location

ts-backups automatically looks for configuration files in the following order:

1. `backups.config.ts` (TypeScript configuration)
2. `backups.config.js` (JavaScript configuration)
3. `backups.config.json` (JSON configuration)

## Base Configuration

The root configuration object supports the following properties:

```ts
interface BackupConfig {
  /** Enable verbose logging output */
  verbose: boolean

  /** Array of database backup configurations */
  databases: DatabaseConfig[]

  /** Array of file/directory backup configurations */
  files: FileConfig[]

  /** Output directory path for backup files */
  outputPath?: string

  /** Retention policy for automatic cleanup */
  retention?: RetentionConfig
};
```

### Basic Example

```ts
// backups.config.ts
import { BackupConfig, BackupType } from 'ts-backups'

const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',
  databases: [
    // ...
  ],
  files: [
    // ...
  ],
  retention: {
    // ...
  },
}

export default config
```

## Database Configuration

### SQLite Configuration

```ts
interface SQLiteConfig {
  /** Must be BackupType.SQLITE */
  type: BackupType.SQLITE

  /** Unique identifier for this backup */
  name: string

  /** Path to the SQLite database file */
  path: string

  /** Enable verbose logging for this database only */
  verbose?: boolean

  /** Whether to compress the backup file */
  compress?: boolean

  /** Custom output filename (without extension) */
  filename?: string
};
```

**Example:**

```ts
const sqliteConfig = {
  type: BackupType.SQLITE,
  name: 'app-database',
  path: './app.sqlite',
  compress: true,
  filename: 'my-app-backup', // Will create my-app-backup_2023-12-01T10-30-00.sql
}
```

### PostgreSQL Configuration

```ts
interface PostgreSQLConfig {
  /** Must be BackupType.POSTGRESQL */
  type: BackupType.POSTGRESQL

  /** Unique identifier for this backup */
  name: string

  /** Connection URL or object */
  connection: string | PostgreSQLConnection

  /** Tables to include (if omitted, all tables are included) */
  tables?: string[]

  /** Tables to exclude from backup */
  excludeTables?: string[]

  /** Whether to include schema (DDL) in backup */
  includeSchema?: boolean

  /** Whether to include data (DML) in backup */
  includeData?: boolean

  /** Enable verbose logging for this database only */
  verbose?: boolean

  /** Whether to compress the backup file */
  compress?: boolean

  /** Custom output filename (without extension) */
  filename?: string
};

interface PostgreSQLConnection {
  hostname?: string
  port?: number
  database: string
  username?: string
  password?: string
  ssl?: boolean
};
```

**Connection String Example:**

```ts
const postgresConfig = {
  type: BackupType.POSTGRESQL,
  name: 'main-db',
  connection: 'postgres://user:password@localhost:5432/myapp',
  includeSchema: true,
  includeData: true,
  excludeTables: ['sessions', 'logs'],
}
```

**Connection Object Example:**

```ts
const analyticsConfig = {
  type: BackupType.POSTGRESQL,
  name: 'analytics-db',
  connection: {
    hostname: 'analytics.example.com',
    port: 5432,
    database: 'analytics',
    username: 'analytics_user',
    password: process.env.ANALYTICS_PASSWORD,
    ssl: true,
  },
  tables: ['events', 'users', 'sessions'], // Only backup these tables
}
```

### MySQL Configuration

```ts
interface MySQLConfig {
  /** Must be BackupType.MYSQL */
  type: BackupType.MYSQL

  /** Unique identifier for this backup */
  name: string

  /** Connection URL or object */
  connection: string | MySQLConnection

  /** Tables to include (if omitted, all tables are included) */
  tables?: string[]

  /** Tables to exclude from backup */
  excludeTables?: string[]

  /** Whether to include schema (DDL) in backup */
  includeSchema?: boolean

  /** Whether to include data (DML) in backup */
  includeData?: boolean

  /** Enable verbose logging for this database only */
  verbose?: boolean

  /** Whether to compress the backup file */
  compress?: boolean

  /** Custom output filename (without extension) */
  filename?: string
};

interface MySQLConnection {
  hostname?: string
  port?: number
  database: string
  username?: string
  password?: string
  ssl?: boolean
};
```

**Example:**

```ts
const mysqlConfig = {
  type: BackupType.MYSQL,
  name: 'legacy-app',
  connection: {
    hostname: 'mysql.example.com',
    port: 3306,
    database: 'legacy_app',
    username: 'backup_user',
    password: process.env.MYSQL_PASSWORD,
    ssl: false,
  },
  includeSchema: true,
  includeData: true,
  excludeTables: ['cache', 'sessions', 'password_resets'],
}
```

## File Configuration

Files and directories share the same configuration interface:

```ts
interface FileConfig {
  /** Unique identifier for this backup */
  name: string

  /** Path to file or directory */
  path: string

  /** Enable verbose logging for this file backup only */
  verbose?: boolean

  /** Whether to compress the backup */
  compress?: boolean

  /** Custom output filename (without extension) */
  filename?: string

  /** Whether to preserve file metadata (timestamps, permissions) */
  preserveMetadata?: boolean

  // Directory-specific options (ignored for single files)

  /** Glob patterns to include (if not specified, all files included) */
  include?: string[]

  /** Glob patterns to exclude */
  exclude?: string[]

  /** Whether to follow symbolic links */
  followSymlinks?: boolean

  /** Maximum file size to include in bytes */
  maxFileSize?: number
};
```

### Single File Backup

```ts
const fileConfig = {
  name: 'app-config',
  path: './config.json',
  preserveMetadata: true,
  compress: false, // Small files don't benefit much from compression
}
```

### Directory Backup

```ts
const directoryConfig = {
  name: 'source-code',
  path: './src',
  compress: true,
  include: [
    '**/*.ts',
    '**/*.js',
    '**/*.json',
    '**/*.md'
  ],
  exclude: [
    'node_modules/**',
    '*.log',
    '*.tmp',
    'dist/**',
    'coverage/**'
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB limit
  followSymlinks: false,
}
```

### Large Directory with Filtering

```ts
const largeDirectoryConfig = {
  name: 'user-uploads',
  path: './public/uploads',
  compress: true,
  exclude: [
    '*.tmp',
    'cache/**',
    'thumbnails/**',
  ],
  maxFileSize: 50 * 1024 * 1024, // 50MB limit
  preserveMetadata: true,
}
```

## Retention Configuration

Control automatic cleanup of old backup files:

```ts
interface RetentionConfig {
  /** Number of backups to keep (keeps most recent) */
  count?: number

  /** Maximum age in days (deletes older backups) */
  maxAge?: number
};
```

### Examples

**Keep Only Recent Backups:**

```ts
const countRetention = {
  retention: {
    count: 5, // Keep only the 5 most recent backups
  }
}
```

**Age-Based Retention:**

```ts
const ageRetention = {
  retention: {
    maxAge: 30, // Delete backups older than 30 days
  }
}
```

**Combined Retention:**

```ts
const combinedRetention = {
  retention: {
    count: 10, // Keep at least 10 backups
    maxAge: 90, // But delete anything older than 90 days
  }
}
```

## Glob Patterns

File filtering uses glob patterns for include/exclude rules:

| Pattern | Description | Example |
|---------|-------------|---------|
| `*` | Match any characters except `/` | `*.js` matches all JS files |
| `**` | Match any characters including `/` | `**/*.js` matches JS files in any subdirectory |
| `?` | Match single character | `file?.txt` matches `file1.txt`, `filea.txt` |
| `[]` | Character class | `[0-9]*.txt` matches files starting with digits |
| `!` | Negation (in exclude patterns) | `!important.log` excludes this specific file |

### Common Patterns

```ts
const commonPatterns = {
  // Development files
  exclude: [
    'node_modules/**', // All of node_modules
    '*.log', // Log files
    '*.tmp', // Temporary files
    'dist/**', // Build output
    '.git/**', // Git directory
    'coverage/**', // Test coverage
  ],

  // Source code only
  include: [
    '**/*.ts', // TypeScript files
    '**/*.js', // JavaScript files
    '**/*.json', // JSON files
    '**/*.md', // Markdown files
    'package.json', // Specific file
  ],

  // Images and media
  media: [
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.png',
    '**/*.gif',
    '**/*.mp4',
    '**/*.pdf',
  ]
}
```

## Environment Variables

Use environment variables for sensitive configuration:

```ts
// backups.config.ts
import { BackupConfig, BackupType } from 'ts-backups'

const config: BackupConfig = {
  verbose: process.env.NODE_ENV === 'development',
  outputPath: process.env.BACKUP_PATH || './backups',

  databases: [
    {
      type: BackupType.POSTGRESQL,
      name: 'production-db',
      connection: {
        hostname: process.env.DB_HOST!,
        port: Number.parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME!,
        username: process.env.DB_USER!,
        password: process.env.DB_PASSWORD!,
        ssl: process.env.DB_SSL === 'true',
      }
    }
  ],

  retention: {
    count: Number.parseInt(process.env.BACKUP_RETENTION_COUNT || '7'),
    maxAge: Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  }
}

export default config
```

## Multiple Environment Configurations

Create different configurations for different environments:

```ts
// backups.config.ts
import { BackupConfig, BackupType } from 'ts-backups'

const baseConfig: BackupConfig = {
  verbose: true,
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
    }
  ],
}

const configs = {
  development: {
    ...baseConfig,
    outputPath: './dev-backups',
    retention: { count: 3 }
  },

  staging: {
    ...baseConfig,
    outputPath: './staging-backups',
    retention: { count: 7, maxAge: 14 }
  },

  production: {
    ...baseConfig,
    outputPath: '/var/backups/app',
    retention: { count: 30, maxAge: 90 },
    databases: [
      {
        type: BackupType.POSTGRESQL,
        name: 'production-db',
        connection: process.env.DATABASE_URL!,
        compress: true,
      }
    ],
  }
}

const env = process.env.NODE_ENV || 'development'
export default configs[env as keyof typeof configs]
```

## Configuration Validation

ts-backups automatically validates your configuration and will provide helpful error messages:

### Common Validation Errors

**Missing Required Fields:**
```
❌ Database configuration missing required field: name
❌ File configuration missing required field: path
```

**Invalid Types:**
```
❌ Database type must be one of: sqlite, postgresql, mysql
❌ Retention count must be a positive integer
```

**Invalid Paths:**
```
❌ SQLite database file not found: ./missing.sqlite
❌ File path does not exist: ./missing-directory
```

**Duplicate Names:**
```
❌ Duplicate backup name found: 'app-db'
   Each backup must have a unique name
```

## Configuration Best Practices

### 1. Use TypeScript Configuration

Always use `.ts` configuration files for type safety:

```ts
// ✅ Good - Full type safety
import { BackupConfig, BackupType } from 'ts-backups'

const config: BackupConfig = {
  // TypeScript will catch errors
}

// ❌ Avoid - No type checking
const config = {
  // Typos and errors won't be caught
}
```

### 2. Use Environment Variables for Secrets

```ts
// ✅ Good
const connection = {
  username: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
}

// ❌ Never hardcode secrets
const connection = {
  username: 'admin',
  password: 'secret123',
}
```

### 3. Organize Large Configurations

```ts
// ✅ Good - Split into logical sections
const databaseConfigs = [
  // ...
]
const fileConfigs = [
  // ...
]

const config: BackupConfig = {
  databases: databaseConfigs,
  files: fileConfigs,
  // ...
}
```

### 4. Document Complex Configurations

```ts
const config: BackupConfig = {
  databases: [
    {
      type: BackupType.POSTGRESQL,
      name: 'user-data',
      connection: process.env.DATABASE_URL!,
      // Exclude sensitive tables from backup
      excludeTables: ['user_sessions', 'password_resets', 'login_attempts'],
      includeSchema: true,
      includeData: true,
    }
  ],
}
```

## Testing Configuration

Test your configuration before running in production:

```bash
# Dry run to validate configuration
backups start --verbose --dry-run

# Test with minimal data first
backups start --verbose
```

## Next Steps

- Learn about [Database Backup Features](/features/database-backups)
- Explore [File Backup Options](/features/file-backups)
- Set up [Retention Policies](/features/retention)
- Review [Advanced Usage Patterns](/advanced/programmatic)
