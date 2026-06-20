import type { BackupConfig } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { BackupManager } from '../src/backups'

// An `optional` file whose source is absent should be SKIPPED, not failed, so a
// config shared across machines stays green when an app/credential isn't here.
describe('Optional sources', () => {
  const dir = './test-optional'
  const out = './test-optional-out'

  beforeEach(async () => {
    await rm(dir, { recursive: true, force: true })
    await rm(out, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    await mkdir(out, { recursive: true })
    await writeFile(join(dir, 'present.txt'), 'here')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
    await rm(out, { recursive: true, force: true })
  })

  it('skips a missing optional source instead of failing the run', async () => {
    const config: BackupConfig = {
      verbose: false,
      outputPath: out,
      databases: [],
      files: [
        { name: 'present', path: join(dir, 'present.txt') },
        { name: 'absent', path: join(dir, 'does-not-exist.txt'), optional: true },
      ],
    }

    const summary = await new BackupManager(config).createBackup()

    expect(summary.successCount).toBe(1)
    expect(summary.failureCount).toBe(0)
    const absent = summary.results.find(r => r.name === 'absent')
    expect(absent?.skipped).toBe(true)
    expect(absent?.success).toBe(false)
  })

  it('still fails a missing source that is NOT optional', async () => {
    const config: BackupConfig = {
      verbose: false,
      outputPath: out,
      databases: [],
      files: [
        { name: 'absent', path: join(dir, 'nope.txt') },
      ],
    }

    const summary = await new BackupManager(config).createBackup()

    expect(summary.failureCount).toBe(1)
    expect(summary.results[0].skipped).toBeUndefined()
  })
})
