# Advanced Configuration

Backupx offers extensive configuration options for customizing backup behavior, output formats, and scheduling. This guide covers advanced configuration patterns and best practices.

## Configuration File Structure

Create a `backups.config.ts` file in your project root:

```ts
import type { BackupConfig } from 'backupx'

const config: BackupConfig = {
  // Global settings
  verbose: true,
  outputPath: './backups',

  // Database configurations
  databases: [
    {
      type: 'sqlite',
      name: 'app-database',
      path: './data/app.sqlite',
      compress: true,
    },
    {
      type: 'postgresql',
      name: 'user-data',
      connection: process.env.DATABASE_URL,
      includeSchema: true,
      includeData: true,
    },
  ],

  // File backup configurations
  files: [
    {
      name: 'uploads',
      path: './public/uploads',
      compress: true,
      include: ['*.jpg', '*.png', '*.pdf'],
      exclude: ['temp/*'],
    },
  ],

  // Retention policy
  retention: {
    count: 10,
    maxAge: 90,
  },
}

export default config
```

## Environment-Based Configuration

Create different configurations for different environments:

```ts
// backups.config.ts
import type { BackupConfig } from 'backupx'

const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

const baseConfig: Partial<BackupConfig> = {
  verbose: isDev,
  outputPath: './backups',
}

const devDatabases = [
  {
    type: 'sqlite' as const,
    name: 'dev-db',
    path: './dev.sqlite',
    compress: false,
  },
]

const prodDatabases = [
  {
    type: 'postgresql' as const,
    name: 'production-db',
    connection: process.env.DATABASE_URL!,
    includeSchema: true,
    includeData: true,
    compress: true,
    excludeTables: ['sessions', 'cache', 'logs'],
  },
]

const config: BackupConfig = {
  ...baseConfig,
  databases: isProd ? prodDatabases : devDatabases,
  retention: {
    count: isProd ? 30 : 5,
    maxAge: isProd ? 90 : 7,
  },
}

export default config
```

## Dynamic Configuration

Generate configuration based on runtime conditions:

```ts
import type { BackupConfig, DatabaseBackupConfig } from 'backupx'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

async function discoverDatabases(baseDir: string): Promise<DatabaseBackupConfig[]> {
  const databases: DatabaseBackupConfig[] = []
  const files = await readdir(baseDir)

  for (const file of files) {
    const filePath = join(baseDir, file)
    const fileStat = await stat(filePath)

    if (fileStat.isFile() && file.endsWith('.sqlite')) {
      databases.push({
        type: 'sqlite',
        name: file.replace('.sqlite', ''),
        path: filePath,
        compress: true,
      })
    }
  }

  return databases
}

async function createDynamicConfig(): Promise<BackupConfig> {
  const databases = await discoverDatabases('./databases')

  return {
    verbose: true,
    outputPath: './backups',
    databases,
    retention: {
      count: 10,
    },
  }
}

// Usage
const config = await createDynamicConfig()
```

## Configuration Validation

Validate configuration before running backups:

```ts
import type { BackupConfig } from 'backupx'
import { existsSync } from 'node:fs'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function validateConfig(config: BackupConfig): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate output path
  if (!config.outputPath) {
    errors.push('outputPath is required')
  }

  // Validate database configurations
  for (const db of config.databases || []) {
    if (!db.name) {
      errors.push('Database name is required')
    }

    if (db.type === 'sqlite' && !existsSync(db.path)) {
      warnings.push(`SQLite database not found: ${db.path}`)
    }

    if (db.type === 'postgresql' && !db.connection) {
      errors.push(`PostgreSQL connection is required for ${db.name}`)
    }
  }

  // Validate file configurations
  for (const file of config.files || []) {
    if (!file.name) {
      errors.push('File backup name is required')
    }

    if (!existsSync(file.path)) {
      warnings.push(`Path not found: ${file.path}`)
    }
  }

  // Validate retention
  if (config.retention) {
    if (config.retention.count && config.retention.count < 1) {
      errors.push('Retention count must be at least 1')
    }
    if (config.retention.maxAge && config.retention.maxAge < 1) {
      errors.push('Retention maxAge must be at least 1 day')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

// Usage
const validation = validateConfig(config)
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors)
  process.exit(1)
}
if (validation.warnings.length > 0) {
  console.warn('Configuration warnings:', validation.warnings)
}
```

## Configuration Presets

Define reusable configuration presets:

```ts
// config/presets.ts
import type { BackupConfig } from 'backupx'

export const presets = {
  // Minimal backup for development
  development: {
    verbose: true,
    outputPath: './backups/dev',
    retention: { count: 3 },
  } satisfies Partial<BackupConfig>,

  // Production backup with retention
  production: {
    verbose: false,
    outputPath: './backups/prod',
    retention: {
      count: 30,
      maxAge: 90,
    },
  } satisfies Partial<BackupConfig>,

  // Quick backup without compression
  quick: {
    verbose: false,
    outputPath: './backups/quick',
    retention: { count: 1 },
  } satisfies Partial<BackupConfig>,

  // Full backup with maximum retention
  archive: {
    verbose: true,
    outputPath: './backups/archive',
    retention: {
      count: 365,
      maxAge: 365,
    },
  } satisfies Partial<BackupConfig>,
}

// Usage
import { presets } from './config/presets'

const config: BackupConfig = {
  ...presets.production,
  databases: [
    // Your database configurations
  ],
}
```

## Configuration Merging

Merge multiple configuration sources:

```ts
import type { BackupConfig } from 'backupx'

function mergeConfigs(...configs: Partial<BackupConfig>[]): BackupConfig {
  return configs.reduce((merged, config) => ({
    ...merged,
    ...config,
    // Merge arrays
    databases: [...(merged.databases || []), ...(config.databases || [])],
    files: [...(merged.files || []), ...(config.files || [])],
    // Deep merge retention
    retention: {
      ...merged.retention,
      ...config.retention,
    },
  }), {} as BackupConfig)
}

// Usage
const baseConfig: Partial<BackupConfig> = {
  verbose: true,
  outputPath: './backups',
}

const dbConfig: Partial<BackupConfig> = {
  databases: [
    { type: 'sqlite', name: 'app', path: './app.sqlite' },
  ],
}

const retentionConfig: Partial<BackupConfig> = {
  retention: { count: 10, maxAge: 30 },
}

const finalConfig = mergeConfigs(baseConfig, dbConfig, retentionConfig)
```

## Configuration Types Reference

Complete TypeScript types for configuration:

```ts
interface BackupConfig {
  // Enable verbose logging
  verbose?: boolean

  // Base output directory for all backups
  outputPath: string

  // Database backup configurations
  databases?: DatabaseBackupConfig[]

  // File/directory backup configurations
  files?: FileBackupConfig[]

  // Backup retention policy
  retention?: RetentionConfig
}

interface DatabaseBackupConfig {
  // Database type
  type: 'sqlite' | 'postgresql' | 'mysql'

  // Unique name for this backup
  name: string

  // SQLite: path to database file
  path?: string

  // PostgreSQL/MySQL: connection string or object
  connection?: string | ConnectionConfig

  // Include schema in backup
  includeSchema?: boolean

  // Include data in backup
  includeData?: boolean

  // Specific tables to include
  tables?: string[]

  // Tables to exclude
  excludeTables?: string[]

  // Enable gzip compression
  compress?: boolean

  // Custom output filename (without extension)
  filename?: string
}

interface ConnectionConfig {
  hostname: string
  port?: number
  database: string
  username: string
  password: string
  ssl?: boolean
}

interface FileBackupConfig {
  // Unique name for this backup
  name: string

  // Path to file or directory
  path: string

  // Enable gzip compression
  compress?: boolean

  // Glob patterns to include (directories only)
  include?: string[]

  // Glob patterns to exclude
  exclude?: string[]

  // Maximum file size to backup (bytes)
  maxFileSize?: number

  // Preserve file metadata
  preserveMetadata?: boolean

  // Follow symbolic links
  followSymlinks?: boolean

  // Custom output filename
  filename?: string
}

interface RetentionConfig {
  // Maximum number of backups to keep
  count?: number

  // Maximum age in days
  maxAge?: number
}
```

## Loading Configuration

Load configuration from various sources:

```ts
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

async function loadConfig(): Promise<BackupConfig> {
  const configPaths = [
    'backups.config.ts',
    'backups.config.js',
    'backups.config.mjs',
    '.backupsrc.json',
  ]

  for (const configPath of configPaths) {
    const fullPath = resolve(process.cwd(), configPath)

    if (existsSync(fullPath)) {
      if (configPath.endsWith('.json')) {
        return await Bun.file(fullPath).json()
      }
      else {
        const module = await import(fullPath)
        return module.default || module.config || module
      }
    }
  }

  throw new Error('No configuration file found')
}
```

## Best Practices

1. **Use Environment Variables**: Store sensitive information like database passwords in environment variables
2. **Validate Configuration**: Always validate configuration before running backups
3. **Use Type Safety**: Leverage TypeScript types for configuration validation
4. **Create Presets**: Define reusable presets for common backup scenarios
5. **Document Configuration**: Comment your configuration for team members
6. **Version Control**: Keep configuration files in version control (exclude sensitive data)
7. **Test Configuration**: Test configuration changes in development before production
8. **Use Dynamic Configuration**: Generate configuration based on discovered resources when appropriate
