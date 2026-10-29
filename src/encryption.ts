import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'

/** Streaming form of the ts-cloud TSCB1 AES-256-GCM envelope. */
const magic = Buffer.from('TSCB1')
const key = (secret: string) => {
  if (secret.length < 32) throw new Error('Backup encryption requires a secret of at least 32 characters')
  return createHash('sha256').update(secret).digest()
}

export async function encryptBackupFile(source: string, target: string, secret: string): Promise<void> {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  const output = await open(target, 'wx', 0o600)
  try {
    await output.write(Buffer.concat([magic, iv, Buffer.alloc(16)]))
    await pipeline(createReadStream(source), cipher, createWriteStream(target, { fd: output.fd, autoClose: false, start: 33 }))
    await output.write(cipher.getAuthTag(), 0, 16, 17)
  }
  catch (error) {
    await unlink(target)
    throw error
  }
  finally { await output.close() }
}

export async function decryptBackupFile(source: string, target: string, secret: string): Promise<void> {
  const encryptionKey = key(secret)
  const input = await open(source, 'r')
  const header = Buffer.alloc(33)
  try {
    const read = await input.read(header, 0, header.length, 0)
    if (read.bytesRead !== header.length || !header.subarray(0, 5).equals(magic)) throw new Error('Invalid encrypted backup envelope')
  }
  finally { await input.close() }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey, header.subarray(5, 17))
  decipher.setAuthTag(header.subarray(17, 33))
  const output = await open(target, 'wx', 0o600)
  try {
    await pipeline(createReadStream(source, { start: 33 }), decipher, createWriteStream(target, { fd: output.fd, autoClose: false }))
  }
  catch (error) {
    await unlink(target)
    throw error
  }
  finally { await output.close() }
}
