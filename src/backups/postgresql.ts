import type { BackupResult, PostgreSQLConfig } from '../types'
import { open, unlink } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { BackupType } from '../types'

/** Engine-native, transactionally consistent export, with credentials outside argv. */
export function postgresDumpOptions(config: PostgreSQLConfig): { args: string[], env: Record<string, string> } {
  const connection = typeof config.connection === 'string' ? new URL(config.connection) : config.connection
  const values = connection instanceof URL
    ? { hostname: connection.hostname, port: Number(connection.port || 5432), database: decodeURIComponent(connection.pathname.slice(1)), username: decodeURIComponent(connection.username), password: decodeURIComponent(connection.password), ssl: connection.searchParams.get('sslmode') || 'prefer' }
    : connection
  if (!values.database || config.includeSchema === false && config.includeData === false) throw new Error('PostgreSQL backup requires a database and schema or data')
  const env = { PGHOST: values.hostname || '127.0.0.1', PGPORT: String(values.port || 5432), PGDATABASE: values.database, PGUSER: values.username || 'postgres', PGPASSWORD: values.password || '', PGSSLMODE: values.ssl === true ? 'require' : values.ssl === false ? 'disable' : values.ssl || 'prefer' }
  const args = ['--no-password', '--no-owner', '--no-acl', '--format=plain']
  if (config.includeSchema === false) args.push('--data-only')
  if (config.includeData === false) args.push('--schema-only')
  for (const table of config.tables || []) args.push('--table', table)
  for (const table of config.excludeTables || []) args.push('--exclude-table', table)
  return { args, env }
}

export async function backupPostgreSQL(config: PostgreSQLConfig, outputPath: string): Promise<BackupResult> {
  const start = performance.now()
  let file: string | undefined
  let created = false
  try {
    const options = postgresDumpOptions(config)
    const name = config.filename || config.name
    if (!name || basename(name) !== name || name === '.' || name === '..') throw new Error('Invalid PostgreSQL backup filename')
    const filename = `${name}_${new Date().toISOString().replace(/[:.]/g, '-')}.sql`
    file = join(outputPath, filename)
    const output = await open(file, 'wx', 0o600)
    created = true
    try {
      const dump = Bun.spawn(['pg_dump', ...options.args], { env: { ...process.env, ...options.env }, stdout: output.fd, stderr: 'pipe' })
      const diagnostics = await new Response(dump.stderr).text()
      if (await dump.exited !== 0) throw new Error(`pg_dump failed: ${diagnostics.replaceAll(options.env.PGPASSWORD || '\0', '[redacted]').slice(0, 1000)}`)
    }
    finally { await output.close() }
    if (config.compress) {
      const compression = Bun.spawn(['gzip', '-f', file], { stdout: 'ignore', stderr: 'pipe' })
      if (await compression.exited !== 0) throw new Error('PostgreSQL backup compression failed')
      file += '.gz'
    }
    return { name: config.name, type: BackupType.POSTGRESQL, filename: basename(file), size: Bun.file(file).size, duration: performance.now() - start, success: true }
  }
  catch (error) {
    if (created && file) await unlink(file).catch(() => {})
    return { name: config.name, type: BackupType.POSTGRESQL, filename: '', size: 0, duration: performance.now() - start, success: false, error: error instanceof Error ? error.message : String(error) }
  }
}
