export interface BackupConfig {
  verbose: boolean
  databases: DatabaseConfig[]
  files: FileConfig[]
  outputPath?: string
  retention?: RetentionConfig
}

export interface RetentionConfig {
  /** Number of backups to keep */
  count?: number
  /** Age in days after which backups are deleted */
  maxAge?: number
}

export type DatabaseConfig = SQLiteConfig | PostgreSQLConfig | MySQLConfig

export interface BaseDbConfig {
  /** Unique identifier for this database backup */
  name: string
  /** Whether to enable verbose logging for this database */
  verbose?: boolean
  /** Whether to compress the backup */
  compress?: boolean
  /** Custom output filename (without extension) */
  filename?: string
}

export interface FileConfig {
  /** Unique identifier for this file backup */
  name: string
  /** Path to the file or directory to backup */
  path: string
  /** Whether to enable verbose logging for this file backup */
  verbose?: boolean
  /** Whether to compress the backup */
  compress?: boolean
  /** Custom output filename (without extension) */
  filename?: string
  /** Whether to preserve file permissions and timestamps */
  preserveMetadata?: boolean

  // Directory-specific options (ignored if path is a file)
  /** Glob patterns to include (if not specified, all files are included) */
  include?: string[]
  /** Glob patterns to exclude */
  exclude?: string[]
  /** Whether to follow symbolic links */
  followSymlinks?: boolean
  /** Maximum file size to include (in bytes) */
  maxFileSize?: number
}

export interface SQLiteConfig extends BaseDbConfig {
  type: 'sqlite'
  /** Path to the SQLite database file */
  path: string
}

export interface PostgreSQLConfig extends BaseDbConfig {
  type: 'postgresql'
  /** Connection URL or individual connection parameters */
  connection: string | {
    hostname?: string
    port?: number
    database: string
    username?: string
    password?: string
    ssl?: boolean | 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full'
  }
  /** Tables to include in backup (if not specified, all tables are backed up) */
  tables?: string[]
  /** Tables to exclude from backup */
  excludeTables?: string[]
  /** Whether to include schema in backup */
  includeSchema?: boolean
  /** Whether to include data in backup */
  includeData?: boolean
}

export interface MySQLConfig extends BaseDbConfig {
  type: 'mysql'
  /** Connection URL or individual connection parameters */
  connection: string | {
    hostname?: string
    port?: number
    database: string
    username?: string
    password?: string
    ssl?: boolean
  }
  /** Tables to include in backup (if not specified, all tables are backed up) */
  tables?: string[]
  /** Tables to exclude from backup */
  excludeTables?: string[]
  /** Whether to include schema in backup */
  includeSchema?: boolean
  /** Whether to include data in backup */
  includeData?: boolean
}

export interface BackupResult {
  name: string
  type: 'sqlite' | 'postgresql' | 'mysql' | 'directory' | 'file'
  filename: string
  size: number
  duration: number
  success: boolean
  error?: string
  /** Number of files included (for file backups) */
  fileCount?: number
}

export interface BackupSummary {
  results: BackupResult[]
  totalDuration: number
  successCount: number
  failureCount: number
  /** Breakdown by backup type */
  databaseBackups: BackupResult[]
  fileBackups: BackupResult[]
}
