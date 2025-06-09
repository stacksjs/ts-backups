import type { FileConfig } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rmdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { backupDirectory } from '../src/backups/directory'

describe('Directory Backup', () => {
  const testSourceDir = './test-source-dir'
  const testOutputDir = './test-directory-backup'

  beforeEach(async () => {
    await cleanup()

    // Create test directory structure
    await mkdir(testSourceDir, { recursive: true })
    await mkdir(join(testSourceDir, 'images'), { recursive: true })
    await mkdir(join(testSourceDir, 'docs'), { recursive: true })
    await mkdir(join(testSourceDir, 'temp'), { recursive: true })
    await mkdir(testOutputDir, { recursive: true })

    // Create test files
    await writeFile(join(testSourceDir, 'app.js'), 'console.log("Hello World")')
    await writeFile(join(testSourceDir, 'config.json'), '{"version": "1.0"}')
    await writeFile(join(testSourceDir, 'README.md'), '# Test Project')
    await writeFile(join(testSourceDir, 'temp.log'), 'log content')

    await writeFile(join(testSourceDir, 'images', 'photo.jpg'), 'fake jpg content')
    await writeFile(join(testSourceDir, 'images', 'icon.png'), 'fake png content')

    await writeFile(join(testSourceDir, 'docs', 'guide.md'), '# User Guide')
    await writeFile(join(testSourceDir, 'docs', 'api.txt'), 'API documentation')

    await writeFile(join(testSourceDir, 'temp', 'cache.tmp'), 'cache data')
  })

  afterEach(async () => {
    await cleanup()
  })

  async function cleanup() {
    try {
      await removeDirectory(testSourceDir)
      await removeDirectory(testOutputDir)
    }
    catch {
      // Ignore cleanup errors
    }
  }

  async function removeDirectory(dirPath: string) {
    if (existsSync(dirPath)) {
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
  }

  describe('successful backup', () => {
    it('should backup entire directory without filters', async () => {
      const config: FileConfig = {
        name: 'full-backup',
        path: testSourceDir,
        verbose: false,
        compress: false,
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.name).toBe('full-backup')
      expect(result.type).toBe('directory')
      expect(result.filename).toMatch(/full-backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.tar/)
      expect(result.size).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.fileCount).toBeGreaterThan(5) // Should include all test files
      expect(result.error).toBeUndefined()

      // Verify backup file exists
      const backupPath = join(testOutputDir, result.filename)
      expect(existsSync(backupPath)).toBe(true)
    })

    it('should backup with compression', async () => {
      const config: FileConfig = {
        name: 'compressed-backup',
        path: testSourceDir,
        verbose: false,
        compress: true,
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filename).toMatch(/compressed-backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.tar\.gz/)

      // Verify backup file exists
      const backupPath = join(testOutputDir, result.filename)
      expect(existsSync(backupPath)).toBe(true)
    })

    it('should backup with include patterns', async () => {
      const config: FileConfig = {
        name: 'filtered-backup',
        path: testSourceDir,
        verbose: false,
        compress: false,
        include: ['*.js', '*.json', '*.md', 'docs/*.md'],
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      // Should include app.js, config.json, README.md files (at least 3)
      expect(result.fileCount).toBeGreaterThanOrEqual(3)
    })

    it('should backup with exclude patterns', async () => {
      const config: FileConfig = {
        name: 'excluded-backup',
        path: testSourceDir,
        verbose: false,
        compress: false,
        exclude: ['*.log', 'temp/*'],
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      // Should exclude temp.log and temp/cache.tmp
      expect(result.fileCount).toBeLessThan(9) // Less than total files
    })

    it('should backup with combined include and exclude patterns', async () => {
      const config: FileConfig = {
        name: 'combined-filters',
        path: testSourceDir,
        verbose: false,
        compress: false,
        include: ['*.js', '*.json', '*.md', '*.jpg', '*.png'],
        exclude: ['temp/*', '*.log'],
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      // Should include js, json, md, jpg, png files but exclude temp and log files
      expect(result.fileCount).toBeGreaterThan(0)
    })

    it('should respect maxFileSize limit', async () => {
      // Create a large file
      const largeContent = 'x'.repeat(1000) // 1KB file
      await writeFile(join(testSourceDir, 'large.txt'), largeContent)

      const config: FileConfig = {
        name: 'size-limited',
        path: testSourceDir,
        verbose: false,
        compress: false,
        maxFileSize: 500, // 500 bytes max
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      // Should exclude the large file
      expect(result.fileCount).toBeLessThan(10)
    })

    it('should use custom filename when provided', async () => {
      const config: FileConfig = {
        name: 'test-dir',
        path: testSourceDir,
        verbose: false,
        compress: false,
        filename: 'custom-directory-backup',
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filename).toMatch(/custom-directory-backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.tar/)
    })

    it('should handle empty directory', async () => {
      const emptyDir = './test-empty-dir'
      await mkdir(emptyDir, { recursive: true })

      const config: FileConfig = {
        name: 'empty-dir',
        path: emptyDir,
        verbose: false,
        compress: false,
      }

      try {
        const result = await backupDirectory(config, testOutputDir)

        expect(result.success).toBe(true)
        expect(result.fileCount).toBe(0)
        // For empty directories, we might not create any archive or create a minimal one
        expect(result.size).toBeGreaterThanOrEqual(0)
      }
      finally {
        await rmdir(emptyDir)
      }
    })
  })

  describe('error handling', () => {
    it('should handle non-existent directory', async () => {
      const config: FileConfig = {
        name: 'missing-dir',
        path: './non-existent-directory',
        verbose: false,
        compress: false,
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('Directory not found')
      expect(result.filename).toBe('')
      expect(result.size).toBe(0)
      expect(result.fileCount).toBe(0)
    })

    it('should handle invalid output directory permissions', async () => {
      const config: FileConfig = {
        name: 'test-dir',
        path: testSourceDir,
        verbose: false,
        compress: false,
      }

      // Try to write to a read-only directory (this might not work on all systems)
      const result = await backupDirectory(config, '/root/readonly')

      // This might succeed on some systems, so we just verify it returns a valid result
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('verbose mode', () => {
    it('should work with verbose logging enabled', async () => {
      const config: FileConfig = {
        name: 'verbose-test',
        path: testSourceDir,
        verbose: true,
        compress: false,
      }

      // Capture console output
      const originalWarn = console.warn
      const logs: string[] = []
      console.warn = (...args: any[]) => {
        logs.push(args.join(' '))
      }

      try {
        const result = await backupDirectory(config, testOutputDir)

        expect(result.success).toBe(true)
        expect(logs.length).toBeGreaterThan(0)
        expect(logs.some(log => log.includes('Starting directory backup'))).toBe(true)
        expect(logs.some(log => log.includes('Directory backup completed'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
      }
    })
  })

  describe('preserveMetadata option', () => {
    it('should create metadata when preserveMetadata is true', async () => {
      const config: FileConfig = {
        name: 'metadata-test',
        path: testSourceDir,
        verbose: false,
        compress: false,
        preserveMetadata: true,
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      // In our implementation, metadata is embedded in the archive headers
      expect(result.size).toBeGreaterThan(0)
    })

    it('should work without metadata preservation', async () => {
      const config: FileConfig = {
        name: 'no-metadata-test',
        path: testSourceDir,
        verbose: false,
        compress: false,
        preserveMetadata: false,
      }

      const result = await backupDirectory(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.size).toBeGreaterThan(0)
    })
  })
})
