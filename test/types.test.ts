import type { BackupConfig, BackupResult, MySQLConfig, PostgreSQLConfig, SQLiteConfig } from '../src/types'
import { describe, expect, it } from 'bun:test'
import { BackupType } from '../src/types'

describe('Types', () => {
  describe('DatabaseConfig', () => {
    it('should accept SQLite configuration', () => {
      const config: SQLiteConfig = {
        type: BackupType.SQLITE,
        name: 'test-db',
        path: './test.sqlite',
        verbose: true,
        compress: false,
        filename: 'custom-backup',
      }

      expect(config.type).toBe(BackupType.SQLITE)
      expect(config.name).toBe('test-db')
      expect(config.path).toBe('./test.sqlite')
    })

    it('should accept PostgreSQL configuration with connection string', () => {
      const config: PostgreSQLConfig = {
        type: BackupType.POSTGRESQL,
        name: 'pg-db',
        connection: 'postgres://user:pass@localhost:5432/mydb',
        tables: ['users', 'orders'],
        excludeTables: ['logs'],
        includeSchema: true,
        includeData: true,
      }

      expect(config.type).toBe(BackupType.POSTGRESQL)
      expect(config.connection).toBe('postgres://user:pass@localhost:5432/mydb')
      expect(config.tables).toEqual(['users', 'orders'])
    })

    it('should accept PostgreSQL configuration with connection object', () => {
      const config: PostgreSQLConfig = {
        type: BackupType.POSTGRESQL,
        name: 'pg-db',
        connection: {
          hostname: 'localhost',
          port: 5432,
          database: 'mydb',
          username: 'user',
          password: 'pass',
          ssl: 'require',
        },
      }

      expect(config.type).toBe(BackupType.POSTGRESQL)
      expect(typeof config.connection).toBe('object')
      expect((config.connection as any).database).toBe('mydb')
    })

    it('should accept MySQL configuration', () => {
      const config: MySQLConfig = {
        type: BackupType.MYSQL,
        name: 'mysql-db',
        connection: {
          hostname: 'localhost',
          port: 3306,
          database: 'myapp',
          username: 'root',
          password: 'secret',
          ssl: true,
        },
        excludeTables: ['cache', 'sessions'],
      }

      expect(config.type).toBe(BackupType.MYSQL)
      expect(config.excludeTables).toEqual(['cache', 'sessions'])
    })
  })

  describe('BackupConfig', () => {
    it('should accept complete backup configuration', () => {
      const config: BackupConfig = {
        verbose: true,
        databases: [
          {
            type: BackupType.SQLITE,
            name: 'app-db',
            path: './app.sqlite',
          },
          {
            type: BackupType.POSTGRESQL,
            name: 'main-db',
            connection: 'postgres://user:pass@localhost/app',
          },
        ],
        files: [],
        outputPath: './backups',
        retention: {
          count: 5,
          maxAge: 30,
        },
      }

      expect(config.verbose).toBe(true)
      expect(config.databases).toHaveLength(2)
      expect(config.outputPath).toBe('./backups')
      expect(config.retention?.count).toBe(5)
      expect(config.retention?.maxAge).toBe(30)
    })

    it('should work with minimal configuration', () => {
      const config: BackupConfig = {
        verbose: false,
        databases: [],
        files: [],
      }

      expect(config.verbose).toBe(false)
      expect(config.databases).toEqual([])
      expect(config.outputPath).toBeUndefined()
      expect(config.retention).toBeUndefined()
    })
  })

  describe('BackupResult', () => {
    it('should represent successful backup result', () => {
      const result: BackupResult = {
        name: 'test-db',
        type: BackupType.SQLITE,
        filename: 'test-db_2023-12-01.sql',
        size: 1024,
        duration: 500,
        success: true,
      }

      expect(result.success).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.size).toBeGreaterThan(0)
    })

    it('should represent failed backup result', () => {
      const result: BackupResult = {
        name: 'test-db',
        type: BackupType.POSTGRESQL,
        filename: '',
        size: 0,
        duration: 100,
        success: false,
        error: 'Connection failed',
      }

      expect(result.success).toBe(false)
      expect(result.error).toBe('Connection failed')
      expect(result.size).toBe(0)
    })
  })
})
