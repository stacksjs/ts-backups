import type { BackupResult, PostgreSQLConfig } from '../types'
import { SQL } from 'bun'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BackupType } from '../types'
import { Logger } from '@stacksjs/clarity'

const logger = new Logger('backupx:postgresql')

function createConnectionString(connection: PostgreSQLConfig['connection']): string {
  if (typeof connection === 'string') {
    return connection
  }

  const { hostname = 'localhost', port = 5432, database, username = 'postgres', password, ssl } = connection

  let url = `postgres://${username}`
  if (password) {
    url += `:${password}`
  }
  url += `@${hostname}:${port}/${database}`

  if (ssl && typeof ssl === 'string') {
    url += `?sslmode=${ssl}`
  }
  else if (ssl === true) {
    url += `?sslmode=require`
  }

  return url
}

export async function backupPostgreSQL(
  config: PostgreSQLConfig,
  outputPath: string,
): Promise<BackupResult> {
  const startTime = performance.now()

  try {
    // Create SQL connection
    const connectionString = createConnectionString(config.connection)
    const db = new SQL(connectionString)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${config.filename || config.name}_${timestamp}.sql`
    const outputFile = join(outputPath, filename)

    if (config.verbose) {
      logger.warn(`📦 Starting PostgreSQL backup for: ${config.name}`)
      logger.warn(`💾 Output: ${outputFile}`)
    }

    const includeSchema = config.includeSchema !== false
    const includeData = config.includeData !== false

    // Get current database name
    const [{ current_database }] = await db`SELECT current_database()`

    let sqlDump = ''

    // Add header comment
    sqlDump += `-- PostgreSQL Database Backup\n`
    sqlDump += `-- Database: ${current_database}\n`
    sqlDump += `-- Generated: ${new Date().toISOString()}\n`
    sqlDump += `-- Backup tool: backupx\n\n`

    // Get tables to backup
    let tables: { table_name: string, table_schema: string }[]

    if (config.tables && config.tables.length > 0) {
      // Backup specific tables
      tables = await db`
        SELECT table_name, table_schema
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('information_schema', 'pg_catalog')
        AND table_name = ANY(${config.tables})
        ORDER BY table_schema, table_name
      `
    }
    else {
      // Backup all tables except excluded ones
      if (config.excludeTables && config.excludeTables.length > 0) {
        tables = await db`
          SELECT table_name, table_schema
          FROM information_schema.tables
          WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('information_schema', 'pg_catalog')
          AND table_name != ALL(${config.excludeTables})
          ORDER BY table_schema, table_name
        `
      }
      else {
        tables = await db`
          SELECT table_name, table_schema
          FROM information_schema.tables
          WHERE table_type = 'BASE TABLE'
          AND table_schema NOT IN ('information_schema', 'pg_catalog')
          ORDER BY table_schema, table_name
        `
      }
    }

    if (includeSchema) {
      sqlDump += `-- Schema\n`
      sqlDump += `SET statement_timeout = 0;\n`
      sqlDump += `SET lock_timeout = 0;\n`
      sqlDump += `SET client_encoding = 'UTF8';\n`
      sqlDump += `SET standard_conforming_strings = on;\n`
      sqlDump += `SET check_function_bodies = false;\n`
      sqlDump += `SET xmloption = content;\n`
      sqlDump += `SET client_min_messages = warning;\n\n`

      // Create schemas
      const schemas = [...new Set(tables.map(t => t.table_schema))]
      for (const schema of schemas) {
        if (schema !== 'public') {
          sqlDump += `CREATE SCHEMA IF NOT EXISTS "${schema}";\n`
        }
      }
      sqlDump += '\n'

      // Create tables
      for (const table of tables) {
        if (config.verbose) {
          logger.warn(`  📋 Backing up schema for table: ${table.table_schema}.${table.table_name}`)
        }

        // Get table definition using a simpler approach
        const columns = await db`
          SELECT
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
          FROM information_schema.columns
          WHERE table_schema = ${table.table_schema}
          AND table_name = ${table.table_name}
          ORDER BY ordinal_position
        ` as {
          column_name: string
          data_type: string
          character_maximum_length: number | null
          is_nullable: string
          column_default: string | null
        }[]

        if (columns.length > 0) {
          sqlDump += `-- Table: ${table.table_schema}.${table.table_name}\n`
          sqlDump += `DROP TABLE IF EXISTS "${table.table_schema}"."${table.table_name}" CASCADE;\n`

          const columnDefs = columns.map((col) => {
            let def = `"${col.column_name}" ${col.data_type.toUpperCase()}`

            if (col.character_maximum_length) {
              def += `(${col.character_maximum_length})`
            }

            if (col.is_nullable === 'NO') {
              def += ' NOT NULL'
            }

            if (col.column_default) {
              def += ` DEFAULT ${col.column_default}`
            }

            return def
          }).join(',\n  ')

          sqlDump += `CREATE TABLE "${table.table_schema}"."${table.table_name}" (\n  ${columnDefs}\n);\n\n`
        }
      }
    }

    if (includeData) {
      sqlDump += `-- Data\n`

      for (const table of tables) {
        if (config.verbose) {
          logger.warn(`  📊 Backing up data for table: ${table.table_schema}.${table.table_name}`)
        }

        // Get row count
        const [{ count }] = await db.unsafe(`SELECT COUNT(*) as count FROM "${table.table_schema}"."${table.table_name}"`) as [{ count: number }]

        if (count > 0) {
          sqlDump += `-- Data for table: ${table.table_schema}.${table.table_name} (${count} rows)\n`

          // Get column names
          const columns = await db`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = ${table.table_schema}
            AND table_name = ${table.table_name}
            ORDER BY ordinal_position
          ` as { column_name: string }[]

          const columnNames = columns.map(c => `"${c.column_name}"`).join(', ')

          // Process data in batches
          const batchSize = 1000
          for (let offset = 0; offset < count; offset += batchSize) {
            const rows = await db.unsafe(
              `SELECT ${columnNames} FROM "${table.table_schema}"."${table.table_name}" LIMIT ${batchSize} OFFSET ${offset}`,
            ) as Record<string, unknown>[]

            for (const row of rows) {
              const values = columns.map((col) => {
                const value = row[col.column_name]
                if (value === null || value === undefined)
                  return 'NULL'
                if (typeof value === 'string') {
                  return `'${value.replace(/'/g, '\'\'').replace(/\\/g, '\\\\')}'`
                }
                if (typeof value === 'boolean') {
                  return value ? 'true' : 'false'
                }
                if (value instanceof Date) {
                  return `'${value.toISOString()}'`
                }
                if (typeof value === 'object') {
                  return `'${JSON.stringify(value).replace(/'/g, '\'\'')}'`
                }
                return String(value)
              }).join(', ')

              sqlDump += `INSERT INTO "${table.table_schema}"."${table.table_name}" (${columnNames}) VALUES (${values});\n`
            }
          }
          sqlDump += '\n'
        }
      }
    }

    // Get indexes if schema is included
    if (includeSchema) {
      sqlDump += `-- Indexes\n`
      for (const table of tables) {
        const indexes = await db`
          SELECT indexname, indexdef
          FROM pg_indexes
          WHERE schemaname = ${table.table_schema}
          AND tablename = ${table.table_name}
          AND indexname NOT LIKE '%_pkey'
        ` as { indexname: string, indexdef: string }[]

        for (const index of indexes) {
          sqlDump += `${index.indexdef};\n`
        }
      }
      sqlDump += '\n'
    }

    // Write backup file
    await writeFile(outputFile, sqlDump, 'utf8')

    // Close connection
    await db.close()

    const endTime = performance.now()
    const duration = endTime - startTime
    const stats = await Bun.file(outputFile).stat()

    if (config.verbose) {
      logger.warn(`✅ PostgreSQL backup completed in ${duration.toFixed(2)}ms`)
      logger.warn(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
    }

    return {
      name: config.name,
      type: BackupType.POSTGRESQL,
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
      logger.error(`❌ PostgreSQL backup failed: ${errorMessage}`)
    }

    return {
      name: config.name,
      type: BackupType.POSTGRESQL,
      filename: '',
      size: 0,
      duration,
      success: false,
      error: errorMessage,
    }
  }
}
