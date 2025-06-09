import type { BackupConfig, BackupResult, BackupSummary, DatabaseConfig, FileConfig } from '../types'
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { backupDirectory } from './directory'
import { backupFile } from './file'
import { backupMySQL } from './mysql'
import { backupPostgreSQL } from './postgresql'
import { backupSQLite } from './sqlite'

export class BackupManager {
  constructor(private config: BackupConfig) {}

  async createBackup(): Promise<BackupSummary> {
    const startTime = performance.now()

    if (this.config.verbose) {
      console.warn('🚀 Starting backup process...')
    }

    // Ensure output directory exists
    const outputPath = this.config.outputPath || './backups'
    await this.ensureDirectoryExists(outputPath)

    // Run backups for all configured databases and files
    const results: BackupResult[] = []

    // Process database backups
    for (const dbConfig of this.config.databases) {
      if (this.config.verbose) {
        console.warn(`\n📋 Processing database: ${dbConfig.name} (${dbConfig.type})`)
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
          console.error(`❌ Failed to backup ${dbConfig.name}: ${errorMessage}`)
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
        console.warn(`\n📁 Processing ${fileType}: ${fileConfig.name}`)
      }

      try {
        const result = await this.backupFile(fileConfig, outputPath)
        results.push(result)
      }
      catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)

        results.push({
          name: fileConfig.name,
          type: fileType,
          filename: '',
          size: 0,
          duration: 0,
          success: false,
          error: errorMessage,
        })

        if (this.config.verbose) {
          console.error(`❌ Failed to backup ${fileConfig.name}: ${errorMessage}`)
        }
      }
    }

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
      databaseBackups: results.filter(r => ['sqlite', 'postgresql', 'mysql'].includes(r.type)),
      fileBackups: results.filter(r => ['directory', 'file'].includes(r.type)),
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

    try {
      const files = await readdir(outputPath)
      const backupFiles: Array<{ name: string, path: string, stats: any, age: number }> = []

      // Get info about all backup files (SQL, TAR, and other backup formats)
      for (const file of files) {
        if (file.endsWith('.sql') || file.endsWith('.tar') || file.endsWith('.tar.gz') || file.includes('_')) {
          const filePath = join(outputPath, file)
          const fileStats = await stat(filePath)
          const age = Date.now() - fileStats.mtime.getTime()

          backupFiles.push({
            name: file,
            path: filePath,
            stats: fileStats,
            age: age / (1000 * 60 * 60 * 24), // Convert to days
          })
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
        if (this.config.verbose) {
          console.warn(`🗑️  Removed old backup: ${filePath}`)
        }
      }

      if (filesToDelete.length > 0 && this.config.verbose) {
        console.warn(`🧹 Cleaned up ${filesToDelete.length} old backup files`)
      }
    }
    catch (error) {
      if (this.config.verbose) {
        console.error(`⚠️  Failed to cleanup old backups: ${error}`)
      }
    }
  }

  private printSummary(summary: BackupSummary): void {
    console.warn('\n📊 Backup Summary:')
    console.warn(`⏱️  Total duration: ${summary.totalDuration.toFixed(2)}ms`)
    console.warn(`✅ Successful: ${summary.successCount}`)
    console.warn(`❌ Failed: ${summary.failureCount}`)

    if (summary.databaseBackups.length > 0) {
      console.warn('\n🗄️  Database Backups:')
      for (const result of summary.databaseBackups) {
        const status = result.success ? '✅' : '❌'
        const size = result.success ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
        const duration = `${result.duration.toFixed(2)}ms`

        console.warn(`${status} ${result.name} (${result.type}): ${size} in ${duration}`)

        if (!result.success && result.error) {
          console.warn(`   Error: ${result.error}`)
        }
      }
    }

    if (summary.fileBackups.length > 0) {
      console.warn('\n📁 File Backups:')
      for (const result of summary.fileBackups) {
        const status = result.success ? '✅' : '❌'
        const size = result.success ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
        const duration = `${result.duration.toFixed(2)}ms`
        const fileCount = result.fileCount ? ` (${result.fileCount} files)` : ''

        console.warn(`${status} ${result.name} (${result.type}): ${size} in ${duration}${fileCount}`)

        if (!result.success && result.error) {
          console.warn(`   Error: ${result.error}`)
        }
      }
    }

    console.warn('')
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
// Export individual backup functions for direct use
export { backupSQLite } from './sqlite'
