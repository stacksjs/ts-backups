import { afterEach, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decryptBackupFile, encryptBackupFile } from '../src/encryption'
const secret = 'a dedicated recovery secret of at least thirty-two bytes'
const directories: string[] = []
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }) })
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'backup-crypto-test-')); directories.push(directory)
  const plain = join(directory, 'plain'), encrypted = join(directory, 'encrypted'), restored = join(directory, 'restored')
  const body = Buffer.alloc(2 * 1024 * 1024 + 19, 73)
  await writeFile(plain, body)
  return { plain, encrypted, restored, body }
}
it('streams a private authenticated envelope that restores the complete binary file', async () => {
  const f = await fixture()
  await encryptBackupFile(f.plain, f.encrypted, secret)
  expect((await stat(f.encrypted)).mode & 0o777).toBe(0o600)
  const ciphertext = await readFile(f.encrypted)
  expect(ciphertext.subarray(0, 5).toString()).toBe('TSCB1')
  expect(ciphertext.includes(f.body.subarray(0, 128))).toBe(false)
  await decryptBackupFile(f.encrypted, f.restored, secret)
  expect(await readFile(f.restored)).toEqual(f.body)
  expect((await stat(f.restored)).mode & 0o777).toBe(0o600)
})
it('rejects wrong keys and tampering and removes the unauthenticated output', async () => {
  const f = await fixture(); await encryptBackupFile(f.plain, f.encrypted, secret)
  await expect(decryptBackupFile(f.encrypted, f.restored, `${secret}wrong`)).rejects.toThrow()
  expect(await Bun.file(f.restored).exists()).toBe(false)
  const bytes = await readFile(f.encrypted); bytes[37] ^= 1; await writeFile(f.encrypted, bytes)
  await expect(decryptBackupFile(f.encrypted, f.restored, secret)).rejects.toThrow()
  expect(await Bun.file(f.restored).exists()).toBe(false)
})
it('never overwrites an existing recovery target or accepts a missing key', async () => {
  const f = await fixture(); await encryptBackupFile(f.plain, f.encrypted, secret)
  await expect(decryptBackupFile(f.encrypted, f.plain, secret)).rejects.toThrow()
  expect(await readFile(f.plain)).toEqual(f.body)
  await expect(encryptBackupFile(f.plain, f.restored, 'short')).rejects.toThrow()
  expect(await Bun.file(f.restored).exists()).toBe(false)
})
