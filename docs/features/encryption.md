# Encryption

Backupx supports encrypting your backups to protect sensitive data at rest. This guide covers encryption options, key management, and best practices for secure backup storage.

## Built-in Compression with Encryption

### Using GPG for Encryption

Encrypt backups using GPG after creation:

```ts
import { createBackup } from 'backupx'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { unlink } from 'node:fs/promises'

async function encryptWithGPG(inputPath: string, outputPath: string, passphrase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const gpg = spawn('gpg', [
      '--batch',
      '--yes',
      '--passphrase', passphrase,
      '--symmetric',
      '--cipher-algo', 'AES256',
      '--output', outputPath,
      inputPath,
    ])

    gpg.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`GPG encryption failed with code ${code}`))
    })

    gpg.on('error', reject)
  })
}

async function backupWithEncryption() {
  const localPath = './backups'
  const encryptedPath = './backups/encrypted'
  const passphrase = process.env.BACKUP_ENCRYPTION_KEY!

  // Create backup
  const summary = await createBackup({
    outputPath: localPath,
    databases: [
      {
        type: 'postgresql',
        name: 'production-db',
        connection: process.env.DATABASE_URL,
        compress: true,
      },
    ],
  })

  // Encrypt each backup file
  for (const backup of summary.databaseBackups) {
    if (!backup.success)
      continue

    const inputFile = join(localPath, backup.filename)
    const outputFile = join(encryptedPath, `${backup.filename}.gpg`)

    await encryptWithGPG(inputFile, outputFile, passphrase)
    console.log(`Encrypted: ${backup.filename} -> ${backup.filename}.gpg`)

    // Optionally remove unencrypted backup
    await unlink(inputFile)
  }
}
```

### Decrypting GPG Backups

Decrypt backups for restoration:

```ts
async function decryptWithGPG(inputPath: string, outputPath: string, passphrase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const gpg = spawn('gpg', [
      '--batch',
      '--yes',
      '--passphrase', passphrase,
      '--decrypt',
      '--output', outputPath,
      inputPath,
    ])

    gpg.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`GPG decryption failed with code ${code}`))
    })

    gpg.on('error', reject)
  })
}

// Usage
await decryptWithGPG(
  './backups/encrypted/production-db.sql.gz.gpg',
  './restore/production-db.sql.gz',
  process.env.BACKUP_ENCRYPTION_KEY!,
)
```

## Node.js Crypto Encryption

### AES-256-GCM Encryption

Use Node.js built-in crypto for encryption:

```ts
import { createBackup } from 'backupx'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const SALT_LENGTH = 32

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH)
}

async function encryptFile(inputPath: string, outputPath: string, password: string): Promise<void> {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = deriveKey(password, salt)

  const cipher = createCipheriv(ALGORITHM, key, iv)
  const input = createReadStream(inputPath)
  const output = createWriteStream(outputPath)

  // Write salt and IV first
  output.write(salt)
  output.write(iv)

  await pipeline(input, cipher, output)

  // Append auth tag
  const authTag = cipher.getAuthTag()
  const finalOutput = createWriteStream(outputPath, { flags: 'a' })
  finalOutput.write(authTag)
  finalOutput.close()
}

async function decryptFile(inputPath: string, outputPath: string, password: string): Promise<void> {
  const fileContent = await Bun.file(inputPath).arrayBuffer()
  const buffer = Buffer.from(fileContent)

  // Extract salt, IV, and auth tag
  const salt = buffer.subarray(0, SALT_LENGTH)
  const iv = buffer.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const authTag = buffer.subarray(buffer.length - AUTH_TAG_LENGTH)
  const encrypted = buffer.subarray(SALT_LENGTH + IV_LENGTH, buffer.length - AUTH_TAG_LENGTH)

  const key = deriveKey(password, salt)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ])

  await Bun.write(outputPath, decrypted)
}

// Usage
async function backupWithNodeCrypto() {
  const localPath = './backups'
  const password = process.env.BACKUP_ENCRYPTION_KEY!

  const summary = await createBackup({
    outputPath: localPath,
    databases: [
      {
        type: 'postgresql',
        name: 'production-db',
        connection: process.env.DATABASE_URL,
        compress: true,
      },
    ],
  })

  for (const backup of summary.databaseBackups) {
    if (!backup.success)
      continue

    const inputFile = join(localPath, backup.filename)
    const outputFile = join(localPath, `${backup.filename}.enc`)

    await encryptFile(inputFile, outputFile, password)
    console.log(`Encrypted: ${backup.filename}`)
  }
}
```

## Streaming Encryption

### Encrypt Large Files Efficiently

Stream-based encryption for large backup files:

```ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

class EncryptionStream extends Transform {
  private cipher: any
  private headerWritten = false
  private salt: Buffer
  private iv: Buffer

  constructor(password: string) {
    super()
    this.salt = randomBytes(32)
    this.iv = randomBytes(16)
    const key = scryptSync(password, this.salt, 32)
    this.cipher = createCipheriv('aes-256-cbc', key, this.iv)
  }

  _transform(chunk: Buffer, encoding: string, callback: Function) {
    if (!this.headerWritten) {
      this.push(this.salt)
      this.push(this.iv)
      this.headerWritten = true
    }
    this.push(this.cipher.update(chunk))
    callback()
  }

  _flush(callback: Function) {
    this.push(this.cipher.final())
    callback()
  }
}

async function encryptStream(inputPath: string, outputPath: string, password: string) {
  const input = createReadStream(inputPath)
  const output = createWriteStream(outputPath)
  const encrypt = new EncryptionStream(password)

  await pipeline(input, encrypt, output)
}
```

## Key Management

### Environment-Based Keys

Store encryption keys securely:

```ts
// .env (never commit this file!)
BACKUP_ENCRYPTION_KEY=your-very-secure-passphrase-here

// Access in code
const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY

if (!encryptionKey) {
  throw new Error('BACKUP_ENCRYPTION_KEY environment variable is required')
}
```

### AWS KMS Integration

Use AWS Key Management Service for key management:

```ts
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms'
import { createCipheriv, createDecipheriv } from 'node:crypto'

const kmsClient = new KMSClient({ region: process.env.AWS_REGION })

async function encryptWithKMS(data: Buffer): Promise<{ encrypted: Buffer, encryptedKey: Buffer }> {
  // Generate a data key
  const generateKeyResponse = await kmsClient.send(new GenerateDataKeyCommand({
    KeyId: process.env.KMS_KEY_ID!,
    KeySpec: 'AES_256',
  }))

  const plainKey = generateKeyResponse.Plaintext!
  const encryptedKey = generateKeyResponse.CiphertextBlob!

  // Encrypt data with the plain key
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', plainKey, iv)
  const encrypted = Buffer.concat([iv, cipher.update(data), cipher.final()])

  return {
    encrypted,
    encryptedKey: Buffer.from(encryptedKey),
  }
}

async function decryptWithKMS(encrypted: Buffer, encryptedKey: Buffer): Promise<Buffer> {
  // Decrypt the data key using KMS
  const decryptKeyResponse = await kmsClient.send(new DecryptCommand({
    CiphertextBlob: encryptedKey,
  }))

  const plainKey = decryptKeyResponse.Plaintext!

  // Decrypt data with the plain key
  const iv = encrypted.subarray(0, 16)
  const ciphertext = encrypted.subarray(16)
  const decipher = createDecipheriv('aes-256-cbc', plainKey, iv)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}
```

### HashiCorp Vault Integration

Use HashiCorp Vault for secrets management:

```ts
import { createBackup } from 'backupx'

async function getEncryptionKeyFromVault(): Promise<string> {
  const response = await fetch(`${process.env.VAULT_ADDR}/v1/secret/data/backup-keys`, {
    headers: {
      'X-Vault-Token': process.env.VAULT_TOKEN!,
    },
  })

  const data = await response.json()
  return data.data.data.encryption_key
}

async function backupWithVaultKey() {
  const encryptionKey = await getEncryptionKeyFromVault()

  const summary = await createBackup({
    outputPath: './backups',
    databases: [
      {
        type: 'postgresql',
        name: 'production-db',
        connection: process.env.DATABASE_URL,
      },
    ],
  })

  // Encrypt backups using the key from Vault
  for (const backup of summary.databaseBackups) {
    if (backup.success) {
      await encryptFile(
        `./backups/${backup.filename}`,
        `./backups/${backup.filename}.enc`,
        encryptionKey,
      )
    }
  }
}
```

## Encryption Wrapper Class

### Reusable Encryption Utility

Create a reusable encryption class:

```ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

export class BackupEncryption {
  private algorithm = 'aes-256-gcm'
  private keyLength = 32
  private ivLength = 16
  private saltLength = 32
  private authTagLength = 16

  constructor(private password: string) {
    if (!password || password.length < 16) {
      throw new Error('Password must be at least 16 characters')
    }
  }

  private deriveKey(salt: Buffer): Buffer {
    return scryptSync(this.password, salt, this.keyLength)
  }

  async encrypt(data: Buffer): Promise<Buffer> {
    const salt = randomBytes(this.saltLength)
    const iv = randomBytes(this.ivLength)
    const key = this.deriveKey(salt)

    const cipher = createCipheriv(this.algorithm, key, iv)
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Format: salt + iv + authTag + encrypted
    return Buffer.concat([salt, iv, authTag, encrypted])
  }

  async decrypt(encryptedData: Buffer): Promise<Buffer> {
    const salt = encryptedData.subarray(0, this.saltLength)
    const iv = encryptedData.subarray(this.saltLength, this.saltLength + this.ivLength)
    const authTag = encryptedData.subarray(
      this.saltLength + this.ivLength,
      this.saltLength + this.ivLength + this.authTagLength,
    )
    const encrypted = encryptedData.subarray(this.saltLength + this.ivLength + this.authTagLength)

    const key = this.deriveKey(salt)
    const decipher = createDecipheriv(this.algorithm, key, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()])
  }

  async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    const data = await Bun.file(inputPath).arrayBuffer()
    const encrypted = await this.encrypt(Buffer.from(data))
    await Bun.write(outputPath, encrypted)
  }

  async decryptFile(inputPath: string, outputPath: string): Promise<void> {
    const data = await Bun.file(inputPath).arrayBuffer()
    const decrypted = await this.decrypt(Buffer.from(data))
    await Bun.write(outputPath, decrypted)
  }
}

// Usage
const encryption = new BackupEncryption(process.env.BACKUP_ENCRYPTION_KEY!)

await encryption.encryptFile('./backup.sql', './backup.sql.enc')
await encryption.decryptFile('./backup.sql.enc', './restored.sql')
```

## Best Practices

1. **Use Strong Passwords**: Minimum 16 characters with mixed characters
2. **Never Hardcode Keys**: Always use environment variables or secret managers
3. **Key Rotation**: Periodically rotate encryption keys
4. **Secure Key Storage**: Use dedicated secret management solutions
5. **Test Decryption**: Regularly verify you can decrypt backups
6. **Use Authenticated Encryption**: Prefer AES-GCM over AES-CBC
7. **Audit Access**: Log and monitor access to encryption keys
8. **Separate Keys by Environment**: Use different keys for dev/staging/production
9. **Backup Your Keys**: Securely store backup copies of encryption keys
10. **Document Key Management**: Maintain clear documentation for key access
