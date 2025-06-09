# Classes API Reference

This page documents all the main classes available in backupx.

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
import { BackupManager } from 'backupx'

const manager = new BackupManager({
  verbose: true,
  databases: [
    // ...
  ],
  files: [
    // ...
  ],
  outputPath: './backups',
})
```

### Methods

#### createBackup()

Executes all configured backups and returns a summary.

```ts
interface BackupManager {
  createBackup: () => Promise<BackupSummary>
}
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
interface BackupManager {
  validateConfig: () => ValidationResult
}
```

**Returns:** `ValidationResult` - Configuration validation results

#### getBackupHistory()

Retrieves history of previous backups.

```ts
interface BackupManager {
  getBackupHistory: (limit?: number) => Promise<BackupResult[]>
}
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
  ) {
    super(message)
  }
}
```

**Parameters:**
- `code` - Error code from BackupErrorCode enum
- `message` - Human-readable error message
- `details` - Additional error context (optional)

### Properties

#### code

```ts
interface BackupError {
  readonly code: BackupErrorCode
}
```

The specific error code indicating the type of failure.

#### details

```ts
interface BackupError {
  readonly details: Record<string, any>
}
```

Additional context about the error.

#### recoverable

```ts
interface BackupError {
  readonly recoverable: boolean
}
```

Whether the error represents a recoverable condition.

### Methods

#### toJSON()

Serializes the error to a JSON object.

```ts
interface BackupError {
  toJSON: () => Record<string, any>
}
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
interface RetentionManager {
  cleanup: () => Promise<CleanupResult>
}
```

**Returns:** `Promise<CleanupResult>` - Summary of cleanup operation

#### getFilesToDelete()

Returns files that would be deleted without actually deleting them.

```ts
interface RetentionManager {
  getFilesToDelete: () => Promise<string[]>
}
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
import { Buffer } from 'node:buffer'

abstract class CompressionProvider {
  abstract compress(data: Buffer | string): Promise<Buffer>
}
```

**Parameters:**
- `data` - Data to compress

**Returns:** `Promise<Buffer>` - Compressed data

#### decompress()

Decompresses the input data.

```ts
import { Buffer } from 'node:buffer'

abstract class CompressionProvider {
  abstract decompress(data: Buffer): Promise<Buffer>
}
```

**Parameters:**
- `data` - Compressed data to decompress

**Returns:** `Promise<Buffer>` - Decompressed data

#### getExtension()

Returns the file extension for this compression type.

```ts
abstract class CompressionProvider {
  abstract getExtension(): string
}
```

**Returns:** `string` - File extension (e.g., '.gz')

### GzipCompressionProvider

Built-in gzip compression implementation.

```ts
class GzipCompressionProvider extends CompressionProvider {
  constructor(options?: zlib.ZlibOptions) {
    super()
  }
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
abstract class DatabaseProvider {
  abstract backup(
    config: DatabaseConfig,
    outputPath: string
  ): Promise<BackupResult>
}
```

**Parameters:**
- `config` - Database-specific configuration
- `outputPath` - Directory to save backup files

**Returns:** `Promise<BackupResult>` - Backup operation result

### SQLiteProvider

Built-in SQLite backup implementation.

```ts
class SQLiteProvider extends DatabaseProvider {
  async backup(config: SQLiteConfig, outputPath: string): Promise<BackupResult> {
    // Implementation
  }
}
```

### PostgreSQLProvider

Built-in PostgreSQL backup implementation.

```ts
class PostgreSQLProvider extends DatabaseProvider {
  async backup(config: PostgreSQLConfig, outputPath: string): Promise<BackupResult> {
    // Implementation
  }
}
```

### MySQLProvider

Built-in MySQL backup implementation.

```ts
class MySQLProvider extends DatabaseProvider {
  async backup(config: MySQLConfig, outputPath: string): Promise<BackupResult> {
    // Implementation
  }
}
```

## FileProvider

Handles file and directory backup operations.

### Methods

#### backupFile()

Backs up a single file.

```ts
class FileProvider {
  async backupFile(config: FileConfig, outputPath: string): Promise<BackupResult> {
    // Implementation
  }
}
```

#### backupDirectory()

Backs up a directory and its contents.

```ts
class FileProvider {
  async backupDirectory(config: FileConfig, outputPath: string): Promise<BackupResult> {
    // Implementation
  }
}
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
class ConfigValidator {
  validate(config: BackupConfig): ValidationResult {
    // Implementation
  }
}
```

#### validateDatabase()

Validates a database configuration.

```ts
class ConfigValidator {
  validateDatabase(config: DatabaseConfig): ValidationResult {
    // Implementation
  }
}
```

#### validateFile()

Validates a file configuration.

```ts
class ConfigValidator {
  validateFile(config: FileConfig): ValidationResult {
    // Implementation
  }
}
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
class MetadataManager {
  async saveMetadata(summary: BackupSummary): Promise<void> {
    // Implementation
  }
}
```

#### loadMetadata()

Loads metadata for previous backups.

```ts
class MetadataManager {
  async loadMetadata(limit?: number): Promise<BackupSummary[]> {
    // Implementation
  }
}
```

#### getBackupInfo()

Gets information about a specific backup file.

```ts
class MetadataManager {
  async getBackupInfo(filename: string): Promise<BackupMetadata | null> {
    // Implementation
  }
}
```

**Example:**
```ts
const metadataManager = new MetadataManager('./backups')
await metadataManager.saveMetadata(summary)

const history = await metadataManager.loadMetadata(10)
console.log(`Found ${history.length} previous backups`)
```

All classes follow TypeScript best practices and provide comprehensive error handling and logging capabilities.
