import type { BackupConfig, BackupResult, BackupSummary, DatabaseConfig, FileConfig, UploadResult } from '../types'
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Logger } from '@stacksjs/clarity'
import { BackupType } from '../types'
import { backupDirectory } from './directory'
import { backupFile } from './file'
import { backupMySQL } from './mysql'
import { backupPostgreSQL } from './postgresql'
import { uploadToS3 } from './s3'
import { backupSQLite } from './sqlite'

export class BackupManager {
  constructor(private config: BackupConfig) {}

  async createBackup(): Promise<BackupSummary> {
    const startTime = performance.now()
    const logger = new Logger('ts-backups:manager')

    if (this.config.verbose) {
      logger.warn('🚀 Starting backup process...')
    }

    // Ensure output directory exists
    const outputPath = this.config.outputPath || './backups'
    await this.ensureDirectoryExists(outputPath)

    // Run backups for all configured databases and files
    const results: BackupResult[] = []

    // Process database backups
    for (const dbConfig of this.config.databases) {
      if (this.config.verbose) {
        logger.warn(`\n📋 Processing database: ${dbConfig.name} (${dbConfig.type})`)
      }

      try {
        const result = await this.backupDatabase(dbConfig, outputPath)
        results.push(result)
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        results.push({
          name: dbConfig.name,
          type: dbConfig.type,
          filename: '',
          size: 0,
          duration: 0,
          success: false,
          error: errorMessage,
        })

        if (this.config.verbose) {
          logger.error(`❌ Failed to backup ${dbConfig.name}: ${errorMessage}`)
        }
      }
    }

    // Process file backups
    for (const fileConfig of this.config.files) {
      // Determine type programmatically
      let fileType: 'directory' | 'file'
      try {
        const stats = await stat(fileConfig.path)
        fileType = stats.isDirectory() ? 'directory' : 'file'
      }
      catch {
        // If we can't stat the file, assume it's a file and let the backup function handle the error
        fileType = 'file'
      }

      if (this.config.verbose) {
        logger.warn(`\n📁 Processing ${fileType}: ${fileConfig.name}`)
      }

      try {
        const result = await this.backupFile(fileConfig, outputPath)
        results.push(result)
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        results.push({
          name: fileConfig.name,
          type: fileType === 'directory' ? BackupType.DIRECTORY : BackupType.FILE,
          filename: '',
          size: 0,
          duration: 0,
          success: false,
          error: errorMessage,
        })

        if (this.config.verbose) {
          logger.error(`❌ Failed to backup ${fileConfig.name}: ${errorMessage}`)
        }
      }
    }

    // Upload successful backups to any configured off-machine destinations
    // BEFORE local retention runs, so a freshly-uploaded file is never
    // pruned out from under the upload.
    const uploads = await this.uploadBackups(results, outputPath)

    // Clean up old backups if retention policy is configured
    if (this.config.retention) {
      await this.cleanupOldBackups(outputPath)
    }

    const endTime = performance.now()
    const totalDuration = endTime - startTime

    const summary: BackupSummary = {
      results,
      totalDuration,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      databaseBackups: results.filter(r => [BackupType.SQLITE, BackupType.POSTGRESQL, BackupType.MYSQL].includes(r.type)),
      fileBackups: results.filter(r => [BackupType.DIRECTORY, BackupType.FILE].includes(r.type)),
      uploads: uploads.length > 0 ? uploads : undefined,
    }

    if (this.config.verbose) {
      this.printSummary(summary)
    }

    return summary
  }

  private async backupDatabase(dbConfig: DatabaseConfig, outputPath: string): Promise<BackupResult> {
    switch (dbConfig.type) {
      case 'sqlite': {
        // Use database-specific verbose setting if provided, otherwise fall back to global setting
        const verboseConfig = { ...dbConfig, verbose: dbConfig.verbose ?? this.config.verbose }
        return await backupSQLite(verboseConfig, outputPath)
      }
      case 'postgresql': {
        // Use database-specific verbose setting if provided, otherwise fall back to global setting
        const verboseConfig = { ...dbConfig, verbose: dbConfig.verbose ?? this.config.verbose }
        return await backupPostgreSQL(verboseConfig, outputPath)
      }
      case 'mysql': {
        // Use database-specific verbose setting if provided, otherwise fall back to global setting
        const verboseConfig = { ...dbConfig, verbose: dbConfig.verbose ?? this.config.verbose }
        return await backupMySQL(verboseConfig, outputPath)
      }
      default:
        throw new Error(`Unsupported database type: ${(dbConfig as any).type}`)
    }
  }

  private async backupFile(fileConfig: FileConfig, outputPath: string): Promise<BackupResult> {
    // Determine if path is directory or file programmatically
    let isDirectory: boolean
    try {
      const stats = await stat(fileConfig.path)
      isDirectory = stats.isDirectory()
    }
    catch {
      // If we can't stat the file, assume it's a file and let the backup function handle the error
      isDirectory = false
    }

    if (isDirectory) {
      // Use file-specific verbose setting if provided, otherwise fall back to global setting
      const verboseConfig = { ...fileConfig, verbose: fileConfig.verbose ?? this.config.verbose }
      return await backupDirectory(verboseConfig, outputPath)
    }
    else {
      // Use file-specific verbose setting if provided, otherwise fall back to global setting
      const verboseConfig = { ...fileConfig, verbose: fileConfig.verbose ?? this.config.verbose }
      return await backupFile(verboseConfig, outputPath)
    }
  }

  /** Upload every successfully produced backup to each configured destination. */
  private async uploadBackups(results: BackupResult[], outputPath: string): Promise<UploadResult[]> {
    const destinations = this.config.destinations
    if (!destinations || destinations.length === 0)
      return []

    const logger = new Logger('ts-backups:upload')
    const uploads: UploadResult[] = []

    for (const result of results) {
      if (!result.success || !result.filename)
        continue
      const localFile = join(outputPath, result.filename)

      for (const dest of destinations) {
        if (dest.type === 's3') {
          uploads.push(await uploadToS3(dest, localFile, this.config.verbose))
        }
        else if (this.config.verbose) {
          logger.warn(`Unknown destination type: ${(dest as any).type}`)
        }
      }
    }

    if (this.config.verbose && uploads.length > 0) {
      const ok = uploads.filter(u => u.success && !u.skipped).length
      const skipped = uploads.filter(u => u.skipped).length
      const failed = uploads.filter(u => !u.success).length
      logger.warn(`☁️  Uploads: ${ok} succeeded, ${skipped} skipped, ${failed} failed`)
    }

    return uploads
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    try {
      await mkdir(path, { recursive: true })
    }
    catch (error) {
      if ((error as any).code !== 'EEXIST') {
        throw error
      }
    }
  }

  private async cleanupOldBackups(outputPath: string): Promise<void> {
    if (!this.config.retention)
      return

    const logger = new Logger('ts-backups:retention')
    try {
      const files = await readdir(outputPath)
      const backupFiles: Array<{ name: string, path: string, stats: any, age: number }> = []

      // Get info about all backup files - be more inclusive in matching backup files
      for (const file of files) {
        // Match backup files by common extensions and patterns
        const isBackupFile
          = file.endsWith('.sql')
            || file.endsWith('.tar')
            || file.endsWith('.tar.gz')
            || file.endsWith('.gz')
            || file.includes('_backup')
            || file.includes('backup_')
            || /\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/.test(file) // timestamp pattern
            || file.includes('_') // fallback for timestamped files

        if (isBackupFile) {
          const filePath = join(outputPath, file)
          try {
            const fileStats = await stat(filePath)
            const age = Date.now() - fileStats.mtime.getTime()

            backupFiles.push({
              name: file,
              path: filePath,
              stats: fileStats,
              age: age / (1000 * 60 * 60 * 24), // Convert to days
            })
          }
          catch {
            // Skip files we can't stat
            continue
          }
        }
      }

      // Sort by modification time (newest first)
      backupFiles.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime())

      const { count, maxAge } = this.config.retention
      const filesToDelete: string[] = []

      // Remove files that exceed the count limit
      if (count && backupFiles.length > count) {
        const excessFiles = backupFiles.slice(count)
        filesToDelete.push(...excessFiles.map(f => f.path))
      }

      // Remove files that exceed the age limit
      if (maxAge) {
        const oldFiles = backupFiles.filter(f => f.age > maxAge)
        for (const file of oldFiles) {
          if (!filesToDelete.includes(file.path)) {
            filesToDelete.push(file.path)
          }
        }
      }

      // Delete the files
      for (const filePath of filesToDelete) {
        await unlink(filePath)
        logger.warn(`🗑️  Removed old backup: ${filePath}`)
      }

      if (filesToDelete.length > 0) {
        logger.warn(`🧹 Cleaned up ${filesToDelete.length} old backup files`)
      }
    }
    catch (error) {
      if (this.config.verbose) {
        logger.error(`⚠️  Failed to cleanup old backups: ${error}`)
      }
    }
  }

  private printSummary(summary: BackupSummary): void {
    const logger = new Logger('ts-backups:summary')
    logger.warn('\n📊 Backup Summary:')
    logger.warn(`⏱️  Total duration: ${summary.totalDuration.toFixed(2)}ms`)
    logger.warn(`✅ Successful: ${summary.successCount}`)
    logger.warn(`❌ Failed: ${summary.failureCount}`)

    if (summary.databaseBackups.length > 0) {
      logger.warn('\n🗄️  Database Backups:')
      for (const result of summary.databaseBackups) {
        const status = result.success ? '✅' : '❌'
        const size = result.success ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
        const duration = `${result.duration.toFixed(2)}ms`

        logger.warn(`${status} ${result.name} (${result.type}): ${size} in ${duration}`)

        if (!result.success && result.error) {
          logger.warn(`   Error: ${result.error}`)
        }
      }
    }

    if (summary.fileBackups.length > 0) {
      logger.warn('\n📁 File Backups:')
      for (const result of summary.fileBackups) {
        const status = result.success ? '✅' : '❌'
        const size = result.success ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
        const duration = `${result.duration.toFixed(2)}ms`
        const fileCount = result.fileCount ? ` (${result.fileCount} files)` : ''

        logger.warn(`${status} ${result.name} (${result.type}): ${size} in ${duration}${fileCount}`)

        if (!result.success && result.error) {
          logger.warn(`   Error: ${result.error}`)
        }
      }
    }

    logger.warn('')
  }
}

// Convenience function for single backup operations
export async function createBackup(config: BackupConfig): Promise<BackupSummary> {
  const manager = new BackupManager(config)
  return await manager.createBackup()
}

export { backupDirectory } from './directory'
export { backupFile } from './file'
export { backupMySQL } from './mysql'
export { backupPostgreSQL } from './postgresql'
export { uploadToS3 } from './s3'
// Export individual backup functions for direct use
export { backupSQLite } from './sqlite'
