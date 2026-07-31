import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { backupDirectory } from '../src/backups/directory'
import { ARCHIVE_EXTENSION, ARCHIVE_EXTENSION_GZ } from '../src/constants'
import { RestoreManager } from '../src/restore'
import { BackupType } from '../src/types'

/**
 * What a multi-file archive is called.
 *
 * It was called `.tar`, and it is not a tar - it is this tool's own container
 * format, so `tar xzf` answers "unrecognized archive format" to whoever is
 * trying to recover something. The name now says what it is, and archives
 * written under the old name still have to restore, because a rename that
 * strands existing backups is worse than the misleading name was.
 */
describe('archive extension', () => {
  const dir = resolve('./test-archive-extension')
  const source = join(dir, 'source')
  const out = join(dir, 'out')

  beforeEach(async () => {
    await rm(dir, { recursive: true, force: true })
    await mkdir(source, { recursive: true })
    await mkdir(out, { recursive: true })
    await writeFile(join(source, 'one.conf'), 'alpha')
    await writeFile(join(source, 'two.conf'), 'beta')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('names an uncompressed archive .tsbak', async () => {
    const result = await backupDirectory({ name: 'cfg', path: source }, out)

    expect(result.success).toBe(true)
    expect(result.filename.endsWith(ARCHIVE_EXTENSION)).toBe(true)
  })

  it('names a compressed archive .tsbak.gz', async () => {
    const result = await backupDirectory({ name: 'cfg', path: source, compress: true }, out)

    expect(result.filename.endsWith(ARCHIVE_EXTENSION_GZ)).toBe(true)
  })

  it('never calls the archive a tar', async () => {
    const result = await backupDirectory({ name: 'cfg', path: source, compress: true }, out)

    expect(result.filename).not.toContain('.tar')
  })

  it('restores an archive written under the new name', async () => {
    await backupDirectory({ name: 'cfg', path: source, compress: true }, out)
    const target = join(dir, 'restored')

    const summary = await new RestoreManager(
      { verbose: false, databases: [], files: [{ name: 'cfg', path: source }], outputPath: out },
      { targetPath: target, overwrite: true },
    ).restore()

    expect(summary.successCount).toBe(1)
    expect(await Bun.file(join(target, 'one.conf')).text()).toBe('alpha')
  })

  it('still restores a historical .tar.gz archive', async () => {
    // The compatibility guarantee: backups taken before the rename must not
    // become unreadable because the extension changed.
    const result = await backupDirectory({ name: 'legacy', path: source, compress: true }, out)
    const legacy = result.filename.replace(ARCHIVE_EXTENSION_GZ, '.tar.gz')
    await rename(join(out, result.filename), join(out, legacy))

    const target = join(dir, 'restored-legacy')
    const summary = await new RestoreManager(
      { verbose: false, databases: [], files: [{ name: 'legacy', path: source }], outputPath: out },
      { targetPath: target, overwrite: true },
    ).restore()

    expect(summary.successCount).toBe(1)
    expect(await Bun.file(join(target, 'two.conf')).text()).toBe('beta')
  })

  it('still restores a historical uncompressed .tar archive', async () => {
    const result = await backupDirectory({ name: 'legacy2', path: source }, out)
    const legacy = result.filename.replace(ARCHIVE_EXTENSION, '.tar')
    await rename(join(out, result.filename), join(out, legacy))

    const target = join(dir, 'restored-legacy2')
    const summary = await new RestoreManager(
      { verbose: false, databases: [], files: [{ name: 'legacy2', path: source }], outputPath: out },
      { targetPath: target, overwrite: true },
    ).restore()

    expect(summary.successCount).toBe(1)
    expect(existsSync(join(target, 'one.conf'))).toBe(true)
  })

  it('leaves exactly one archive per backup in the output directory', async () => {
    await backupDirectory({ name: 'cfg', path: source, compress: true }, out)

    const files = await readdir(out)
    expect(files).toHaveLength(1)
  })
})
