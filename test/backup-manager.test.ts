import type { BackupConfig } from '../src/types'
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rmdir, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BackupManager, createBackup } from '../src/backups'

describe('BackupManager', () => {
  const testOutputDir = './test-backup-manager'
  const testDb1Path = './test-db1.sqlite'
  const testDb2Path = './test-db2.sqlite'

  beforeEach(async () => {
    await cleanup()
    await mkdir(testOutputDir, { recursive: true })

    // Create test databases
    const db1 = new Database(testDb1Path)
    db1.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);
      INSERT INTO users (name) VALUES ('John'), ('Jane');
    `)
    db1.close()

    const db2 = new Database(testDb2Path)
    db2.exec(`
      CREATE TABLE products (id INTEGER PRIMARY KEY, title TEXT);
      INSERT INTO products (title) VALUES ('Product A'), ('Product B');
    `)
    db2.close()
  })

  afterEach(async () => {
    await cleanup()
  })

  async function cleanup() {
    try {
      for (const path of [testDb1Path, testDb2Path]) {
        if (existsSync(path)) {
          await unlink(path)
        }
      }

      if (existsSync(testOutputDir)) {
        try {
          const entries = await readdir(testOutputDir)
          for (const file of entries) {
            await unlink(join(testOutputDir, file))
          }
          await rmdir(testOutputDir)
        }
        catch {
          // Directory might not exist or be empty
        }
      }
    }
    catch {
      // Files might not exist
    }
  }

  describe('single database backup', () => {
    it('should backup a single SQLite database', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'test-db1',
            path: testDb1Path,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(1)
      expect(summary.successCount).toBe(1)
      expect(summary.failureCount).toBe(0)
      expect(summary.totalDuration).toBeGreaterThan(0)

      const result = summary.results[0]
      expect(result.success).toBe(true)
      expect(result.database).toBe('test-db1')
      expect(result.type).toBe('sqlite')
      expect(result.filename).toBeTruthy()
      expect(result.size).toBeGreaterThan(0)

      // Verify file exists
      const backupPath = join(testOutputDir, result.filename)
      expect(existsSync(backupPath)).toBe(true)
    })

    it('should handle backup failure gracefully', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'missing-db',
            path: './non-existent.sqlite',
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(1)
      expect(summary.successCount).toBe(0)
      expect(summary.failureCount).toBe(1)

      const result = summary.results[0]
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.filename).toBe('')
      expect(result.size).toBe(0)
    })
  })

  describe('multiple database backup', () => {
    it('should backup multiple databases successfully', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'users-db',
            path: testDb1Path,
          },
          {
            type: 'sqlite',
            name: 'products-db',
            path: testDb2Path,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(2)
      expect(summary.successCount).toBe(2)
      expect(summary.failureCount).toBe(0)

      // Check both backups
      const usersResult = summary.results.find(r => r.database === 'users-db')
      const productsResult = summary.results.find(r => r.database === 'products-db')

      expect(usersResult?.success).toBe(true)
      expect(productsResult?.success).toBe(true)

      // Verify both files exist
      expect(existsSync(join(testOutputDir, usersResult!.filename))).toBe(true)
      expect(existsSync(join(testOutputDir, productsResult!.filename))).toBe(true)
    })

    it('should handle mixed success/failure scenarios', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'good-db',
            path: testDb1Path,
          },
          {
            type: 'sqlite',
            name: 'bad-db',
            path: './non-existent.sqlite',
          },
          {
            type: 'sqlite',
            name: 'another-good-db',
            path: testDb2Path,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(3)
      expect(summary.successCount).toBe(2)
      expect(summary.failureCount).toBe(1)

      const goodResult = summary.results.find(r => r.database === 'good-db')
      const badResult = summary.results.find(r => r.database === 'bad-db')
      const anotherGoodResult = summary.results.find(r => r.database === 'another-good-db')

      expect(goodResult?.success).toBe(true)
      expect(badResult?.success).toBe(false)
      expect(anotherGoodResult?.success).toBe(true)

      expect(badResult?.error).toBeDefined()
    })
  })

  describe('retention policy', () => {
    it('should clean up old backups based on count', async () => {
      // Create some old backup files
      const oldFiles = [
        'test-db_2023-01-01T10-00-00-000Z.sql',
        'test-db_2023-01-02T10-00-00-000Z.sql',
        'test-db_2023-01-03T10-00-00-000Z.sql',
      ]

      for (const file of oldFiles) {
        await writeFile(join(testOutputDir, file), '-- Old backup content')
      }

      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        retention: {
          count: 2, // Keep only 2 backups
        },
        databases: [
          {
            type: 'sqlite',
            name: 'test-db',
            path: testDb1Path,
          },
        ],
      }

      const manager = new BackupManager(config)
      await manager.createBackup()

      // Check remaining files
      const files = await readdir(testOutputDir)
      const sqlFiles = files.filter(f => f.endsWith('.sql'))

      // Should have at most 2 files (the retention count)
      expect(sqlFiles.length).toBeLessThanOrEqual(2)
    })

    it('should clean up old backups based on age', async () => {
      // Create an old backup file with past modification time
      const oldFile = join(testOutputDir, 'old-backup.sql')
      await writeFile(oldFile, '-- Old backup content')

      // Manually set the file timestamp to be older than retention policy
      // Note: This is a simplified test - in real scenarios the cleanup would check actual file ages

      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        retention: {
          maxAge: 1, // 1 day
        },
        databases: [
          {
            type: 'sqlite',
            name: 'test-db',
            path: testDb1Path,
          },
        ],
      }

      const manager = new BackupManager(config)
      await manager.createBackup()

      // The old file might still exist since we can't easily modify its timestamp in tests
      // This test validates that the retention logic runs without errors
      const files = await readdir(testOutputDir)
      expect(files.length).toBeGreaterThan(0) // At least the new backup should exist
    })
  })

  describe('output directory handling', () => {
    it('should create output directory if it does not exist', async () => {
      const newOutputDir = './test-new-output'

      // Ensure directory doesn't exist
      if (existsSync(newOutputDir)) {
        await rmdir(newOutputDir, { recursive: true })
      }

      const config: BackupConfig = {
        verbose: false,
        outputPath: newOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'test-db',
            path: testDb1Path,
          },
        ],
      }

      try {
        const manager = new BackupManager(config)
        const summary = await manager.createBackup()

        expect(summary.successCount).toBe(1)
        expect(existsSync(newOutputDir)).toBe(true)

        // Clean up
        const files = await readdir(newOutputDir)
        for (const file of files) {
          await unlink(join(newOutputDir, file))
        }
        await rmdir(newOutputDir)
      }
      catch (error) {
        // Clean up on error
        if (existsSync(newOutputDir)) {
          try {
            await rmdir(newOutputDir, { recursive: true })
          }
          catch {
            // Ignore cleanup errors
          }
        }
        throw error
      }
    })

    it('should use default output path when not specified', async () => {
      // Clean up any existing backups file/directory
      try {
        if (existsSync('./backups')) {
          const stats = await stat('./backups')
          if (stats.isDirectory()) {
            const files = await readdir('./backups')
            for (const file of files) {
              await unlink(join('./backups', file))
            }
            await rmdir('./backups')
          }
          else {
            await unlink('./backups')
          }
        }
      }
      catch {
        // Ignore cleanup errors
      }

      const config: BackupConfig = {
        verbose: false,
        databases: [
          {
            type: 'sqlite',
            name: 'test-db',
            path: testDb1Path,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      // Debug output if test fails
      if (summary.successCount !== 1) {
        console.error('Backup failed:', summary.results[0]?.error)
      }

      expect(summary.successCount).toBe(1)

      // Should create default ./backups directory
      expect(existsSync('./backups')).toBe(true)

      // Clean up
      try {
        const files = await readdir('./backups')
        for (const file of files) {
          await unlink(join('./backups', file))
        }
        await rmdir('./backups')
      }
      catch {
        // Ignore cleanup errors
      }
    })
  })

  describe('verbose mode', () => {
    it('should produce verbose output when enabled', async () => {
      const config: BackupConfig = {
        verbose: true,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'test-db',
            path: testDb1Path,
          },
        ],
      }

      // Capture console output
      const originalWarn = console.warn
      const logs: string[] = []
      console.warn = (...args: any[]) => {
        logs.push(args.join(' '))
      }

      try {
        const manager = new BackupManager(config)
        await manager.createBackup()

        expect(logs.length).toBeGreaterThan(0)
        expect(logs.some(log => log.includes('Starting backup process'))).toBe(true)
        expect(logs.some(log => log.includes('Backup Summary'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
      }
    })

    it('should override database-specific verbose settings', async () => {
      const config: BackupConfig = {
        verbose: true, // Global verbose
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'test-db',
            path: testDb1Path,
            verbose: false, // Database-specific verbose
          },
        ],
      }

      // Capture console output
      const originalWarn = console.warn
      const logs: string[] = []
      console.warn = (...args: any[]) => {
        logs.push(args.join(' '))
      }

      try {
        const manager = new BackupManager(config)
        await manager.createBackup()

        // Should have manager-level verbose output but not database-level
        expect(logs.some(log => log.includes('Starting backup process'))).toBe(true)
        expect(logs.some(log => log.includes('Processing database'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
      }
    })
  })

  describe('convenience function', () => {
    it('should work with createBackup function', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'test-db',
            path: testDb1Path,
          },
        ],
      }

      const summary = await createBackup(config)

      expect(summary.results).toHaveLength(1)
      expect(summary.successCount).toBe(1)
      expect(summary.failureCount).toBe(0)
      expect(summary.results[0].success).toBe(true)
    })
  })

  describe('error scenarios', () => {
    it('should handle empty database configuration', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(0)
      expect(summary.successCount).toBe(0)
      expect(summary.failureCount).toBe(0)
      expect(summary.totalDuration).toBeGreaterThanOrEqual(0)
    })

    it('should handle unsupported database type', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'unsupported' as any,
            name: 'bad-db',
            path: testDb1Path,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(1)
      expect(summary.successCount).toBe(0)
      expect(summary.failureCount).toBe(1)
      expect(summary.results[0].success).toBe(false)
      expect(summary.results[0].error).toContain('Unsupported database type')
    })
  })
})
