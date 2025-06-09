# Classes API Reference

This page documents all the main classes available in ts-backups.

## BackupManager

The main class for orchestrating backup operations.

### Constructor

```ts
class BackupManager {
  constructor(config: BackupConfig)
}
```

**Parameters:**
- `config` - The backup configuration object

**Example:**
```ts
import { BackupManager } from 'ts-backups'

const manager = new BackupManager({
  verbose: true,
  databases: [...],
  files: [...],
  outputPath: './backups',
})
```

### Methods

#### createBackup()

Executes all configured backups and returns a summary.

```ts
async createBackup(): Promise<BackupSummary>
```

**Returns:** `Promise<BackupSummary>` - Summary of all backup operations

**Example:**
```ts
const summary = await manager.createBackup()
console.log(`Completed: ${summary.successCount}/${summary.results.length}`)
```

#### validateConfig()

Validates the backup configuration.

```ts
validateConfig(): ValidationResult
```

**Returns:** `ValidationResult` - Configuration validation results

#### getBackupHistory()

Retrieves history of previous backups.

```ts
async getBackupHistory(limit?: number): Promise<BackupResult[]>
```

**Parameters:**
- `limit` - Maximum number of results to return (default: 10)

**Returns:** `Promise<BackupResult[]>` - Array of previous backup results

## BackupError

Custom error class for backup-related errors.

### Constructor

```ts
class BackupError extends Error {
  constructor(
    code: BackupErrorCode,
    message: string,
    details?: Record<string, any>
  )
}
```

**Parameters:**
- `code` - Error code from BackupErrorCode enum
- `message` - Human-readable error message
- `details` - Additional error context (optional)

### Properties

#### code

```ts
readonly code: BackupErrorCode
```

The specific error code indicating the type of failure.

#### details

```ts
readonly details: Record<string, any>
```

Additional context about the error.

#### recoverable

```ts
readonly recoverable: boolean
```

Whether the error represents a recoverable condition.

### Methods

#### toJSON()

Serializes the error to a JSON object.

```ts
toJSON(): Record<string, any>
```

**Example:**
```ts
try {
  await manager.createBackup()
}
catch (error) {
  if (error instanceof BackupError) {
    console.error('Backup failed:', error.toJSON())
  }
}
```

## RetentionManager

Manages cleanup of old backup files based on retention policies.

### Constructor

```ts
class RetentionManager {
  constructor(config: RetentionConfig, outputPath: string)
}
```

**Parameters:**
- `config` - Retention policy configuration
- `outputPath` - Directory containing backup files

### Methods

#### cleanup()

Removes old backup files according to the retention policy.

```ts
async cleanup(): Promise<CleanupResult>
```

**Returns:** `Promise<CleanupResult>` - Summary of cleanup operation

#### getFilesToDelete()

Returns files that would be deleted without actually deleting them.

```ts
async getFilesToDelete(): Promise<string[]>
```

**Returns:** `Promise<string[]>` - Array of file paths to be deleted

**Example:**
```ts
const retentionManager = new RetentionManager(
  { count: 5, maxAge: 30 },
  './backups'
)

const result = await retentionManager.cleanup()
console.log(`Deleted ${result.deletedCount} old backups`)
```

## CompressionProvider

Abstract base class for compression implementations.

### Methods

#### compress()

Compresses the input data.

```ts
abstract async compress(data: Buffer | string): Promise<Buffer>
```

**Parameters:**
- `data` - Data to compress

**Returns:** `Promise<Buffer>` - Compressed data

#### decompress()

Decompresses the input data.

```ts
abstract async decompress(data: Buffer): Promise<Buffer>
```

**Parameters:**
- `data` - Compressed data to decompress

**Returns:** `Promise<Buffer>` - Decompressed data

#### getExtension()

Returns the file extension for this compression type.

```ts
abstract getExtension(): string
```

**Returns:** `string` - File extension (e.g., '.gz')

### GzipCompressionProvider

Built-in gzip compression implementation.

```ts
class GzipCompressionProvider extends CompressionProvider {
  constructor(options?: zlib.ZlibOptions)
}
```

**Example:**
```ts
const compressor = new GzipCompressionProvider({ level: 6 })
const compressed = await compressor.compress(data)
```

## DatabaseProvider

Abstract base class for database backup implementations.

### Methods

#### backup()

Performs the database backup operation.

```ts
abstract async backup(
  config: DatabaseConfig,
  outputPath: string
): Promise<BackupResult>
```

**Parameters:**
- `config` - Database-specific configuration
- `outputPath` - Directory to save backup files

**Returns:** `Promise<BackupResult>` - Backup operation result

### SQLiteProvider

Built-in SQLite backup implementation.

```ts
class SQLiteProvider extends DatabaseProvider {
  async backup(config: SQLiteConfig, outputPath: string): Promise<BackupResult>
}
```

### PostgreSQLProvider

Built-in PostgreSQL backup implementation.

```ts
class PostgreSQLProvider extends DatabaseProvider {
  async backup(config: PostgreSQLConfig, outputPath: string): Promise<BackupResult>
}
```

### MySQLProvider

Built-in MySQL backup implementation.

```ts
class MySQLProvider extends DatabaseProvider {
  async backup(config: MySQLConfig, outputPath: string): Promise<BackupResult>
}
```

## FileProvider

Handles file and directory backup operations.

### Methods

#### backupFile()

Backs up a single file.

```ts
async backupFile(config: FileConfig, outputPath: string): Promise<BackupResult>
```

#### backupDirectory()

Backs up a directory and its contents.

```ts
async backupDirectory(config: FileConfig, outputPath: string): Promise<BackupResult>
```

**Example:**
```ts
const fileProvider = new FileProvider()
const result = await fileProvider.backupFile({
  name: 'config-file',
  path: './config.json',
  compress: true
}, './backups')
```

## ConfigValidator

Validates backup configurations.

### Methods

#### validate()

Validates a complete backup configuration.

```ts
validate(config: BackupConfig): ValidationResult
```

#### validateDatabase()

Validates a database configuration.

```ts
validateDatabase(config: DatabaseConfig): ValidationResult
```

#### validateFile()

Validates a file configuration.

```ts
validateFile(config: FileConfig): ValidationResult
```

**Example:**
```ts
const validator = new ConfigValidator()
const result = validator.validate(backupConfig)

if (!result.isValid) {
  console.error('Configuration errors:', result.errors)
}
```

## MetadataManager

Manages backup metadata and history.

### Methods

#### saveMetadata()

Saves metadata for a backup operation.

```ts
async saveMetadata(summary: BackupSummary): Promise<void>
```

#### loadMetadata()

Loads metadata for previous backups.

```ts
async loadMetadata(limit?: number): Promise<BackupSummary[]>
```

#### getBackupInfo()

Gets information about a specific backup file.

```ts
async getBackupInfo(filename: string): Promise<BackupMetadata | null>
```

**Example:**
```ts
const metadataManager = new MetadataManager('./backups')
await metadataManager.saveMetadata(summary)

const history = await metadataManager.loadMetadata(10)
console.log(`Found ${history.length} previous backups`)
```

All classes follow TypeScript best practices and provide comprehensive error handling and logging capabilities.
