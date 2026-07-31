import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { getConfig } from '../src/config'

/**
 * Pointing the CLI at a config file rather than hoping the cwd contains the
 * right one.
 *
 * Discovery is fine for a project with a checked-in `backups.config.ts`. It is
 * not fine for backing up a remote machine, where the config is dropped
 * somewhere for the occasion and being off by one directory means backing up
 * the wrong things - which you discover at restore time.
 */
describe('getConfig with an explicit file', () => {
  const dir = resolve('./test-config-file')

  afterEach(async () => {
    if (existsSync(dir))
      await rm(dir, { recursive: true, force: true })
  })

  async function write(name: string, source: string): Promise<string> {
    await mkdir(dir, { recursive: true })
    const path = join(dir, name)
    await writeFile(path, source)
    return path
  }

  it('loads a config from an explicit path', async () => {
    const path = await write('one.config.ts', `export default {
      verbose: false,
      outputPath: '/tmp/one',
      databases: [{ type: 'sqlite', name: 'db-one', path: './one.sqlite' }],
      files: [],
    }`)

    const config = await getConfig(path)

    expect(config.outputPath).toBe('/tmp/one')
    expect(config.databases).toHaveLength(1)
    expect(config.databases[0]!.name).toBe('db-one')
  })

  it('throws rather than falling back when the file is missing', async () => {
    // Falling back to discovery or defaults would "succeed" while backing up
    // something other than what was asked for.
    await expect(getConfig(join(dir, 'absent.config.ts'))).rejects.toThrow()
  })

  it('rejects a relative path that does not exist', async () => {
    await expect(getConfig('./nope.config.ts')).rejects.toThrow()
  })

  it('fills in defaults the file leaves out', async () => {
    const path = await write('sparse.config.ts', `export default {
      files: [{ name: 'certs', path: '/etc/rpx/certs' }],
    }`)

    const config = await getConfig(path)

    expect(config.files).toHaveLength(1)
    expect(config.databases).toEqual([])
    expect(config.retention).toBeDefined()
  })

  it('defaults databases and files to empty rather than undefined', async () => {
    // BackupManager reads .length on both without guarding.
    const path = await write('empty.config.ts', 'export default { verbose: true }')
    const config = await getConfig(path)

    expect(config.databases).toEqual([])
    expect(config.files).toEqual([])
  })

  it('accepts a module with no default export', async () => {
    const path = await write('named.config.ts', `export const outputPath = '/tmp/named'
export const databases = []
export const files = []`)

    expect((await getConfig(path)).outputPath).toBe('/tmp/named')
  })
})

describe('getConfig with an explicit path', () => {
  const dir = resolve('./test-config-getconfig')

  afterEach(async () => {
    if (existsSync(dir))
      await rm(dir, { recursive: true, force: true })
  })

  it('does not serve one config from another one\'s cache', async () => {
    // Two backups in one process must not both get whichever was asked for
    // first: that silently backs up the wrong machine's data.
    await mkdir(dir, { recursive: true })
    const a = join(dir, 'a.config.ts')
    const b = join(dir, 'b.config.ts')
    await writeFile(a, `export default { outputPath: '/tmp/a', databases: [], files: [] }`)
    await writeFile(b, `export default { outputPath: '/tmp/b', databases: [], files: [] }`)

    expect((await getConfig(a)).outputPath).toBe('/tmp/a')
    expect((await getConfig(b)).outputPath).toBe('/tmp/b')
  })

  it('still discovers from the cwd when given no path', async () => {
    const config = await getConfig()

    expect(config).toBeDefined()
    expect(Array.isArray(config.databases)).toBe(true)
  })
})
