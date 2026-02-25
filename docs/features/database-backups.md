# Database Backups

backupx provides comprehensive database backup support for SQLite, PostgreSQL, and MySQL databases, with advanced features for filtering, compression, and connection management.

## Supported Databases

### SQLite

SQLite support is built directly into Bun, providing fast and reliable backups:

```ts
const sqliteConfig = {
  type: BackupType.SQLITE,
  name: 'app-database',
  path: './database.sqlite',
  compress: true,
}
```

**Features:**

- ✅ Direct file-based backup
- ✅ No additional dependencies
- ✅ Complete schema and data export
- ✅ Supports WAL mode databases
- ✅ Atomic backup operations

### PostgreSQL

Full PostgreSQL support with flexible connection options:

```ts
// Connection string
const postgresConfig1 = {
  type: BackupType.POSTGRESQL,
  name: 'main-db',
  connection: 'postgres://user:pass@localhost:5432/myapp',
  includeSchema: true,
  includeData: true,
}

// Connection object
const postgresConfig2 = {
  type: BackupType.POSTGRESQL,
  name: 'analytics',
  connection: {
    hostname: 'pg.example.com',
    port: 5432,
    database: 'analytics',
    username: 'backup_user',
    password: process.env.PG_PASSWORD,
    ssl: true,
  },
}
```

**Features:**

- ✅ Connection strings and objects
- ✅ SSL/TLS support
- ✅ Schema-only or data-only backups
- ✅ Table filtering (include/exclude)
- ✅ Custom port and authentication

### MySQL

Complete MySQL and MariaDB compatibility:

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
}
```

**Features:**

- ✅ MySQL 5.7+ and MariaDB support
- ✅ SSL connection support
- ✅ Custom authentication methods
- ✅ Table filtering capabilities
- ✅ Charset and collation preservation

## Advanced Configuration

### Table Filtering

Control which tables are included in your backups:

```ts
const filterConfig = {
  type: BackupType.POSTGRESQL,
  name: 'user-data',
  connection: process.env.DATABASE_URL,

  // Include only specific tables
  tables: ['users', 'profiles', 'settings'],

  // Or exclude specific tables
  excludeTables: ['sessions', 'logs', 'cache', 'password_resets'],

  includeSchema: true,
  includeData: true,
}
```

### Schema vs Data

Choose what to include in your backups:

```ts
// Schema only (structure, no data)
const schemaOnlyConfig = {
  type: BackupType.MYSQL,
  name: 'schema-backup',
  connection: connectionConfig,
  includeSchema: true,
  includeData: false, // No data
}

// Data only (no schema)
const dataOnlyConfig = {
  type: BackupType.MYSQL,
  name: 'data-backup',
  connection: connectionConfig,
  includeSchema: false, // No schema
  includeData: true,
}

// Complete backup (default)
const fullBackupConfig = {
  type: BackupType.MYSQL,
  name: 'full-backup',
  connection: connectionConfig,
  includeSchema: true,
  includeData: true,
}
```

### Connection Security

Secure your database connections:

```ts
// PostgreSQL with SSL
const securePostgresConfig = {
  type: BackupType.POSTGRESQL,
  name: 'secure-db',
  connection: {
    hostname: 'secure-pg.example.com',
    port: 5432,
    database: 'production',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: true, // Enable SSL
  },
}

// MySQL with SSL
const secureMySQLConfig = {
  type: BackupType.MYSQL,
  name: 'secure-mysql',
  connection: {
    hostname: 'secure-mysql.example.com',
    port: 3306,
    database: 'app',
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    ssl: true,
  },
}
```

### Custom Output Naming

Control backup file naming:

```ts
const customNameConfig = {
  type: BackupType.SQLITE,
  name: 'app-db',
  path: './app.sqlite',
  filename: 'daily-backup', // Custom base name
  // Results in: daily-backup_2023-12-01T10-30-00.sql
}
```

## Production Examples

### Multi-Database Setup

Backup multiple databases with different configurations:

```ts
const config: BackupConfig = {
  verbose: true,
  outputPath: './production-backups',

  databases: [
    // Main application database
    {
      type: BackupType.POSTGRESQL,
      name: 'app-main',
      connection: process.env.PRIMARY_DATABASE_URL!,
      includeSchema: true,
      includeData: true,
      excludeTables: [
        'sessions', // Session data
        'password_resets', // Temporary tokens
        'failed_jobs', // Job queue data
        'cache', // Application cache
      ],
      compress: true,
    },

    // Analytics database (data only)
    {
      type: BackupType.POSTGRESQL,
      name: 'analytics-data',
      connection: process.env.ANALYTICS_DATABASE_URL!,
      includeSchema: false, // Schema rarely changes
      includeData: true,
      tables: ['events', 'user_analytics', 'page_views'],
      compress: true,
    },

    // Configuration database (schema + data)
    {
      type: BackupType.MYSQL,
      name: 'config-db',
      connection: {
        hostname: process.env.CONFIG_DB_HOST!,
        database: 'app_config',
        username: process.env.CONFIG_DB_USER!,
        password: process.env.CONFIG_DB_PASSWORD!,
        ssl: true,
      },
      includeSchema: true,
      includeData: true,
      compress: false, // Small database, compression not needed
    },

    // Local SQLite cache
    {
      type: BackupType.SQLITE,
      name: 'local-cache',
      path: './storage/cache.sqlite',
      compress: true,
    },
  ],

  files: [], // No file backups in this config

  retention: {
    count: 14, // Keep 2 weeks
    maxAge: 90, // Delete after 90 days
  }
}
```

### Development Environment

Simplified setup for development:

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
    },

    {
      type: BackupType.POSTGRESQL,
      name: 'test-db',
      connection: 'postgres://localhost:5432/test_db',
      includeSchema: true,
      includeData: true,
      // No table filtering for dev environment
    },
  ],

  retention: {
    count: 5, // Keep only recent backups
  }
}
```

## Error Handling

Database backups can fail for various reasons. backupx provides detailed error information:

```ts
const manager = new BackupManager(config)
const summary = await manager.createBackup()

// Check for database backup failures
const dbFailures = summary.databaseBackups.filter(r => !r.success)

for (const failure of dbFailures) {
  console.error(`Database backup failed: ${failure.name}`)
  console.error(`Error: ${failure.error}`)

  // Common error types:
  if (failure.error?.includes('connection')) {
    console.log('💡 Check database connection settings')
  }
  else if (failure.error?.includes('permission')) {
    console.log('💡 Check database user permissions')
  }
  else if (failure.error?.includes('not found')) {
    console.log('💡 Verify database exists and path is correct')
  }
}
```

### Common Issues

**Connection Failures:**

```ts
// ❌ Bad: Hardcoded localhost
const badConfig = {
  connection: 'postgres://user:pass@localhost:5432/db'
}

// ✅ Good: Environment-based
const goodConfig = {
  connection: process.env.DATABASE_URL || 'postgres://localhost:5432/dev_db'
}
```

**Permission Issues:**

```sql
-- Grant backup permissions for PostgreSQL
GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
GRANT USAGE ON SCHEMA public TO backup_user;

-- Grant backup permissions for MySQL
GRANT SELECT ON database_name.* TO 'backup_user'@'%';
```

**SSL Certificate Problems:**

```ts
// For development with self-signed certificates
const devConnectionConfig = {
  connection: {
    hostname: 'localhost',
    database: 'myapp',
    username: 'user',
    password: 'pass',
    ssl: false, // Disable SSL for development
  }
}
```

## Performance Optimization

### Large Database Backups

For large databases, consider these optimizations:

```ts
const largeDbConfig = {
  type: BackupType.POSTGRESQL,
  name: 'large-db',
  connection: connectionConfig,

  // Exclude large tables that change frequently
  excludeTables: [
    'logs',
    'audit_trail',
    'temporary_data',
    'search_index',
  ],

  // Use compression for large datasets
  compress: true,

  // Backup schema separately for faster restores
  includeSchema: true,
  includeData: true,
}

// Separate data-only backup for frequently changing data
const dataOnlyLargeConfig = {
  type: BackupType.POSTGRESQL,
  name: 'large-db-data-only',
  connection: connectionConfig,
  tables: ['users', 'orders', 'products'], // Only essential tables
  includeSchema: false,
  includeData: true,
  compress: true,
}
```

### Parallel Backups

Run multiple database backups concurrently:

```ts
import { backupMySQL, backupPostgreSQL, backupSQLite } from 'backupx'

// Manual parallel execution
const backupPromises = [
  backupSQLite(sqliteConfig, outputPath),
  backupPostgreSQL(pgConfig, outputPath),
  backupMySQL(mysqlConfig, outputPath),
]

const results = await Promise.allSettled(backupPromises)
```

## Backup Verification

Verify your database backups are valid:

```ts
// After backup completion
const summary = await manager.createBackup()

for (const result of summary.databaseBackups) {
  if (result.success) {
    console.log(`✅ ${result.name}: ${formatBytes(result.size)}`)

    // Verify backup file exists and has content
    const backupPath = join(outputPath, result.filename)
    const stats = await stat(backupPath)

    if (stats.size === 0) {
      console.warn(`⚠️  Backup file is empty: ${result.filename}`)
    }
  }
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0)
    return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / 1024 ** i * 100) / 100} ${sizes[i]}`
}
```

## Next Steps

- Learn about [File & Directory Backups](/features/file-backups)
- Set up [Retention Policies](/features/retention) for automatic cleanup
- Explore [Compression Options](/features/compression)
- Review [Advanced Integration Patterns](/advanced/integration)
