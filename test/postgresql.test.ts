import { expect, it } from 'bun:test'
import { postgresDumpOptions } from '../src/backups/postgresql'
import { BackupType } from '../src/types'
it('keeps credentials out of pg_dump arguments and preserves native SQL objects', () => {
  const password = 'p@ss:\\word?'
  const value = postgresDumpOptions({ type: BackupType.POSTGRESQL, name: 'lsu', connection: { database: 'lsu', username: 'lsu', password, ssl: false } })
  expect(value.env.PGPASSWORD).toBe(password)
  expect(value.args).not.toContain(password)
  expect(value.args).toContain('--format=plain')
  expect(value.args).toContain('--no-owner')
  expect(value.args).not.toContain('--data-only')
  expect(value.args).not.toContain('--schema-only')
})
it('parses escaped URLs and table filters without shell interpolation', () => {
  const value = postgresDumpOptions({ type: BackupType.POSTGRESQL, name: 'demo', connection: 'postgres://u:p%40s%3As@localhost:5433/demo?sslmode=verify-full', includeData: false, tables: ['public.accounts'], excludeTables: ['public.sessions'] })
  expect(value.env).toMatchObject({ PGPASSWORD: 'p@s:s', PGPORT: '5433', PGSSLMODE: 'verify-full', PGDATABASE: 'demo' })
  expect(value.args).toContain('--schema-only')
  expect(value.args.slice(-4)).toEqual(['--table', 'public.accounts', '--exclude-table', 'public.sessions'])
})
