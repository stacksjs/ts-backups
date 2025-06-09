import type { BackupConfig } from '../src/types'
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rmdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BackupManager, createBackup } from '../src/backups'

describe('BackupManager', () => {
  const testOutputDir = './test-backup-manager'
  const testDb1Path = './test-db1.sqlite'
  const testDb2Path = './test-db2.sqlite'
  const testFileDir = './test-manager-files'
  const testFile1Path = join(testFileDir, 'config.json')
  const testFile2Path = join(testFileDir, 'data.txt')

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

    // Create test files and directories
    await mkdir(testFileDir, { recursive: true })
    await mkdir(join(testFileDir, 'uploads'), { recursive: true })

    await writeFile(testFile1Path, '{"app": "test", "version": "1.0"}')
    await writeFile(testFile2Path, 'This is test data for file backup.')
    await writeFile(join(testFileDir, 'uploads', 'image1.jpg'), 'fake image content 1')
    await writeFile(join(testFileDir, 'uploads', 'image2.png'), 'fake image content 2')
    await writeFile(join(testFileDir, 'uploads', 'doc.pdf'), 'fake pdf content')
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

      await removeDirectory(testFileDir)
      await removeDirectory(testOutputDir)
    }
    catch {
      // Files might not exist
    }
  }

  async function removeDirectory(dirPath: string) {
    if (existsSync(dirPath)) {
      try {
        const entries = await readdir(dirPath, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dirPath, entry.name)
          if (entry.isDirectory()) {
            await removeDirectory(fullPath)
          }
          else {
            await unlink(fullPath)
          }
        }
        await rmdir(dirPath)
      }
      catch {
        // Directory might not exist or be empty
      }
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
        files: [],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(1)
      expect(summary.successCount).toBe(1)
      expect(summary.failureCount).toBe(0)
      expect(summary.totalDuration).toBeGreaterThan(0)
      expect(summary.databaseBackups).toHaveLength(1)
      expect(summary.fileBackups).toHaveLength(0)

      const result = summary.results[0]
      expect(result.success).toBe(true)
      expect(result.name).toBe('test-db1')
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
        files: [],
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

  describe('single file backup', () => {
    it('should backup a single file', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [],
        files: [
          {
            name: 'config-backup',
            path: testFile1Path,
            compress: false,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(1)
      expect(summary.successCount).toBe(1)
      expect(summary.failureCount).toBe(0)
      expect(summary.databaseBackups).toHaveLength(0)
      expect(summary.fileBackups).toHaveLength(1)

      const result = summary.results[0]
      expect(result.success).toBe(true)
      expect(result.name).toBe('config-backup')
      expect(result.type).toBe('file')
      expect(result.filename).toBeTruthy()
      expect(result.size).toBeGreaterThan(0)
      expect(result.fileCount).toBe(1)

      // Verify file exists
      const backupPath = join(testOutputDir, result.filename)
      expect(existsSync(backupPath)).toBe(true)
    })

    it('should backup a directory', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [],
        files: [
          {
            name: 'uploads-backup',
            path: join(testFileDir, 'uploads'),
            compress: true,
            include: ['*.jpg', '*.png', '*.pdf'],
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(1)
      expect(summary.successCount).toBe(1)
      expect(summary.failureCount).toBe(0)
      expect(summary.fileBackups).toHaveLength(1)

      const result = summary.results[0]
      expect(result.success).toBe(true)
      expect(result.name).toBe('uploads-backup')
      expect(result.type).toBe('directory')
      expect(result.filename).toMatch(/\.tar\.gz$/)
      expect(result.fileCount).toBe(3) // jpg, png, pdf files
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
        files: [],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(2)
      expect(summary.successCount).toBe(2)
      expect(summary.failureCount).toBe(0)

      // Check both backups
      const usersResult = summary.results.find(r => r.name === 'users-db')
      const productsResult = summary.results.find(r => r.name === 'products-db')

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
        files: [],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(3)
      expect(summary.successCount).toBe(2)
      expect(summary.failureCount).toBe(1)

      const goodResult = summary.results.find(r => r.name === 'good-db')
      const badResult = summary.results.find(r => r.name === 'bad-db')
      const anotherGoodResult = summary.results.find(r => r.name === 'another-good-db')

      expect(goodResult?.success).toBe(true)
      expect(badResult?.success).toBe(false)
      expect(anotherGoodResult?.success).toBe(true)
    })
  })

  describe('mixed database and file backups', () => {
    it('should backup both databases and files successfully', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'main-db',
            path: testDb1Path,
          },
        ],
        files: [
          {
            name: 'config-file',
            path: testFile1Path,
            compress: false,
          },
          {
            name: 'uploads-dir',
            path: join(testFileDir, 'uploads'),
            compress: true,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(3)
      expect(summary.successCount).toBe(3)
      expect(summary.failureCount).toBe(0)
      expect(summary.databaseBackups).toHaveLength(1)
      expect(summary.fileBackups).toHaveLength(2)

      // Check database backup
      const dbResult = summary.results.find(r => r.type === 'sqlite')
      expect(dbResult?.success).toBe(true)
      expect(dbResult?.name).toBe('main-db')

      // Check file backups
      const fileResult = summary.results.find(r => r.type === 'file')
      const dirResult = summary.results.find(r => r.type === 'directory')

      expect(fileResult?.success).toBe(true)
      expect(fileResult?.name).toBe('config-file')
      expect(fileResult?.fileCount).toBe(1)

      expect(dirResult?.success).toBe(true)
      expect(dirResult?.name).toBe('uploads-dir')
      expect(dirResult?.fileCount).toBeGreaterThan(0)
    })

    it('should handle mixed success/failure with files and databases', async () => {
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
        ],
        files: [
          {
            name: 'good-file',
            path: testFile1Path,
            compress: false,
          },
          {
            name: 'bad-file',
            path: './non-existent-file.txt',
            compress: false,
          },
          {
            name: 'good-dir',
            path: join(testFileDir, 'uploads'),
            compress: false,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(5)
      expect(summary.successCount).toBe(3) // good-db, good-file, good-dir
      expect(summary.failureCount).toBe(2) // bad-db, bad-file

      // Check results by name
      const goodDbResult = summary.results.find(r => r.name === 'good-db')
      const badDbResult = summary.results.find(r => r.name === 'bad-db')
      const goodFileResult = summary.results.find(r => r.name === 'good-file')
      const badFileResult = summary.results.find(r => r.name === 'bad-file')
      const goodDirResult = summary.results.find(r => r.name === 'good-dir')

      expect(goodDbResult?.success).toBe(true)
      expect(badDbResult?.success).toBe(false)
      expect(goodFileResult?.success).toBe(true)
      expect(badFileResult?.success).toBe(false)
      expect(goodDirResult?.success).toBe(true)
    })
  })

  describe('retention policy with file backups', () => {
    it('should clean up old backups including file backups', async () => {
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
        files: [
          {
            name: 'test-file',
            path: testFile1Path,
            compress: false,
          },
        ],
      }

      // Create old backup files to test cleanup
      await writeFile(join(testOutputDir, 'old_backup1.sql'), 'old backup 1')
      await writeFile(join(testOutputDir, 'old_backup2.tar'), 'old backup 2')
      await writeFile(join(testOutputDir, 'old_backup3.txt'), 'old backup 3')

      const manager = new BackupManager(config)
      await manager.createBackup()

      // Should have cleaned up old files due to retention policy
      expect(existsSync(join(testOutputDir, 'old_backup1.sql'))).toBe(false)
      expect(existsSync(join(testOutputDir, 'old_backup2.tar'))).toBe(false)
      expect(existsSync(join(testOutputDir, 'old_backup3.txt'))).toBe(false)
    })
  })

  describe('verbose mode', () => {
    it('should work with verbose logging for mixed backups', async () => {
      const config: BackupConfig = {
        verbose: true,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'verbose-db',
            path: testDb1Path,
          },
        ],
        files: [
          {
            name: 'verbose-file',
            path: testFile1Path,
            compress: false,
          },
        ],
      }

      // Capture console output
      const originalWarn = console.warn
      const originalError = console.error
      const logs: string[] = []

      console.warn = (...args: any[]) => {
        logs.push(args.join(' '))
      }
      console.error = (...args: any[]) => {
        logs.push(args.join(' '))
      }

      try {
        const manager = new BackupManager(config)
        const summary = await manager.createBackup()

        expect(summary.successCount).toBe(2)
        expect(logs.length).toBeGreaterThan(0)
        expect(logs.some(log => log.includes('Starting backup process'))).toBe(true)
        expect(logs.some(log => log.includes('Database Backups'))).toBe(true)
        expect(logs.some(log => log.includes('File Backups'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
        console.error = originalError
      }
    })
  })

  describe('configuration overrides', () => {
    it('should use database-specific verbose setting', async () => {
      const config: BackupConfig = {
        verbose: false, // Global verbose is false
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'verbose-override',
            path: testDb1Path,
            verbose: true, // But this database has verbose true
          },
        ],
        files: [],
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

        // Should have verbose output from the database backup
        expect(logs.some(log => log.includes('Starting SQLite backup'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
      }
    })

    it('should use file-specific verbose setting', async () => {
      const config: BackupConfig = {
        verbose: false, // Global verbose is false
        outputPath: testOutputDir,
        databases: [],
        files: [
          {
            name: 'verbose-file-override',
            path: testFile1Path,
            verbose: true, // But this file has verbose true
            compress: false,
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

        // Should have verbose output from the file backup
        expect(logs.some(log => log.includes('Starting file backup'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
      }
    })
  })

  describe('createBackup convenience function', () => {
    it('should work with mixed backup configuration', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'convenience-db',
            path: testDb1Path,
          },
        ],
        files: [
          {
            name: 'convenience-file',
            path: testFile1Path,
            compress: false,
          },
        ],
      }

      const summary = await createBackup(config)

      expect(summary.results).toHaveLength(2)
      expect(summary.successCount).toBe(2)
      expect(summary.failureCount).toBe(0)
      expect(summary.databaseBackups).toHaveLength(1)
      expect(summary.fileBackups).toHaveLength(1)
    })
  })

  describe('empty configurations', () => {
    it('should handle configuration with no databases or files', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [],
        files: [],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(0)
      expect(summary.successCount).toBe(0)
      expect(summary.failureCount).toBe(0)
      expect(summary.databaseBackups).toHaveLength(0)
      expect(summary.fileBackups).toHaveLength(0)
    })

    it('should handle configuration with only databases', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [
          {
            type: 'sqlite',
            name: 'only-db',
            path: testDb1Path,
          },
        ],
        files: [],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(1)
      expect(summary.databaseBackups).toHaveLength(1)
      expect(summary.fileBackups).toHaveLength(0)
    })

    it('should handle configuration with only files', async () => {
      const config: BackupConfig = {
        verbose: false,
        outputPath: testOutputDir,
        databases: [],
        files: [
          {
            name: 'only-file',
            path: testFile1Path,
            compress: false,
          },
        ],
      }

      const manager = new BackupManager(config)
      const summary = await manager.createBackup()

      expect(summary.results).toHaveLength(1)
      expect(summary.databaseBackups).toHaveLength(0)
      expect(summary.fileBackups).toHaveLength(1)
    })
  })
})
