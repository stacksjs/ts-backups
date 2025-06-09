# API Reference

Complete API reference for ts-backups TypeScript library.

## Main Classes

### BackupManager

The primary class for managing backups with automatic configuration discovery and execution.

```ts
class BackupManager {
  constructor(config: BackupConfig)

  async createBackup(): Promise<BackupSummary>
}
```

**Parameters:**
- `config`: BackupConfig - The backup configuration

**Returns:**
- `Promise<BackupSummary>` - Summary of backup operations

**Example:**
```ts
const manager = new BackupManager(config)
const summary = await manager.createBackup()
```

## Configuration Types

### BackupConfig

Main configuration interface for ts-backups.

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
}
```

### DatabaseConfig

Union type for all database configurations:

```ts
type DatabaseConfig = SQLiteConfig | PostgreSQLConfig | MySQLConfig
```

#### SQLiteConfig

```ts
interface SQLiteConfig {
  type: BackupType.SQLITE
  name: string
  path: string
  verbose?: boolean
  compress?: boolean
  filename?: string
}
```

#### PostgreSQLConfig

```ts
interface PostgreSQLConfig {
  type: BackupType.POSTGRESQL
  name: string
  connection: string | PostgreSQLConnection
  tables?: string[]
  excludeTables?: string[]
  includeSchema?: boolean
  includeData?: boolean
  verbose?: boolean
  compress?: boolean
  filename?: string
}

interface PostgreSQLConnection {
  hostname?: string
  port?: number
  database: string
  username?: string
  password?: string
  ssl?: boolean
}
```

#### MySQLConfig

```ts
interface MySQLConfig {
  type: BackupType.MYSQL
  name: string
  connection: string | MySQLConnection
  tables?: string[]
  excludeTables?: string[]
  includeSchema?: boolean
  includeData?: boolean
  verbose?: boolean
  compress?: boolean
  filename?: string
}

interface MySQLConnection {
  hostname?: string
  port?: number
  database: string
  username?: string
  password?: string
  ssl?: boolean
}
```

### FileConfig

Configuration for file and directory backups:

```ts
interface FileConfig {
  name: string
  path: string
  verbose?: boolean
  compress?: boolean
  filename?: string
  preserveMetadata?: boolean
  include?: string[]
  exclude?: string[]
  followSymlinks?: boolean
  maxFileSize?: number
}
```

### RetentionConfig

Configuration for backup retention policies:

```ts
interface RetentionConfig {
  /** Number of backups to keep (keeps most recent) */
  count?: number

  /** Maximum age in days (deletes older backups) */
  maxAge?: number
}
```

## Result Types

### BackupSummary

Summary of all backup operations:

```ts
interface BackupSummary {
  totalCount: number
  successCount: number
  failureCount: number
  databaseBackups: BackupResult[]
  fileBackups: BackupResult[]
  duration: number
}
```

### BackupResult

Result of individual backup operation:

```ts
interface BackupResult {
  type: BackupType
  name: string
  filename: string
  size: number
  success: boolean
  error?: string
  fileCount?: number
}
```

## Enums

### BackupType

Enumeration of supported backup types:

```ts
enum BackupType {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  FILE = 'file',
  DIRECTORY = 'directory'
}
```

## Individual Backup Functions

### Database Functions

#### backupSQLite

```ts
async function backupSQLite(
  config: SQLiteConfig,
  outputPath: string
): Promise<BackupResult>
```

#### backupPostgreSQL

```ts
async function backupPostgreSQL(
  config: PostgreSQLConfig,
  outputPath: string
): Promise<BackupResult>
```

#### backupMySQL

```ts
async function backupMySQL(
  config: MySQLConfig,
  outputPath: string
): Promise<BackupResult>
```

### File Functions

#### backupFile

```ts
async function backupFile(
  config: FileConfig,
  outputPath: string
): Promise<BackupResult>
```

#### backupDirectory

```ts
async function backupDirectory(
  config: FileConfig,
  outputPath: string
): Promise<BackupResult>
```

## Utility Functions

### createBackup

Convenience function for one-off backups:

```ts
async function createBackup(config: BackupConfig): Promise<BackupSummary>
```

### loadConfig

Load configuration from file:

```ts
async function loadConfig(configPath?: string): Promise<BackupConfig>
```

### validateConfig

Validate configuration object:

```ts
function validateConfig(config: BackupConfig): string[]
```

## Error Handling

### BackupError

Custom error class for backup-related errors:

```ts
class BackupError extends Error {
  public readonly code: string
  public readonly details?: any

  constructor(message: string, code: string, details?: any) {
    super(message)
    this.code = code
    this.details = details
  }
}
```

### Error Codes

Common error codes returned by the library:

- `CONFIG_INVALID` - Configuration validation failed
- `DATABASE_CONNECTION_FAILED` - Cannot connect to database
- `FILE_NOT_FOUND` - Source file/directory not found
- `PERMISSION_DENIED` - Insufficient permissions
- `DISK_FULL` - Not enough disk space
- `COMPRESSION_FAILED` - Compression operation failed

## Constants

### Default Values

```ts
export const DEFAULT_OUTPUT_PATH = './backups'
export const DEFAULT_COMPRESSION = true
export const DEFAULT_INCLUDE_SCHEMA = true
export const DEFAULT_INCLUDE_DATA = true
export const DEFAULT_PRESERVE_METADATA = false
export const DEFAULT_FOLLOW_SYMLINKS = false
export const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
export const DEFAULT_RETENTION_COUNT = 10
export const DEFAULT_RETENTION_MAX_AGE = 30 // days
```

### File Extensions

```ts
export const BACKUP_EXTENSIONS = {
  SQL: '.sql',
  ARCHIVE: '.tar',
  COMPRESSED_ARCHIVE: '.tar.gz',
  COMPRESSED: '.gz',
  METADATA: '.meta'
}
```

## Type Guards

### isBackupResult

```ts
function isBackupResult(obj: any): obj is BackupResult {
  return obj
    && typeof obj.type === 'string'
    && typeof obj.name === 'string'
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

## CLI Integration

### CLI Command Type

```ts
interface CLICommand {
  command: string
  description: string
  options: CLIOption[]
  action: (args: any) => Promise<void>
}
```

### CLI Option Type

```ts
interface CLIOption {
  flags: string
  description: string
  defaultValue?: any
}
```

## Examples

### Basic Usage

```ts
import { BackupManager, BackupType } from 'ts-backups'

const config = {
  verbose: true,
  outputPath: './backups',
  databases: [
    {
      type: BackupType.SQLITE,
      name: 'app-db',
      path: './database.sqlite'
    }
  ],
  files: [
    {
      name: 'uploads',
      path: './uploads'
    }
  ]
}

const manager = new BackupManager(config)
const summary = await manager.createBackup()

console.log(`Backup completed: ${summary.successCount}/${summary.totalCount}`)
```

### Individual Function Usage

```ts
import { backupFile, backupSQLite } from 'ts-backups'

// Database backup
const dbResult = await backupSQLite({
  type: BackupType.SQLITE,
  name: 'my-db',
  path: './database.sqlite',
  compress: true
}, './backups')

// File backup
const fileResult = await backupFile({
  name: 'config',
  path: './config.json',
  preserveMetadata: true
}, './backups')
```

### Error Handling

```ts
import { BackupError, BackupErrorCode } from 'ts-backups'

try {
  await manager.createBackup()
}
catch (error) {
  if (error instanceof BackupError) {
    console.error(`Backup failed: ${error.code} - ${error.message}`)
    console.error('Details:', error.details)
  }
}
```

## Version History

### v1.0.0
- Initial release with SQLite, PostgreSQL, MySQL support
- File and directory backup capabilities
- Compression and retention policies
- CLI interface

## TypeScript Support

ts-backups is written in TypeScript and provides full type definitions. All interfaces and types are exported for use in your TypeScript projects.

```ts
// Import types for your own functions
import type {
  BackupConfig,
  BackupResult,
  BackupSummary,
  DatabaseConfig,
  FileConfig
} from 'ts-backups'

function processBackupResults(results: BackupResult[]): void {
  // TypeScript will provide full intellisense
  results.forEach((result) => {
    if (result.success) {
      console.log(`✅ ${result.name}: ${result.size} bytes`)
    }
    else {
      console.error(`❌ ${result.name}: ${result.error}`)
    }
  })
}
```
