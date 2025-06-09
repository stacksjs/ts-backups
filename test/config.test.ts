import { describe, expect, it } from 'bun:test'
import { defaultConfig } from '../src/config'

describe('Config', () => {
  describe('defaultConfig', () => {
    it('should have correct default values', () => {
      expect(defaultConfig.verbose).toBe(true)
      expect(defaultConfig.databases).toEqual([])
      expect(defaultConfig.outputPath).toBe('./backups')
      expect(defaultConfig.retention).toEqual({
        count: 5,
        maxAge: 30,
      })
    })

    it('should have proper structure', () => {
      expect(typeof defaultConfig.verbose).toBe('boolean')
      expect(Array.isArray(defaultConfig.databases)).toBe(true)
      expect(typeof defaultConfig.outputPath).toBe('string')
      expect(typeof defaultConfig.retention).toBe('object')
      expect(defaultConfig.retention).not.toBeNull()
    })

    it('should have valid retention policy', () => {
      expect(defaultConfig.retention?.count).toBeGreaterThan(0)
      expect(defaultConfig.retention?.maxAge).toBeGreaterThan(0)
    })
  })

  describe('configuration validation', () => {
    it('should accept valid SQLite database configuration', () => {
      const testConfig = {
        ...defaultConfig,
        databases: [
          {
            type: 'sqlite' as const,
            name: 'test-db',
            path: './test.sqlite',
          },
        ],
      }

      expect(testConfig.databases).toHaveLength(1)
      expect(testConfig.databases[0].type).toBe('sqlite')
      expect(testConfig.databases[0].name).toBe('test-db')
    })

    it('should accept valid PostgreSQL database configuration', () => {
      const testConfig = {
        ...defaultConfig,
        databases: [
          {
            type: 'postgresql' as const,
            name: 'pg-db',
            connection: 'postgres://user:pass@localhost/db',
          },
        ],
      }

      expect(testConfig.databases).toHaveLength(1)
      expect(testConfig.databases[0].type).toBe('postgresql')
      expect(testConfig.databases[0].name).toBe('pg-db')
    })

    it('should accept valid MySQL database configuration', () => {
      const testConfig = {
        ...defaultConfig,
        databases: [
          {
            type: 'mysql' as const,
            name: 'mysql-db',
            connection: {
              hostname: 'localhost',
              port: 3306,
              database: 'myapp',
              username: 'user',
              password: 'pass',
            },
          },
        ],
      }

      expect(testConfig.databases).toHaveLength(1)
      expect(testConfig.databases[0].type).toBe('mysql')
      expect(testConfig.databases[0].name).toBe('mysql-db')
    })

    it('should accept multiple database configurations', () => {
      const testConfig = {
        ...defaultConfig,
        databases: [
          {
            type: 'sqlite' as const,
            name: 'sqlite-db',
            path: './app.sqlite',
          },
          {
            type: 'postgresql' as const,
            name: 'postgres-db',
            connection: 'postgres://user:pass@localhost/app',
          },
          {
            type: 'mysql' as const,
            name: 'mysql-db',
            connection: 'mysql://user:pass@localhost/app',
          },
        ],
      }

      expect(testConfig.databases).toHaveLength(3)
      expect(testConfig.databases.map(db => db.type)).toEqual(['sqlite', 'postgresql', 'mysql'])
    })
  })

  describe('retention policy configuration', () => {
    it('should accept count-based retention', () => {
      const testConfig = {
        ...defaultConfig,
        retention: {
          count: 10,
        },
      }

      expect(testConfig.retention.count).toBe(10)
      expect('maxAge' in testConfig.retention).toBe(false)
    })

    it('should accept age-based retention', () => {
      const testConfig = {
        ...defaultConfig,
        retention: {
          maxAge: 7,
        },
      }

      expect(testConfig.retention.maxAge).toBe(7)
      expect('count' in testConfig.retention).toBe(false)
    })

    it('should accept combined retention policy', () => {
      const testConfig = {
        ...defaultConfig,
        retention: {
          count: 5,
          maxAge: 14,
        },
      }

      expect(testConfig.retention.count).toBe(5)
      expect(testConfig.retention.maxAge).toBe(14)
    })

    it('should work without retention policy', () => {
      const testConfig = {
        ...defaultConfig,
        retention: undefined,
      }

      expect(testConfig.retention).toBeUndefined()
    })
  })

  describe('output path configuration', () => {
    it('should accept custom output path', () => {
      const testConfig = {
        ...defaultConfig,
        outputPath: '/custom/backup/path',
      }

      expect(testConfig.outputPath).toBe('/custom/backup/path')
    })

    it('should accept relative output path', () => {
      const testConfig = {
        ...defaultConfig,
        outputPath: '../backups',
      }

      expect(testConfig.outputPath).toBe('../backups')
    })

    it('should work without output path (undefined)', () => {
      const testConfig = {
        ...defaultConfig,
        outputPath: undefined,
      }

      expect(testConfig.outputPath).toBeUndefined()
    })
  })

  describe('verbose configuration', () => {
    it('should accept verbose true', () => {
      const testConfig = {
        ...defaultConfig,
        verbose: true,
      }

      expect(testConfig.verbose).toBe(true)
    })

    it('should accept verbose false', () => {
      const testConfig = {
        ...defaultConfig,
        verbose: false,
      }

      expect(testConfig.verbose).toBe(false)
    })
  })
})
