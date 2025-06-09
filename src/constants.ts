/**
 * Constants used throughout the backup system
 */

export const DEFAULT_CONFIG: {
  readonly BACKUP_PATH: './backups'
  readonly RETENTION_COUNT: 5
  readonly RETENTION_MAX_AGE: 30
  readonly VERBOSE: true
} = {
  BACKUP_PATH: './backups',
  RETENTION_COUNT: 5,
  RETENTION_MAX_AGE: 30,
  VERBOSE: true,
} as const

export const FILE_LIMITS: {
  readonly MAX_FILENAME_LENGTH: 255
  readonly DEFAULT_MAX_FILE_SIZE: number
} = {
  MAX_FILENAME_LENGTH: 255,
  DEFAULT_MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
} as const

export const COMPRESSION: {
  readonly SUPPORTED_FORMATS: readonly ['.gz', '.tar.gz']
  readonly DEFAULT_EXTENSION: '.gz'
} = {
  SUPPORTED_FORMATS: ['.gz', '.tar.gz'] as const,
  DEFAULT_EXTENSION: '.gz',
} as const

export const DATABASE_DEFAULTS: {
  readonly POSTGRESQL_PORT: 5432
  readonly MYSQL_PORT: 3306
  readonly INCLUDE_SCHEMA: true
  readonly INCLUDE_DATA: true
} = {
  POSTGRESQL_PORT: 5432,
  MYSQL_PORT: 3306,
  INCLUDE_SCHEMA: true,
  INCLUDE_DATA: true,
} as const

export const BACKUP_FILE_PATTERNS: {
  readonly SQL: RegExp
  readonly TAR: RegExp
  readonly BACKUP: RegExp
} = {
  SQL: /\.(sql|sql\.gz)$/,
  TAR: /\.(tar|tar\.gz)$/,
  BACKUP: /_(backup|bak)_/,
} as const
