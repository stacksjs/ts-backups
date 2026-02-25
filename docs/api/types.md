# Types API Reference

This page documents all TypeScript interfaces and types used in backupx.

## Core Configuration Types

### BackupConfig

Main configuration interface for backup operations.

```ts
interface BackupConfig {
  verbose: boolean
  databases: DatabaseConfig[]
  files: FileConfig[]
  outputPath?: string
  retention?: RetentionConfig
}
```

**Properties:**

- `verbose` - Enable detailed logging output
- `databases` - Array of database configurations to backup
- `files` - Array of file/directory configurations to backup
- `outputPath` - Directory to store backup files (optional, defaults to './backups')
- `retention` - Retention policy for old backups (optional)

### DatabaseConfig

Base configuration for database backups.

```ts
interface DatabaseConfig {
  type: BackupType
  name: string
  verbose?: boolean
  compress?: boolean
  filename?: string
}
```

**Properties:**

- `type` - Type of database (SQLite, PostgreSQL, MySQL)
- `name` - Unique identifier for this backup
- `verbose` - Override global verbose setting (optional)
- `compress` - Enable compression for this backup (optional)
- `filename` - Custom filename for backup file (optional)

### SQLiteConfig

Configuration specific to SQLite database backups.

```ts
interface SQLiteConfig extends DatabaseConfig {
  type: BackupType.SQLITE
  path: string
}
```

**Properties:**

- `path` - File system path to the SQLite database file

### PostgreSQLConfig

Configuration for PostgreSQL database backups.

```ts
interface PostgreSQLConfig extends DatabaseConfig {
  type: BackupType.POSTGRESQL
  connection: string | PostgreSQLConnectionObject
  tables?: string[]
  excludeTables?: string[]
  includeSchema?: boolean
  includeData?: boolean
}
```

**Properties:**

- `connection` - Connection string or connection object
- `tables` - Specific tables to backup (optional, defaults to all)
- `excludeTables` - Tables to exclude from backup (optional)
- `includeSchema` - Include table structure (optional, defaults to true)
- `includeData` - Include table data (optional, defaults to true)

### PostgreSQLConnectionObject

Object-based PostgreSQL connection configuration.

```ts
interface PostgreSQLConnectionObject {
  hostname: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean | string
}
```

### MySQLConfig

Configuration for MySQL database backups.

```ts
interface MySQLConfig extends DatabaseConfig {
  type: BackupType.MYSQL
  connection: MySQLConnectionObject
  tables?: string[]
  excludeTables?: string[]
  includeSchema?: boolean
  includeData?: boolean
}
```

### MySQLConnectionObject

MySQL connection configuration object.

```ts
interface MySQLConnectionObject {
  hostname: string
  port: number
  database: string
  username: string
  password: string
  ssl?: boolean
}
```

### FileConfig

Configuration for file and directory backups.

```ts
interface FileConfig {
  name: string
  path: string
  verbose?: boolean
  compress?: boolean
  filename?: string
  include?: string[]
  exclude?: string[]
  maxFileSize?: number
  followSymlinks?: boolean
  preserveMetadata?: boolean
}
```

**Properties:**

- `name` - Unique identifier for this backup
- `path` - File system path to backup
- `verbose` - Override global verbose setting (optional)
- `compress` - Enable compression (optional)
- `filename` - Custom filename for backup archive (optional)
- `include` - Glob patterns for files to include (optional)
- `exclude` - Glob patterns for files to exclude (optional)
- `maxFileSize` - Maximum file size to include in bytes (optional)
- `followSymlinks` - Follow symbolic links (optional, defaults to false)
- `preserveMetadata` - Preserve file metadata (optional, defaults to false)

### RetentionConfig

Configuration for backup retention policies.

```ts
interface RetentionConfig {
  count?: number
  maxAge?: number
}
```

**Properties:**

- `count` - Maximum number of backups to keep (optional)
- `maxAge` - Maximum age of backups in days (optional)

## Result Types

### BackupSummary

Summary of a complete backup operation.

```ts
interface BackupSummary {
  startTime: Date
  endTime: Date
  duration: number
  results: BackupResult[]
  successCount: number
  failureCount: number
  totalSize: number
}
```

**Properties:**

- `startTime` - When the backup process started
- `endTime` - When the backup process completed
- `duration` - Total duration in milliseconds
- `results` - Array of individual backup results
- `successCount` - Number of successful backups
- `failureCount` - Number of failed backups
- `totalSize` - Total size of all successful backups in bytes

### BackupResult

Result of an individual backup operation.

```ts
interface BackupResult {
  name: string
  type: BackupType
  filename: string
  size: number
  duration: number
  success: boolean
  error?: string
  fileCount?: number
}
```

**Properties:**

- `name` - Name identifier of the backup
- `type` - Type of backup performed
- `filename` - Name of the created backup file
- `size` - Size of the backup file in bytes
- `duration` - Time taken for this backup in milliseconds
- `success` - Whether the backup succeeded
- `error` - Error message if backup failed (optional)
- `fileCount` - Number of files backed up (for file/directory backups, optional)

### CleanupResult

Result of a retention cleanup operation.

```ts
interface CleanupResult {
  deletedCount: number
  deletedFiles: string[]
  freedSpace: number
  errors: string[]
}
```

**Properties:**

- `deletedCount` - Number of files deleted
- `deletedFiles` - Array of deleted file names
- `freedSpace` - Amount of disk space freed in bytes
- `errors` - Array of error messages for files that couldn't be deleted

## Enum Types

### BackupType

Enumeration of supported backup types.

```ts
enum BackupType {
  SQLITE = 'SQLITE',
  POSTGRESQL = 'POSTGRESQL',
  MYSQL = 'MYSQL',
  FILE = 'FILE',
  DIRECTORY = 'DIRECTORY'
}
```

**Values:**

- `SQLITE` - SQLite database backup
- `POSTGRESQL` - PostgreSQL database backup
- `MYSQL` - MySQL database backup
- `FILE` - Individual file backup
- `DIRECTORY` - Directory backup

### BackupErrorCode

Error codes for backup operations.

```ts
enum BackupErrorCode {
  INVALID_CONFIG = 'INVALID_CONFIG',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DISK_FULL = 'DISK_FULL',
  COMPRESSION_FAILED = 'COMPRESSION_FAILED',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

## Utility Types

### ValidationResult

Result of configuration validation.

```ts
interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}
```

**Properties:**

- `isValid` - Whether the configuration is valid
- `errors` - Array of validation errors
- `warnings` - Array of validation warnings

### BackupMetadata

Metadata about a backup file.

```ts
interface BackupMetadata {
  filename: string
  type: BackupType
  name: string
  created: Date
  size: number
  compressed: boolean
  checksum?: string
}
```

**Properties:**

- `filename` - Name of the backup file
- `type` - Type of backup
- `name` - Backup identifier
- `created` - Creation timestamp
- `size` - File size in bytes
- `compressed` - Whether the backup is compressed
- `checksum` - File checksum for integrity verification (optional)

### ProgressInfo

Information about backup progress.

```ts
interface ProgressInfo {
  current: number
  total: number
  currentOperation: string
  estimatedTimeRemaining?: number
}
```

**Properties:**

- `current` - Current progress count
- `total` - Total operations to complete
- `currentOperation` - Description of current operation
- `estimatedTimeRemaining` - Estimated time remaining in milliseconds (optional)

## Type Guards

Utility functions for type checking.

### isBackupResult

```ts
function isBackupResult(obj: any): obj is BackupResult {
  return obj
    && typeof obj.name === 'string'
    && typeof obj.type === 'string'
    && typeof obj.success === 'boolean'
}
```

### isDatabaseConfig

```ts
function isDatabaseConfig(config: any): config is DatabaseConfig {
  return config
    && typeof config.type === 'string'
    && [BackupType.SQLITE, BackupType.POSTGRESQL, BackupType.MYSQL].includes(config.type)
}
```

### isFileConfig

```ts
function isFileConfig(config: any): config is FileConfig {
  return config
    && typeof config.name === 'string'
    && typeof config.path === 'string'
}
```

All types are exported from the main package and provide full TypeScript intellisense and type safety.
