import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { backupSQLite } from '../src/backups/sqlite'
import { BackupType } from '../src/types'

/**
 * Capturing a database with VACUUM INTO instead of a SQL dump.
 *
 * The dump path holds every row of every table in memory and builds the whole
 * script as one string, which stops being viable well before a database is
 * large by any other standard. VACUUM INTO streams through SQLite, is
 * consistent against concurrent writers, and restores by copying a file back.
 */
describe('sqlite file mode', () => {
  const dir = resolve('./test-sqlite-file-mode')
  const dbPath = join(dir, 'source.sqlite')
  const outDir = join(dir, 'out')

  beforeEach(async () => {
    await rm(dir, { recursive: true, force: true })
    await mkdir(outDir, { recursive: true })

    const db = new Database(dbPath)
    db.exec('CREATE TABLE monitors (id INTEGER PRIMARY KEY, name TEXT, payload BLOB)')
    const insert = db.prepare('INSERT INTO monitors (name, payload) VALUES (?, ?)')
    for (let i = 0; i < 500; i++)
      insert.run(`monitor-${i}`, new Uint8Array([i % 256, 1, 2, 3]))
    db.close()
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  function config(overrides = {}) {
    return { type: BackupType.SQLITE as const, name: 'monitors-db', path: dbPath, ...overrides }
  }

  it('produces a real SQLite database rather than a script', async () => {
    const result = await backupSQLite(config({ mode: 'file' }), outDir)

    expect(result.success).toBe(true)
    expect(result.filename.endsWith('.sqlite')).toBe(true)

    const restored = new Database(join(outDir, result.filename), { readonly: true })
    expect(restored.query('SELECT COUNT(*) as n FROM monitors').get()).toEqual({ n: 500 })
    restored.close()
  })

  it('round-trips blob columns byte for byte', async () => {
    // The dump path hex-encodes blobs by hand; this one cannot get that wrong.
    const result = await backupSQLite(config({ mode: 'file' }), outDir)
    const restored = new Database(join(outDir, result.filename), { readonly: true })

    const row = restored.query('SELECT payload FROM monitors WHERE name = ?').get('monitor-7') as { payload: Uint8Array }
    expect(Array.from(row.payload)).toEqual([7, 1, 2, 3])
    restored.close()
  })

  it('captures a consistent snapshot while the database is being written', async () => {
    const writer = new Database(dbPath)
    writer.exec('PRAGMA journal_mode = WAL')
    writer.prepare('INSERT INTO monitors (name) VALUES (?)').run('during-backup')

    const result = await backupSQLite(config({ mode: 'file' }), outDir)
    writer.close()

    expect(result.success).toBe(true)
    const restored = new Database(join(outDir, result.filename), { readonly: true })
    // The committed write is present, and the file is not torn.
    expect((restored.query('SELECT COUNT(*) as n FROM monitors').get() as { n: number }).n).toBe(501)
    expect(restored.query('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' })
    restored.close()
  })

  it('replaces a leftover file from an interrupted run', async () => {
    // VACUUM INTO refuses to overwrite, so without handling this a stale file
    // fails every subsequent backup.
    const first = await backupSQLite(config({ mode: 'file', filename: 'fixed' }), outDir)
    const second = await backupSQLite(config({ mode: 'file', filename: 'fixed' }), outDir)

    expect(first.success).toBe(true)
    expect(second.success).toBe(true)
  })

  it('still defaults to the SQL dump', async () => {
    const result = await backupSQLite(config(), outDir)

    expect(result.success).toBe(true)
    expect(result.filename.endsWith('.sql')).toBe(true)
  })

  it('reports failure rather than throwing when the source is missing', async () => {
    const result = await backupSQLite(config({ mode: 'file', path: join(dir, 'absent.sqlite') }), outDir)

    expect(result.success).toBe(false)
    expect(existsSync(join(outDir, result.filename))).toBe(false)
  })
})
