import { describe, expect, it } from 'bun:test'

// Import all test modules to ensure they run
import './types.test'
import './config.test'
import './sqlite.test'
import './backup-manager.test'

// Basic integration tests
describe('backupx', () => {
  it('should export main modules', async () => {
    const { BackupManager, createBackup, defaultConfig } = await import('../src')

    expect(BackupManager).toBeDefined()
    expect(typeof BackupManager).toBe('function')
    expect(createBackup).toBeDefined()
    expect(typeof createBackup).toBe('function')
    expect(defaultConfig).toBeDefined()
    expect(typeof defaultConfig).toBe('object')
  })

  it('should export all types', async () => {
    const types = await import('../src/types')

    // Types should be imported without runtime values
    expect(types).toBeDefined()
  })

  it('should export backup functions', async () => {
    const { backupSQLite, backupPostgreSQL, backupMySQL } = await import('../src/backups')

    expect(backupSQLite).toBeDefined()
    expect(typeof backupSQLite).toBe('function')
    expect(backupPostgreSQL).toBeDefined()
    expect(typeof backupPostgreSQL).toBe('function')
    expect(backupMySQL).toBeDefined()
    expect(typeof backupMySQL).toBe('function')
  })
})
