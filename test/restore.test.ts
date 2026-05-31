import type { BackupConfig } from '../src/types'
import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { findLatestSnapshot, parseArchive, RestoreManager } from '../src/restore'
import { BackupType } from '../src/types'

let root: string
let source: string
let output: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'backupx-restore-'))
  source = join(root, 'source')
  output = join(root, 'out')
  await mkdir(source, { recursive: true })
  await mkdir(output, { recursive: true })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function cfg(files: BackupConfig['files']): BackupConfig {
  return { verbose: false, databases: [], files, outputPath: output }
}

const TS = '2026-05-30T12-00-00-000Z'

/** Write a single-file snapshot the way `backupFile` would. */
async function writeFileSnapshot(base: string, ext: string, data: string, compress = false) {
  const raw = Buffer.from(data)
  const body = compress ? gzipSync(raw) : raw
  const name = `${base}_${TS}${ext}${compress ? '.gz' : ''}`
  await writeFile(join(output, name), body)
  return name
}

/** Build a directory archive in the same format as `createFileHeader`. */
function buildArchive(files: { path: string, content: string }[]): Buffer {
  const chunks: Buffer[] = []
  for (const f of files) {
    const content = Buffer.from(f.content)
    const headerJson = JSON.stringify({ path: f.path, size: content.length })
    const header = Buffer.alloc(4 + Buffer.byteLength(headerJson, 'utf8'))
    header.writeUInt32BE(Buffer.byteLength(headerJson, 'utf8'), 0)
    header.write(headerJson, 4, 'utf8')
    chunks.push(header, content)
  }
  return Buffer.concat(chunks)
}

async function writeDirSnapshot(base: string, files: { path: string, content: string }[], compress = false) {
  const archive = buildArchive(files)
  const body = compress ? gzipSync(archive) : archive
  const name = `${base}_${TS}.tar${compress ? '.gz' : ''}`
  await writeFile(join(output, name), body)
  return name
}

describe('restore: single file', () => {
  it('restores a raw file to its original path', async () => {
    const dest = join(source, 'note.txt')
    await writeFileSnapshot('note', '.txt', 'hello world')

    const summary = await new RestoreManager(cfg([{ name: 'note', path: dest }])).restore()
    expect(summary.successCount).toBe(1)
    expect(summary.failureCount).toBe(0)
    expect(await readFile(dest, 'utf-8')).toBe('hello world')
  })

  it('restores a gzipped file', async () => {
    const dest = join(source, 'data.txt')
    await writeFileSnapshot('data', '.txt', 'compress me', true)

    const summary = await new RestoreManager(cfg([{ name: 'data', path: dest }])).restore()
    expect(summary.successCount).toBe(1)
    expect(await readFile(dest, 'utf-8')).toBe('compress me')
  })

  it('uses a custom filename when configured', async () => {
    const dest = join(source, 'real.txt')
    await writeFileSnapshot('snap', '.txt', 'via filename')

    const summary = await new RestoreManager(
      cfg([{ name: 'logical', path: dest, filename: 'snap' }]),
    ).restore()
    expect(summary.successCount).toBe(1)
    expect(await readFile(dest, 'utf-8')).toBe('via filename')
  })
})

describe('restore: overwrite protection', () => {
  it('fails when destination exists and overwrite is false', async () => {
    const dest = join(source, 'keep.txt')
    await writeFile(dest, 'changed')
    await writeFileSnapshot('keep', '.txt', 'original')

    const summary = await new RestoreManager(cfg([{ name: 'keep', path: dest }])).restore()
    expect(summary.failureCount).toBe(1)
    expect(await readFile(dest, 'utf-8')).toBe('changed') // untouched
  })

  it('overwrites when overwrite is true', async () => {
    const dest = join(source, 'keep.txt')
    await writeFile(dest, 'changed')
    await writeFileSnapshot('keep', '.txt', 'original')

    const summary = await new RestoreManager(cfg([{ name: 'keep', path: dest }]), { overwrite: true }).restore()
    expect(summary.successCount).toBe(1)
    expect(await readFile(dest, 'utf-8')).toBe('original')
  })
})

describe('restore: directory', () => {
  it('restores a directory archive preserving structure', async () => {
    const dir = join(source, 'proj')
    await writeDirSnapshot('proj', [
      { path: 'a.txt', content: 'aaa' },
      { path: 'nested/b.txt', content: 'bbb' },
    ])

    const summary = await new RestoreManager(cfg([{ name: 'proj', path: dir }])).restore()
    expect(summary.successCount).toBe(1)
    expect(summary.results[0].type).toBe(BackupType.DIRECTORY)
    expect(summary.results[0].fileCount).toBe(2)
    expect(await readFile(join(dir, 'a.txt'), 'utf-8')).toBe('aaa')
    expect(await readFile(join(dir, 'nested', 'b.txt'), 'utf-8')).toBe('bbb')
  })

  it('restores a compressed directory archive to a custom target', async () => {
    await writeDirSnapshot('proj', [{ path: 'a.txt', content: 'aaa' }], true)
    const target = join(root, 'restored-here')

    const summary = await new RestoreManager(
      cfg([{ name: 'proj', path: join(source, 'proj') }]),
      { targetPath: target },
    ).restore()
    expect(summary.successCount).toBe(1)
    expect(await readFile(join(target, 'a.txt'), 'utf-8')).toBe('aaa')
  })
})

describe('restore: selection and snapshots', () => {
  it('restores only the named backup', async () => {
    const a = join(source, 'a.txt')
    const b = join(source, 'b.txt')
    await writeFileSnapshot('a', '.txt', 'AAA')
    await writeFileSnapshot('b', '.txt', 'BBB')

    const summary = await new RestoreManager(
      cfg([{ name: 'a', path: a }, { name: 'b', path: b }]),
      { only: ['a'] },
    ).restore()
    expect(summary.successCount).toBe(1)
    expect(existsSync(a)).toBe(true)
    expect(existsSync(b)).toBe(false)
  })

  it('restores from an explicit snapshot filename', async () => {
    const dest = join(source, 'pinned.txt')
    const name = await writeFileSnapshot('pinned', '.txt', 'pinned content')

    const summary = await new RestoreManager(
      cfg([{ name: 'pinned', path: dest }]),
      { snapshot: name },
    ).restore()
    expect(summary.successCount).toBe(1)
    expect(await readFile(dest, 'utf-8')).toBe('pinned content')
  })
})

describe('restore: databases skipped', () => {
  it('reports databases as skipped', async () => {
    const config: BackupConfig = {
      verbose: false,
      outputPath: output,
      files: [],
      databases: [{ type: BackupType.SQLITE, name: 'db', path: join(source, 'x.sqlite') }],
    }
    const summary = await new RestoreManager(config).restore()
    expect(summary.skippedCount).toBe(1)
    expect(summary.successCount).toBe(0)
    expect(summary.results[0].skipped).toBe(true)
  })
})

describe('restore: errors and helpers', () => {
  it('fails gracefully when no snapshot exists', async () => {
    const summary = await new RestoreManager(cfg([{ name: 'missing', path: join(source, 'missing.txt') }])).restore()
    expect(summary.failureCount).toBe(1)
    expect(summary.results[0].error).toContain('No snapshot found')
  })

  it('throws when the backup directory is absent', async () => {
    const config = cfg([{ name: 'x', path: join(source, 'x.txt') }])
    config.outputPath = join(root, 'does-not-exist')
    await expect(new RestoreManager(config).restore()).rejects.toThrow('Backup directory not found')
  })

  it('findLatestSnapshot picks the newest by timestamp', async () => {
    await writeFile(join(output, 'app_2026-05-30T10-00-00-000Z.txt'), 'old')
    await writeFile(join(output, 'app_2026-05-30T12-00-00-000Z.txt'), 'new')
    expect(await findLatestSnapshot(output, 'app')).toBe('app_2026-05-30T12-00-00-000Z.txt')
  })

  it('parseArchive round-trips the archive format', () => {
    const archive = buildArchive([{ path: 'x', content: 'hi' }])
    const entries = parseArchive(archive)
    expect(entries).toHaveLength(1)
    expect(entries[0].relativePath).toBe('x')
    expect(entries[0].content.toString()).toBe('hi')
  })

  it('parseArchive rejects a corrupt buffer', () => {
    expect(() => parseArchive(Buffer.from('not an archive at all'))).toThrow('Corrupt archive')
  })
})
