export enum BackupType {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  DIRECTORY = 'directory',
  FILE = 'file',
}

export interface BackupConfig {
  verbose: boolean
  databases: DatabaseConfig[]
  files: FileConfig[]
  outputPath?: string
  retention?: RetentionConfig
  /** Off-machine destinations every produced backup is uploaded to. */
  destinations?: BackupDestination[]
}

export interface RetentionConfig {
  /** Number of backups to keep */
  count?: number
  /** Age in days after which backups are deleted */
  maxAge?: number
}

export type BackupDestination = S3Destination

export interface S3Destination {
  type: 's3'
  /** Target bucket. */
  bucket: string
  /** Key prefix within the bucket (e.g. "mail/"). */
  prefix?: string
  /** AWS region (falls back to AWS_REGION / AWS_DEFAULT_REGION env). */
  region?: string
  /**
   * Custom S3-compatible endpoint (e.g. for Cloudflare R2, MinIO, Hetzner
   * Object Storage). Omit for AWS.
   */
  endpoint?: string
  /**
   * Skip silently when credentials are absent rather than failing the
   * backup run. Default true — a backup that ran locally shouldn't be
   * reported as failed just because the off-site copy couldn't upload.
   */
  optional?: boolean
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
  /**
   * When true, a missing source path is reported as *skipped* rather than
   * *failed*, so a config shared across machines isn't marked failed just
   * because an app/credential isn't installed on this one.
   */
  optional?: boolean

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
  type: BackupType.SQLITE
  /** Path to the SQLite database file */
  path: string
}

export interface PostgreSQLConfig extends BaseDbConfig {
  type: BackupType.POSTGRESQL
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
  type: BackupType.MYSQL
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
  type: BackupType
  filename: string
  size: number
  duration: number
  success: boolean
  error?: string
  /** Number of files included (for file backups) */
  fileCount?: number
  /** True when an optional source was absent and intentionally not backed up. */
  skipped?: boolean
}

export interface BackupSummary {
  results: BackupResult[]
  totalDuration: number
  successCount: number
  failureCount: number
  /** Breakdown by backup type */
  databaseBackups: BackupResult[]
  fileBackups: BackupResult[]
  /** Off-machine upload results, when destinations are configured. */
  uploads?: UploadResult[]
}

export interface UploadResult {
  /** Destination kind ("s3"). */
  destination: string
  /** The backup file that was uploaded. */
  filename: string
  /** Remote URI it was uploaded to (e.g. s3://bucket/prefix/file). */
  target: string
  success: boolean
  /** True when skipped because credentials were absent and optional=true. */
  skipped?: boolean
  error?: string
}

export interface RestoreOptions {
  /** Restore only these named backups (default: every file backup in the config). */
  only?: string[]
  /** Restore from a specific snapshot filename instead of the most recent one. */
  snapshot?: string
  /** Restore to this base path instead of each backup's original `path`. */
  targetPath?: string
  /** Overwrite files that already exist at the destination (default: false). */
  overwrite?: boolean
  /** Enable verbose logging (defaults to the config's `verbose`). */
  verbose?: boolean
}

export interface RestoreResult {
  /** The backup entry's name (matches the FileConfig that produced the snapshot). */
  name: string
  type: BackupType
  /** The snapshot file the data was restored from. */
  snapshot: string
  /** Where the data was written. */
  restoredPath: string
  /** Bytes written (sum of all files for a directory restore). */
  size: number
  /** Number of files written (for directory restores). */
  fileCount?: number
  duration: number
  success: boolean
  /** True when the entry was intentionally not restored (e.g. databases). */
  skipped?: boolean
  error?: string
}

export interface RestoreSummary {
  results: RestoreResult[]
  totalDuration: number
  successCount: number
  failureCount: number
  skippedCount: number
}
