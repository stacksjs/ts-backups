export interface BackupConfig {
  verbose: boolean
  databases: DatabaseConfig[]
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
  database: string
  type: 'sqlite' | 'postgresql' | 'mysql'
  filename: string
  size: number
  duration: number
  success: boolean
  error?: string
}

export interface BackupSummary {
  results: BackupResult[]
  totalDuration: number
  successCount: number
  failureCount: number
}
