# Constants API Reference

This page documents all constants, default values, and configuration presets available in backupx.

## Backup Type Constants

### BackupType

Enumeration of all supported backup types.

```ts
const BackupType = {
  SQLITE: 'SQLITE',
  POSTGRESQL: 'POSTGRESQL',
  MYSQL: 'MYSQL',
  FILE: 'FILE',
  DIRECTORY: 'DIRECTORY'
} as const
```

**Usage:**

```ts
import { BackupType } from 'backupx'

const config = {
  type: BackupType.POSTGRESQL,
  name: 'my-database',
  // ...
}
```

## Error Code Constants

### BackupErrorCode

Enumeration of all possible backup error codes.

```ts
const BackupErrorCode = {
  INVALID_CONFIG: 'INVALID_CONFIG',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  DISK_FULL: 'DISK_FULL',
  COMPRESSION_FAILED: 'COMPRESSION_FAILED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  QUERY_FAILED: 'QUERY_FAILED',
  SCHEMA_ERROR: 'SCHEMA_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const
```

## Default Configuration Values

### DEFAULT_CONFIG

Default backup configuration values.

```ts
const DEFAULT_CONFIG = {
  verbose: false,
  outputPath: './backups',
  compress: false,
  preserveMetadata: false,
  followSymlinks: false,
  maxFileSize: undefined, // No limit
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
} as const
```

### DEFAULT_RETENTION

Default retention policy values.

```ts
const DEFAULT_RETENTION = {
  count: 10, // Keep last 10 backups
  maxAge: 30, // Delete backups older than 30 days
} as const
```

### DEFAULT_COMPRESSION

Default compression settings.

```ts
const DEFAULT_COMPRESSION = {
  level: 6, // Gzip compression level (1-9)
  algorithm: 'gzip',
  chunkSize: 16 * 1024, // 16KB chunks
} as const
```

## Database Connection Defaults

### POSTGRESQL_DEFAULTS

Default PostgreSQL connection settings.

```ts
const POSTGRESQL_DEFAULTS = {
  port: 5432,
  ssl: false,
  includeSchema: true,
  includeData: true,
  connectionTimeout: 10000, // 10 seconds
  queryTimeout: 0, // No timeout for dumps
} as const
```

### MYSQL_DEFAULTS

Default MySQL connection settings.

```ts
const MYSQL_DEFAULTS = {
  port: 3306,
  ssl: false,
  includeSchema: true,
  includeData: true,
  connectionTimeout: 10000, // 10 seconds
  charset: 'utf8mb4',
} as const
```

### SQLITE_DEFAULTS

Default SQLite backup settings.

```ts
const SQLITE_DEFAULTS = {
  journalMode: 'WAL',
  busyTimeout: 5000, // 5 seconds
  checkpointBefore: true,
} as const
```

## File System Constants

### FILE_EXTENSIONS

Common file extensions for backup files.

```ts
const FILE_EXTENSIONS = {
  SQL: '.sql',
  SQLITE: '.sqlite',
  JSON: '.json',
  TAR: '.tar',
  GZIP: '.gz',
  COMPRESSED_SQL: '.sql.gz',
  COMPRESSED_TAR: '.tar.gz',
  METADATA: '.meta.json',
} as const
```

### COMMON_EXCLUDE_PATTERNS

Commonly excluded file patterns.

```ts
const COMMON_EXCLUDE_PATTERNS = {
  NODE_MODULES: ['**/node_modules/**'],
  VERSION_CONTROL: ['.git/**', '.svn/**', '.hg/**'],
  BUILD_OUTPUT: ['dist/**', 'build/**', 'out/**'],
  LOGS: ['**/*.log', 'logs/**'],
  TEMP_FILES: ['**/*.tmp', '**/*.temp', '**/tmp/**'],
  CACHE: ['**/.cache/**', '**/cache/**'],
  OS_FILES: ['.DS_Store', 'Thumbs.db', '*.swp'],
  IDE: ['.vscode/**', '.idea/**', '_.sublime-_'],

  // Combined patterns
  DEVELOPMENT: [
    '**/node_modules/**',
    '.git/**',
    'dist/**',
    'build/**',
    '**/*.log',
    '**/*.tmp',
    '.DS_Store',
    '.vscode/**'
  ],

  PRODUCTION: [
    '**/*.log',
    '**/tmp/**',
    '**/.cache/**',
    '.DS_Store'
  ]
} as const
```

### COMMON_INCLUDE_PATTERNS

Commonly included file patterns.

```ts
const COMMON_INCLUDE_PATTERNS = {
  SOURCE_CODE: [
    '**/*.ts',
    '**/*.js',
    '**/*.tsx',
    '**/*.jsx',
    '**/*.vue',
    '**/*.py',
    '**/*.java',
    '**/*.c',
    '**/*.cpp',
    '**/*.h',
    '**/*.cs',
    '**/*.php',
    '**/*.rb',
    '**/*.go',
    '**/*.rs'
  ],

  CONFIG_FILES: [
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
    '**/*.toml',
    '**/*.ini',
    '**/*.conf',
    '**/.*rc',
    '**/.env*'
  ],

  DOCUMENTATION: [
    '**/*.md',
    '**/*.txt',
    '**/*.rst',
    '**/*.adoc'
  ],

  WEB_ASSETS: [
    '**/*.html',
    '**/*.css',
    '**/*.scss',
    '**/*.sass',
    '**/*.less'
  ],

  IMAGES: [
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.png',
    '**/*.gif',
    '**/*.webp',
    '**/_.svg'
  ]
} as const
```

## Performance Constants

### MEMORY_LIMITS

Memory usage limits for different operations.

```ts
const MEMORY_LIMITS = {
  SMALL_FILE: 1024 _ 1024, // 1MB
  MEDIUM_FILE: 10 _ 1024 _ 1024, // 10MB
  LARGE_FILE: 100 _ 1024 _ 1024, // 100MB
  MAX_MEMORY_USAGE: 512 _ 1024 _ 1024, // 512MB
  CHUNK_SIZE: 64 _ 1024, // 64KB
} as const
```

### TIMEOUT_VALUES

Timeout values for different operations.

```ts
const TIMEOUT_VALUES = {
  DATABASE_CONNECTION: 10000, // 10 seconds
  DATABASE_QUERY: 300000, // 5 minutes
  FILE_OPERATION: 60000, // 1 minute
  COMPRESSION: 300000, // 5 minutes
  NETWORK_REQUEST: 30000, // 30 seconds
} as const
```

### RETRY_SETTINGS

Default retry configuration.

```ts
const RETRY_SETTINGS = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 1000, // 1 second
  MAX_DELAY: 30000, // 30 seconds
  BACKOFF_MULTIPLIER: 2,
  JITTER: true,
} as const
```

## Configuration Presets

### PRESET_CONFIGS

Pre-configured backup configurations for common scenarios.

```ts
const PRESET_CONFIGS = {
  MINIMAL: {
    verbose: false,
    compress: false,
    retention: { count: 5 }
  },

  DEVELOPMENT: {
    verbose: true,
    compress: true,
    retention: { count: 10, maxAge: 7 },
    exclude: COMMON_EXCLUDE_PATTERNS.DEVELOPMENT
  },

  PRODUCTION: {
    verbose: false,
    compress: true,
    retention: { count: 30, maxAge: 90 },
    exclude: COMMON_EXCLUDE_PATTERNS.PRODUCTION,
    preserveMetadata: true
  },

  HIGH_FREQUENCY: {
    verbose: false,
    compress: true,
    retention: { count: 100, maxAge: 7 }, // Keep many recent backups
    fastMode: true
  },

  ARCHIVE: {
    verbose: true,
    compress: true,
    retention: { count: 1000, maxAge: 365 }, // Long-term storage
    preserveMetadata: true,
    includeChecksums: true
  }
} as const
```

## Validation Constants

### VALIDATION_RULES

Configuration validation rules and limits.

```ts
const VALIDATION_RULES = {
  MIN_RETENTION_COUNT: 1,
  MAX_RETENTION_COUNT: 1000,
  MIN_RETENTION_DAYS: 1,
  MAX_RETENTION_DAYS: 3650, // 10 years

  MAX_FILE_SIZE: 1024 _ 1024 _ 1024 _ 100, // 100GB
  MAX_FILENAME_LENGTH: 255,
  MAX_PATH_LENGTH: 4096,

  VALID_COMPRESSION_LEVELS: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  VALID_CHARSETS: ['utf8', 'utf8mb4', 'latin1', 'ascii'],

  DATABASE_NAME_PATTERN: /^[\w-]+$/,
  FILENAME_PATTERN: /^[\w.-]+$/,
} as const
```

## Format Constants

### DATE_FORMATS

Date formatting patterns used in backup filenames.

```ts
const DATE_FORMATS = {
  FILENAME: 'YYYY-MM-DD_HH-mm-ss',
  ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  HUMAN: 'YYYY-MM-DD HH:mm:ss',
  DATE_ONLY: 'YYYY-MM-DD',
  TIME_ONLY: 'HH:mm:ss',
} as const
```

### SIZE_UNITS

Units for formatting file sizes.

```ts
const SIZE_UNITS = ['Bytes', 'KB', 'MB', 'GB', 'TB'] as const
```

### TIME_UNITS

Units for formatting durations.

```ts
const TIME_UNITS = {
  MILLISECOND: 1,
  SECOND: 1000,
  MINUTE: 60 _ 1000,
  HOUR: 60 _ 60 _ 1000,
  DAY: 24 _ 60 _ 60 _ 1000,
} as const
```

## Usage Examples

### Using Presets

```ts
import { COMMON_EXCLUDE_PATTERNS, PRESET_CONFIGS } from 'backupx'

const config = {
  ...PRESET_CONFIGS.PRODUCTION,
  databases: [
    // ...
  ],
  files: [{
    name: 'source',
    path: './src',
    exclude: COMMON_EXCLUDE_PATTERNS.DEVELOPMENT
  }]
}
```

### Using Default Values

```ts
import { DEFAULT_CONFIG, DEFAULT_RETENTION } from 'backupx'

const config = {
  verbose: true, // Override default
  ...DEFAULT_CONFIG,
  retention: DEFAULT_RETENTION
}
```

All constants are exported from the main package and provide sensible defaults for most use cases while allowing full customization when needed.

**Example usage:**

```ts
const config = createDefaultConfig()
const manager = new BackupManager(config)
```
