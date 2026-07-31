import type { BackupResult, SQLiteConfig } from '../types'
import { Database } from 'bun:sqlite'
import { existsSync } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Logger } from '@stacksjs/clarity'
import { BackupType } from '../types'

const logger = new Logger('ts-backups:sqlite')

/**
 * Capture a database with SQLite's own `VACUUM INTO`.
 *
 * SQLite runs this inside a read transaction, so the copy is a consistent
 * snapshot even while the database is being written to - which a plain file
 * copy is not, because it races the WAL and can land mid-checkpoint. The result
 * is a compact, fully formed database file rather than a script to replay.
 */
async function backupSQLiteFile(
  config: SQLiteConfig,
  outputPath: string,
  startTime: number,
): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${config.filename || config.name}_${timestamp}.sqlite`
  const outputFile = join(outputPath, filename)

  try {
    if (config.verbose) {
      logger.warn(`📦 Starting SQLite file backup for: ${config.name}`)
      logger.warn(`📄 Database: ${config.path}`)
      logger.warn(`💾 Output: ${outputFile}`)
    }

    // Readonly still permits VACUUM INTO: it only reads the source.
    const db = new Database(config.path, { readonly: true })

    try {
      // VACUUM INTO refuses to overwrite, so a stale file from an interrupted
      // run would otherwise fail the backup rather than replace it.
      if (existsSync(outputFile))
        await unlink(outputFile)

      // Bound as a parameter: a path is caller-supplied and quoting it by hand
      // is how a stray apostrophe becomes a syntax error at backup time.
      db.query('VACUUM INTO ?').run(outputFile)
    }
    finally {
      db.close()
    }

    const duration = performance.now() - startTime
    const stats = await Bun.file(outputFile).stat()

    if (config.verbose) {
      logger.warn(`✅ SQLite file backup completed in ${duration.toFixed(2)}ms`)
      logger.warn(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    }

    return {
      name: config.name,
      type: BackupType.SQLITE,
      filename,
      size: stats.size,
      duration,
      success: true,
    }
  }
  catch (error) {
    const duration = performance.now() - startTime
    const message = error instanceof Error ? error.message : String(error)

    logger.error(`❌ SQLite file backup failed for ${config.name}: ${message}`)

    return {
      name: config.name,
      type: BackupType.SQLITE,
      filename,
      size: 0,
      duration,
      success: false,
      error: message,
    }
  }
}

export async function backupSQLite(
  config: SQLiteConfig,
  outputPath: string,
): Promise<BackupResult> {
  const startTime = performance.now()

  if (config.mode === 'file')
    return backupSQLiteFile(config, outputPath, startTime)

  try {
    // Open the SQLite database
    const db = new Database(config.path, { readonly: true })

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${config.filename || config.name}_${timestamp}.sql`
    const outputFile = join(outputPath, filename)

    if (config.verbose) {
      logger.warn(`📦 Starting SQLite backup for: ${config.name}`)
      logger.warn(`📄 Database: ${config.path}`)
      logger.warn(`💾 Output: ${outputFile}`)
    }

    // Get all table names
    const tables = db.query(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as { name: string }[]

    let sqlDump = ''

    // Add header comment
    sqlDump += `-- SQLite Database Backup\n`
    sqlDump += `-- Database: ${config.path}\n`
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`
    sqlDump += `-- Backup tool: ts-backups\n\n`

    // Enable foreign keys for restore
    sqlDump += `PRAGMA foreign_keys=OFF;\n`
    sqlDump += `BEGIN TRANSACTION;\n\n`

    for (const table of tables) {
      if (config.verbose) {
        logger.warn(`  📋 Backing up table: ${table.name}`)
      }

      // Get table schema
      const schema = db.query(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name = ?
      `).get(table.name) as { sql: string } | undefined

      if (schema?.sql) {
        sqlDump += `-- Table: ${table.name}\n`
        sqlDump += `DROP TABLE IF EXISTS "${table.name}";\n`
        sqlDump += `${schema.sql};\n\n`

        // Get table data
        const rows = db.query(`SELECT * FROM "${table.name}"`).all() as Record<string, unknown>[]

        if (rows.length > 0) {
          // Get column names from first row
          const columns = Object.keys(rows[0])
          const columnList = columns.map(col => `"${col}"`).join(', ')

          sqlDump += `-- Data for table: ${table.name}\n`

          // Insert data in batches
          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100)

            for (const row of batch) {
              const values = columns.map((col) => {
                const value = row[col]
                if (value === null || value === undefined)
                  return 'NULL'
                if (typeof value === 'string') {
                  return `'${value.replace(/'/g, '\'\'')}'`
                }
                if (value instanceof Uint8Array) {
                  return `X'${Array.from(value).map(b => b.toString(16).padStart(2, '0')).join('')}'`
                }
                return String(value)
              }).join(', ')

              sqlDump += `INSERT INTO "${table.name}" (${columnList}) VALUES (${values});\n`
            }
          }
          sqlDump += '\n'
        }
      }
    }

    // Get indexes
    const indexes = db.query(`
      SELECT sql FROM sqlite_master
      WHERE type='index' AND sql IS NOT NULL
      ORDER BY name
    `).all() as { sql: string }[]

    if (indexes.length > 0) {
      sqlDump += `-- Indexes\n`
      for (const index of indexes) {
        sqlDump += `${index.sql};\n`
      }
      sqlDump += '\n'
    }

    // Get triggers
    const triggers = db.query(`
      SELECT sql FROM sqlite_master
      WHERE type='trigger'
      ORDER BY name
    `).all() as { sql: string }[]

    if (triggers.length > 0) {
      sqlDump += `-- Triggers\n`
      for (const trigger of triggers) {
        sqlDump += `${trigger.sql};\n`
      }
      sqlDump += '\n'
    }

    sqlDump += `COMMIT;\n`
    sqlDump += `PRAGMA foreign_keys=ON;\n`

    // Close database
    db.close()

    // Write backup file
    await writeFile(outputFile, sqlDump, 'utf8')

    const endTime = performance.now()
    const duration = endTime - startTime
    const stats = await Bun.file(outputFile).stat()

    if (config.verbose) {
      logger.warn(`✅ SQLite backup completed in ${duration.toFixed(2)}ms`)
      logger.warn(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    }

    return {
      name: config.name,
      type: BackupType.SQLITE,
      filename,
      size: stats.size,
      duration,
      success: true,
    }
  }
  catch (error) {
    const endTime = performance.now()
    const duration = endTime - startTime

    const errorMessage = error instanceof Error ? error.message : String(error)

    if (config.verbose) {
      logger.error(`❌ SQLite backup failed: ${errorMessage}`)
    }

    return {
      name: config.name,
      type: BackupType.SQLITE,
      filename: '',
      size: 0,
      duration,
      success: false,
      error: errorMessage,
    }
  }
}
