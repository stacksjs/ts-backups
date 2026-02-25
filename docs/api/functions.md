# Functions API Reference

This page documents all standalone functions available in backupx.

## Database Backup Functions

### backupSQLite()

Creates a backup of an SQLite database.

```ts
async function backupSQLite(
  config: SQLiteConfig,
  outputPath: string
): Promise<BackupResult>
```

**Parameters:**

- `config` - SQLite backup configuration
- `outputPath` - Directory to save the backup file

**Returns:** `Promise<BackupResult>` - Result of the backup operation

**Example:**

```ts
import { backupSQLite, BackupType } from 'backupx'

const result = await backupSQLite({
  type: BackupType.SQLITE,
  name: 'app-database',
  path: './database.sqlite',
  compress: true
}, './backups')

console.log(`Backup created: ${result.filename}`)
```

### backupPostgreSQL()

Creates a backup of a PostgreSQL database using pg_dump.

```ts
async function backupPostgreSQL(
  config: PostgreSQLConfig,
  outputPath: string
): Promise<BackupResult>
```

**Parameters:**

- `config` - PostgreSQL backup configuration
- `outputPath` - Directory to save the backup file

**Returns:** `Promise<BackupResult>` - Result of the backup operation

**Example:**

```ts
import { backupPostgreSQL, BackupType } from 'backupx'

const result = await backupPostgreSQL({
  type: BackupType.POSTGRESQL,
  name: 'main-db',
  connection: 'postgres://user:pass@localhost:5432/myapp',
  includeSchema: true,
  includeData: true
}, './backups')
```

### backupMySQL()

Creates a backup of a MySQL database using mysqldump.

```ts
async function backupMySQL(
  config: MySQLConfig,
  outputPath: string
): Promise<BackupResult>
```

**Parameters:**

- `config` - MySQL backup configuration
- `outputPath` - Directory to save the backup file

**Returns:** `Promise<BackupResult>` - Result of the backup operation

**Example:**

```ts
import { backupMySQL, BackupType } from 'backupx'

const result = await backupMySQL({
  type: BackupType.MYSQL,
  name: 'legacy-db',
  connection: {
    hostname: 'localhost',
    port: 3306,
    database: 'legacy_app',
    username: 'user',
    password: 'password'
  }
}, './backups')
```

## File Backup Functions

### backupFile()

Creates a backup of a single file.

```ts
async function backupFile(
  config: FileConfig,
  outputPath: string
): Promise<BackupResult>
```

**Parameters:**

- `config` - File backup configuration
- `outputPath` - Directory to save the backup file

**Returns:** `Promise<BackupResult>` - Result of the backup operation

**Example:**

```ts
import { backupFile } from 'backupx'

const result = await backupFile({
  name: 'config-backup',
  path: './config.json',
  compress: true,
  preserveMetadata: true
}, './backups')
```

### backupDirectory()

Creates a backup of a directory and its contents.

```ts
async function backupDirectory(
  config: FileConfig,
  outputPath: string
): Promise<BackupResult>
```

**Parameters:**

- `config` - Directory backup configuration
- `outputPath` - Directory to save the backup archive

**Returns:** `Promise<BackupResult>` - Result of the backup operation

**Example:**

```ts
import { backupDirectory } from 'backupx'

const result = await backupDirectory({
  name: 'source-code',
  path: './src',
  include: ['**/*.ts', '**/*.js'],
  exclude: ['**/*.test.ts', '**/node_modules/**'],
  compress: true
}, './backups')

console.log(`Backed up ${result.fileCount} files`)
```

## Utility Functions

### validateConfig()

Validates a backup configuration object.

```ts
function validateConfig(config: BackupConfig): ValidationResult
```

**Parameters:**

- `config` - Backup configuration to validate

**Returns:** `ValidationResult` - Validation results with errors and warnings

**Example:**

```ts
import { validateConfig } from 'backupx'

const validation = validateConfig({
  verbose: true,
  databases: [],
  files: [],
  outputPath: './backups'
})

if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors)
}
```

### formatBytes()

Formats a byte count as a human-readable string.

```ts
function formatBytes(bytes: number): string
```

**Parameters:**

- `bytes` - Number of bytes to format

**Returns:** `string` - Formatted string (e.g., "1.5 MB")

**Example:**

```ts
import { formatBytes } from 'backupx'

console.log(formatBytes(1536000)) // "1.46 MB"
console.log(formatBytes(1024)) // "1.00 KB"
console.log(formatBytes(500)) // "500 Bytes"
```

### formatDuration()

Formats a duration in milliseconds as a human-readable string.

```ts
function formatDuration(milliseconds: number): string
```

**Parameters:**

- `milliseconds` - Duration in milliseconds

**Returns:** `string` - Formatted duration string

**Example:**

```ts
import { formatDuration } from 'backupx'

console.log(formatDuration(1500)) // "1.5s"
console.log(formatDuration(65000)) // "1m 5s"
console.log(formatDuration(3661000)) // "1h 1m 1s"
```

### getBackupHistory()

Retrieves history of previous backup operations from metadata.

```ts
async function getBackupHistory(
  outputPath: string,
  limit?: number
): Promise<BackupSummary[]>
```

**Parameters:**

- `outputPath` - Directory containing backup files and metadata
- `limit` - Maximum number of results to return (optional, defaults to 10)

**Returns:** `Promise<BackupSummary[]>` - Array of previous backup summaries

**Example:**

```ts
import { getBackupHistory } from 'backupx'

const history = await getBackupHistory('./backups', 5)
history.forEach((summary) => {
  console.log(`${summary.startTime}: ${summary.successCount}/${summary.results.length} successful`)
})
```

### cleanupOldBackups()

Removes old backup files based on retention policy.

```ts
async function cleanupOldBackups(
  outputPath: string,
  retention: RetentionConfig
): Promise<CleanupResult>
```

**Parameters:**

- `outputPath` - Directory containing backup files
- `retention` - Retention policy configuration

**Returns:** `Promise<CleanupResult>` - Summary of cleanup operation

**Example:**

```ts
import { cleanupOldBackups } from 'backupx'

const result = await cleanupOldBackups('./backups', {
  count: 10, // Keep last 10 backups
  maxAge: 30 // Delete backups older than 30 days
})

console.log(`Deleted ${result.deletedCount} old backups`)
console.log(`Freed ${formatBytes(result.freedSpace)} of disk space`)
```

## File System Utilities

### ensureDir()

Ensures a directory exists, creating it if necessary.

```ts
async function ensureDir(dirPath: string): Promise<void>
```

**Parameters:**

- `dirPath` - Directory path to ensure exists

**Returns:** `Promise<void>`

**Example:**

```ts
import { ensureDir } from 'backupx'

await ensureDir('./backups/2023/12')
// Directory will be created if it doesn't exist
```

### getFileSize()

Gets the size of a file in bytes.

```ts
async function getFileSize(filePath: string): Promise<number>
```

**Parameters:**

- `filePath` - Path to the file

**Returns:** `Promise<number>` - File size in bytes

**Example:**

```ts
import { getFileSize } from 'backupx'

const size = await getFileSize('./backup.sql')
console.log(`File size: ${formatBytes(size)}`)
```

### calculateChecksum()

Calculates MD5 checksum of a file for integrity verification.

```ts
async function calculateChecksum(filePath: string): Promise<string>
```

**Parameters:**

- `filePath` - Path to the file

**Returns:** `Promise<string>` - MD5 checksum as hex string

**Example:**

```ts
import { calculateChecksum } from 'backupx'

const checksum = await calculateChecksum('./backup.sql')
console.log(`Checksum: ${checksum}`)
```

## Compression Utilities

### compressFile()

Compresses a file using gzip compression.

```ts
async function compressFile(
  inputPath: string,
  outputPath: string
): Promise<void>
```

**Parameters:**

- `inputPath` - Path to file to compress
- `outputPath` - Path for compressed output file

**Returns:** `Promise<void>`

**Example:**

```ts
import { compressFile } from 'backupx'

await compressFile('./backup.sql', './backup.sql.gz')
```

### decompressFile()

Decompresses a gzip-compressed file.

```ts
async function decompressFile(
  inputPath: string,
  outputPath: string
): Promise<void>
```

**Parameters:**

- `inputPath` - Path to compressed file
- `outputPath` - Path for decompressed output file

**Returns:** `Promise<void>`

**Example:**

```ts
import { decompressFile } from 'backupx'

await decompressFile('./backup.sql.gz', './backup.sql')
```

## Database Utilities

### testDatabaseConnection()

Tests connectivity to a database.

```ts
async function testDatabaseConnection(
  config: DatabaseConfig
): Promise<boolean>
```

**Parameters:**

- `config` - Database configuration to test

**Returns:** `Promise<boolean>` - True if connection successful

**Example:**

```ts
import { BackupType, testDatabaseConnection } from 'backupx'

const canConnect = await testDatabaseConnection({
  type: BackupType.POSTGRESQL,
  name: 'test',
  connection: 'postgres://user:pass@localhost:5432/mydb'
})

if (!canConnect) {
  console.error('Cannot connect to database')
}
```

### getDatabaseSize()

Gets the size of a database.

```ts
async function getDatabaseSize(
  config: DatabaseConfig
): Promise<number>
```

**Parameters:**

- `config` - Database configuration

**Returns:** `Promise<number>` - Database size in bytes

**Example:**

```ts
import { getDatabaseSize } from 'backupx'

const size = await getDatabaseSize(dbConfig)
console.log(`Database size: ${formatBytes(size)}`)
```

All functions include comprehensive error handling and are designed to work seamlessly with the BackupManager class or as standalone utilities.
