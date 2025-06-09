import type { BackupConfig, BackupResult, BackupSummary, DatabaseConfig } from '../types'
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
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

    // Run backups for all configured databases
    const results: BackupResult[] = []

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
          database: dbConfig.name,
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

      // Get info about all backup files
      for (const file of files) {
        if (file.endsWith('.sql')) {
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

    if (summary.results.length > 0) {
      console.warn('\n📋 Results:')
      for (const result of summary.results) {
        const status = result.success ? '✅' : '❌'
        const size = result.success ? `${(result.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'
        const duration = `${result.duration.toFixed(2)}ms`

        console.warn(`${status} ${result.database} (${result.type}): ${size} in ${duration}`)

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

export { backupMySQL } from './mysql'
export { backupPostgreSQL } from './postgresql'
// Export individual backup functions for direct use
export { backupSQLite } from './sqlite'
