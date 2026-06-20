import type { FileConfig } from '../src/types'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { backupDirectory } from '../src/backups/directory'

// Regression coverage for include/exclude semantics on nested trees:
//  - `include` must NOT stop directory recursion (it filters files only).
//  - `exclude` must prune directories at any depth before descending.
//  - basename-style patterns (`x` / `**​/x`) keep their root-vs-anywhere meaning.
describe('Directory matching (nested include/exclude)', () => {
  const src = './test-match-src'
  const out = './test-match-out'

  beforeEach(async () => {
    await rm(src, { recursive: true, force: true })
    await rm(out, { recursive: true, force: true })
    await mkdir(join(src, 'a/b/c'), { recursive: true })
    await mkdir(join(src, 'keep/a'), { recursive: true })
    await mkdir(join(src, 'node_modules/pkg'), { recursive: true })
    await mkdir(out, { recursive: true })

    await writeFile(join(src, '.env'), 'ROOT=1')
    await writeFile(join(src, '.env.example'), 'ROOT=example')
    await writeFile(join(src, 'a', '.env'), 'A=1')
    await writeFile(join(src, 'a/b/c', '.env.production'), 'DEEP=1')
    await writeFile(join(src, 'a/b/c', 'notes.txt'), 'unrelated')
    // A nested dir ALSO named `a`, to prove a bare exclude only hits the root.
    await writeFile(join(src, 'keep/a', '.env'), 'NESTED_A=1')
    // A dependency .env that must be pruned with node_modules.
    await writeFile(join(src, 'node_modules/pkg', '.env'), 'DEP=1')
  })

  afterEach(async () => {
    await rm(src, { recursive: true, force: true })
    await rm(out, { recursive: true, force: true })
  })

  it('collects nested .env files while pruning node_modules and examples', async () => {
    const config: FileConfig = {
      name: 'envs',
      path: src,
      include: ['**/.env', '**/.env.*', '.env', '.env.*'],
      exclude: ['**/node_modules', 'node_modules', '**/.env.example', '.env.example'],
    }

    const result = await backupDirectory(config, out)

    expect(result.success).toBe(true)
    // root .env, a/.env, a/b/c/.env.production, keep/a/.env — but NOT
    // .env.example and NOT the .env buried in node_modules.
    expect(result.fileCount).toBe(4)
  })

  it('treats a bare name as root-only and `**/name` as any-depth', async () => {
    // Excluding the bare `a` removes only the ROOT `a/` dir, not nested `keep/a`.
    const onlyRoot: FileConfig = {
      name: 'envs',
      path: src,
      include: ['**/.env', '**/.env.*'],
      exclude: ['**/node_modules', 'node_modules', '**/.env.example', 'a'],
    }
    const r1 = await backupDirectory(onlyRoot, out)
    // root a/ is pruned; keep/a/.env survives because bare `a` is root-only.
    expect(r1.fileCount).toBe(1)
  })
})
