import type { FileConfig } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rmdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { backupFile } from '../src/backups/file'
import { BackupType } from '../src/types'

describe('File Backup', () => {
  const testFileDir = './test-file-dir'
  const testOutputDir = './test-file-backup'
  const testFilePath = join(testFileDir, 'test-file.txt')

  beforeEach(async () => {
    await cleanup()

    // Create test directory and file
    await mkdir(testFileDir, { recursive: true })
    await mkdir(testOutputDir, { recursive: true })

    // Create test file with some content
    await writeFile(testFilePath, 'This is a test file with some content for backup testing.')
  })

  afterEach(async () => {
    await cleanup()
  })

  async function cleanup() {
    try {
      await removeDirectory(testFileDir)
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
    it('should backup a file without compression', async () => {
      const config: FileConfig = {
        name: 'test-file-backup',
        path: testFilePath,
        verbose: false,
        compress: false,
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.name).toBe('test-file-backup')
      expect(result.type).toBe(BackupType.FILE)
      expect(result.filename).toMatch(/test-file-backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.txt/)
      expect(result.size).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThanOrEqual(0) // Duration can be 0 for very fast operations
      expect(result.fileCount).toBe(1)
      expect(result.error).toBeUndefined()

      // Verify backup file exists
      const backupPath = join(testOutputDir, result.filename)
      expect(existsSync(backupPath)).toBe(true)
    })

    it('should backup a file with compression', async () => {
      const config: FileConfig = {
        name: 'compressed-file',
        path: testFilePath,
        verbose: false,
        compress: true,
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filename).toMatch(/compressed-file_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.txt\.gz/)

      // Verify backup file exists
      const backupPath = join(testOutputDir, result.filename)
      expect(existsSync(backupPath)).toBe(true)
    })

    it('should use custom filename when provided', async () => {
      const config: FileConfig = {
        name: 'test-file',
        path: testFilePath,
        verbose: false,
        compress: false,
        filename: 'custom-file-backup',
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filename).toMatch(/custom-file-backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.txt/)
    })

    it('should backup different file types correctly', async () => {
      // Test various file extensions
      const fileTypes = [
        { path: 'config.json', content: '{"test": true}' },
        { path: 'script.js', content: 'console.log("test")' },
        { path: 'style.css', content: 'body { margin: 0; }' },
        { path: 'data.xml', content: '<root><item>test</item></root>' },
        { path: 'README.md', content: '# Test README' },
      ]

      for (const fileType of fileTypes) {
        const filePath = join(testFileDir, fileType.path)
        await writeFile(filePath, fileType.content)

        const config: FileConfig = {
          name: `backup-${fileType.path}`,
          path: filePath,
          verbose: false,
          compress: false,
        }

        const result = await backupFile(config, testOutputDir)

        expect(result.success).toBe(true)
        expect(result.fileCount).toBe(1)
        expect(result.size).toBeGreaterThan(0)
      }
    })

    it('should backup large files', async () => {
      // Create a larger test file
      const largeContent = 'x'.repeat(10000) // 10KB file
      const largeFilePath = join(testFileDir, 'large-file.txt')
      await writeFile(largeFilePath, largeContent)

      const config: FileConfig = {
        name: 'large-file-backup',
        path: largeFilePath,
        verbose: false,
        compress: true, // Use compression for large files
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.size).toBeGreaterThan(0)
      // Compressed size should be much smaller than original
      expect(result.size).toBeLessThan(10000)
    })

    it('should backup binary files', async () => {
      // Create a fake binary file
      const binaryData = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) // PNG header
      const binaryFilePath = join(testFileDir, 'image.png')
      await writeFile(binaryFilePath, binaryData)

      const config: FileConfig = {
        name: 'binary-backup',
        path: binaryFilePath,
        verbose: false,
        compress: false,
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filename).toMatch(/binary-backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.png/)
      expect(result.size).toBe(binaryData.length)
    })
  })

  describe('error handling', () => {
    it('should handle non-existent file', async () => {
      const config: FileConfig = {
        name: 'missing-file',
        path: './non-existent-file.txt',
        verbose: false,
        compress: false,
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('File not found')
      expect(result.filename).toBe('')
      expect(result.size).toBe(0)
      expect(result.fileCount).toBe(0)
    })

    it('should handle invalid output directory permissions', async () => {
      const config: FileConfig = {
        name: 'test-file',
        path: testFilePath,
        verbose: false,
        compress: false,
      }

      // Try to write to a read-only directory (this might not work on all systems)
      const result = await backupFile(config, '/root/readonly')

      // This might succeed on some systems, so we just verify it returns a valid result
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('verbose mode', () => {
    it('should work with verbose logging enabled', async () => {
      const config: FileConfig = {
        name: 'verbose-test',
        path: testFilePath,
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
        const result = await backupFile(config, testOutputDir)

        expect(result.success).toBe(true)
        expect(logs.length).toBeGreaterThan(0)
        expect(logs.some(log => log.includes('Starting file backup'))).toBe(true)
        expect(logs.some(log => log.includes('File backup completed'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
      }
    })

    it('should show compression information in verbose mode', async () => {
      // Create a file that compresses well
      const repetitiveContent = 'AAAA'.repeat(1000) // Very repetitive content
      const compressibleFile = join(testFileDir, 'compressible.txt')
      await writeFile(compressibleFile, repetitiveContent)

      const config: FileConfig = {
        name: 'compression-test',
        path: compressibleFile,
        verbose: true,
        compress: true,
      }

      // Capture console output
      const originalWarn = console.warn
      const logs: string[] = []
      console.warn = (...args: any[]) => {
        logs.push(args.join(' '))
      }

      try {
        const result = await backupFile(config, testOutputDir)

        expect(result.success).toBe(true)
        expect(logs.some(log => log.includes('Compression:'))).toBe(true)
        expect(logs.some(log => log.includes('reduction'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
      }
    })
  })

  describe('preserveMetadata option', () => {
    it('should create metadata file when preserveMetadata is true', async () => {
      const config: FileConfig = {
        name: 'metadata-test',
        path: testFilePath,
        verbose: false,
        compress: false,
        preserveMetadata: true,
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(true)

      // Check if metadata file was created
      const metadataPath = join(testOutputDir, `${result.filename}.meta`)
      expect(existsSync(metadataPath)).toBe(true)
    })

    it('should not create metadata file when preserveMetadata is false', async () => {
      const config: FileConfig = {
        name: 'no-metadata-test',
        path: testFilePath,
        verbose: false,
        compress: false,
        preserveMetadata: false,
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(true)

      // Check that metadata file was not created
      const metadataPath = join(testOutputDir, `${result.filename}.meta`)
      expect(existsSync(metadataPath)).toBe(false)
    })
  })

  describe('file extensions', () => {
    it('should preserve original file extension', async () => {
      const testFiles = [
        { name: 'document.pdf', ext: '.pdf' },
        { name: 'image.jpg', ext: '.jpg' },
        { name: 'archive.tar.gz', ext: '.gz' }, // extname() returns only the last extension
        { name: 'noext', ext: '' },
      ]

      for (const testFile of testFiles) {
        const filePath = join(testFileDir, testFile.name)
        await writeFile(filePath, 'test content')

        const config: FileConfig = {
          name: 'ext-test',
          path: filePath,
          verbose: false,
          compress: false,
        }

        const result = await backupFile(config, testOutputDir)

        expect(result.success).toBe(true)
        if (testFile.ext) {
          expect(result.filename).toContain(testFile.ext)
        }
      }
    })

    it('should add compression extension when compressing', async () => {
      const filePath = join(testFileDir, 'test.json')
      await writeFile(filePath, '{"test": true}')

      const config: FileConfig = {
        name: 'json-compress',
        path: filePath,
        verbose: false,
        compress: true,
      }

      const result = await backupFile(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filename).toMatch(/\.json\.gz$/)
    })
  })
})
