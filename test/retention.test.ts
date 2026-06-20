import type { BackupConfig } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BackupManager } from '../src/backups'

// Retention `count` is per backup ENTRY, not a global file cap. A config with
// more entries than `count` must not delete whole entries on every run.
describe('Retention (per-entry count)', () => {
  const dir = './test-retention'
  const out = './test-retention-out'

  beforeEach(async () => {
    await rm(dir, { recursive: true, force: true })
    await rm(out, { recursive: true, force: true })
    await Bun.write(join(dir, 'a.txt'), 'A')
    await Bun.write(join(dir, 'b.txt'), 'B')
    await Bun.write(join(dir, 'c.txt'), 'C')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
    await rm(out, { recursive: true, force: true })
  })

  it('keeps the newest `count` snapshots of EACH entry, not `count` total', async () => {
    const config: BackupConfig = {
      verbose: false,
      outputPath: out,
      retention: { count: 1 },
      databases: [],
      files: [
        { name: 'a', path: join(dir, 'a.txt') },
        { name: 'b', path: join(dir, 'b.txt') },
        { name: 'c', path: join(dir, 'c.txt') },
      ],
    }

    const manager = new BackupManager(config)
    await manager.createBackup()
    // Mutate so the second run's content differs, then snapshot again.
    await writeFile(join(dir, 'a.txt'), 'A2')
    await manager.createBackup()

    const files = await readdir(out)
    // One snapshot per entry survives (3 total) — NOT pruned to 1 file overall.
    expect(files.filter(f => f.startsWith('a_')).length).toBe(1)
    expect(files.filter(f => f.startsWith('b_')).length).toBe(1)
    expect(files.filter(f => f.startsWith('c_')).length).toBe(1)
  })
})
