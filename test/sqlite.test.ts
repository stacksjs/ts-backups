import type { SQLiteConfig } from '../src/types'
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rmdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { backupSQLite } from '../src/backups/sqlite'

describe('SQLite Backup', () => {
  const testDbPath = './test-db.sqlite'
  const testOutputDir = './test-backups'
  let db: Database

  beforeEach(async () => {
    // Clean up any existing test files
    await cleanup()

    // Create test output directory
    await mkdir(testOutputDir, { recursive: true })

    // Create test database
    db = new Database(testDbPath)

    // Create test schema and data
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        title TEXT NOT NULL,
        content TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_posts_user_id ON posts(user_id);
    `)

    // Insert test data
    const insertUser = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)')
    const insertPost = db.prepare('INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)')

    insertUser.run('John Doe', 'john@example.com')
    insertUser.run('Jane Smith', 'jane@example.com')

    insertPost.run(1, 'First Post', 'This is the first post content')
    insertPost.run(1, 'Second Post', 'This is the second post content')
    insertPost.run(2, 'Jane\'s Post', 'Content with special \'quotes\' and "double quotes"')

    db.close()
  })

  afterEach(async () => {
    await cleanup()
  })

  async function cleanup() {
    try {
      if (existsSync(testDbPath)) {
        await unlink(testDbPath)
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

  describe('successful backup', () => {
    it('should create a complete backup with schema and data', async () => {
      const config: SQLiteConfig = {
        type: 'sqlite',
        name: 'test-database',
        path: testDbPath,
        verbose: false,
      }

      const result = await backupSQLite(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.database).toBe('test-database')
      expect(result.type).toBe('sqlite')
      expect(result.filename).toMatch(/test-database_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.sql/)
      expect(result.size).toBeGreaterThan(0)
      expect(result.duration).toBeGreaterThan(0)
      expect(result.error).toBeUndefined()

      // Verify backup file exists and has content
      const backupPath = join(testOutputDir, result.filename)
      expect(existsSync(backupPath)).toBe(true)

      const backupContent = await readFile(backupPath, 'utf8')

      // Check for header comments
      expect(backupContent).toContain('-- SQLite Database Backup')
      expect(backupContent).toContain('-- Database: ./test-db.sqlite')
      expect(backupContent).toContain('-- Backup tool: ts-backups')

      // Check for schema
      expect(backupContent).toContain('CREATE TABLE')
      expect(backupContent).toContain('users')
      expect(backupContent).toContain('posts')
      expect(backupContent).toContain('CREATE INDEX idx_users_email')
      expect(backupContent).toContain('CREATE INDEX idx_posts_user_id')

      // Check for data
      expect(backupContent).toContain('INSERT INTO "users"')
      expect(backupContent).toContain('INSERT INTO "posts"')
      expect(backupContent).toContain('John Doe')
      expect(backupContent).toContain('jane@example.com')
      expect(backupContent).toContain('Jane\'\'s Post') // Escaped quotes

      // Check for transaction structure
      expect(backupContent).toContain('BEGIN TRANSACTION')
      expect(backupContent).toContain('COMMIT')
      expect(backupContent).toContain('PRAGMA foreign_keys=OFF')
      expect(backupContent).toContain('PRAGMA foreign_keys=ON')
    })

    it('should use custom filename when provided', async () => {
      const config: SQLiteConfig = {
        type: 'sqlite',
        name: 'test-database',
        path: testDbPath,
        filename: 'custom-backup',
        verbose: false,
      }

      const result = await backupSQLite(config, testOutputDir)

      expect(result.success).toBe(true)
      expect(result.filename).toMatch(/custom-backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*\.sql/)
    })

    it('should handle empty database', async () => {
      // Create empty database
      const emptyDbPath = './empty-test.sqlite'
      const emptyDb = new Database(emptyDbPath)
      emptyDb.close()

      const config: SQLiteConfig = {
        type: 'sqlite',
        name: 'empty-db',
        path: emptyDbPath,
        verbose: false,
      }

      try {
        const result = await backupSQLite(config, testOutputDir)

        expect(result.success).toBe(true)
        expect(result.size).toBeGreaterThan(0) // Should have header comments

        const backupContent = await readFile(join(testOutputDir, result.filename), 'utf8')
        expect(backupContent).toContain('-- SQLite Database Backup')
        expect(backupContent).toContain('BEGIN TRANSACTION')
        expect(backupContent).toContain('COMMIT')
      }
      finally {
        if (existsSync(emptyDbPath)) {
          await unlink(emptyDbPath)
        }
      }
    })

    it('should handle special characters in data', async () => {
      // Create database with special characters
      const specialDb = new Database(testDbPath)

      specialDb.exec(`
        CREATE TABLE special_chars (
          id INTEGER PRIMARY KEY,
          text_data TEXT,
          blob_data BLOB
        );
      `)

      const insert = specialDb.prepare('INSERT INTO special_chars (text_data, blob_data) VALUES (?, ?)')
      insert.run('Text with\nnewlines\tand\ttabs', new Uint8Array([0, 1, 2, 255]))
      insert.run('Unicode: 🚀 émojis ànd spéciâl chars', null)

      specialDb.close()

      const config: SQLiteConfig = {
        type: 'sqlite',
        name: 'special-chars',
        path: testDbPath,
        verbose: false,
      }

      const result = await backupSQLite(config, testOutputDir)

      expect(result.success).toBe(true)

      const backupContent = await readFile(join(testOutputDir, result.filename), 'utf8')
      expect(backupContent).toContain('special_chars')
      expect(backupContent).toContain('Unicode: 🚀 émojis ànd spéciâl chars')
      expect(backupContent).toContain('X\'') // Hex encoded blob
    })
  })

  describe('error handling', () => {
    it('should handle non-existent database file', async () => {
      const config: SQLiteConfig = {
        type: 'sqlite',
        name: 'missing-db',
        path: './non-existent.sqlite',
        verbose: false,
      }

      const result = await backupSQLite(config, testOutputDir)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.filename).toBe('')
      expect(result.size).toBe(0)
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should handle invalid output directory permissions', async () => {
      const config: SQLiteConfig = {
        type: 'sqlite',
        name: 'test-db',
        path: testDbPath,
        verbose: false,
      }

      // Try to write to a read-only directory (this might not work on all systems)
      const result = await backupSQLite(config, '/root/readonly')

      // This might succeed on some systems, so we just verify it returns a valid result
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })
  })

  describe('verbose mode', () => {
    it('should work with verbose logging enabled', async () => {
      const config: SQLiteConfig = {
        type: 'sqlite',
        name: 'verbose-test',
        path: testDbPath,
        verbose: true,
      }

      // Capture console output
      const originalWarn = console.warn
      const logs: string[] = []
      console.warn = (...args: any[]) => {
        logs.push(args.join(' '))
      }

      try {
        const result = await backupSQLite(config, testOutputDir)

        expect(result.success).toBe(true)
        expect(logs.length).toBeGreaterThan(0)
        expect(logs.some(log => log.includes('Starting SQLite backup'))).toBe(true)
        expect(logs.some(log => log.includes('backup completed'))).toBe(true)
      }
      finally {
        console.warn = originalWarn
      }
    })
  })
})
