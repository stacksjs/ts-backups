# Custom Adapters

Backupx supports extending its functionality through custom adapters. This guide covers creating custom database adapters, storage adapters, and notification handlers.

## Database Adapter Architecture

### Base Adapter Interface

All database adapters implement a common interface:

```ts
interface DatabaseAdapter {
  type: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  getSchema(): Promise<string>
  getData(tables?: string[]): Promise<string>
  backup(outputPath: string, options: BackupOptions): Promise<BackupResult>
}

interface BackupOptions {
  includeSchema: boolean
  includeData: boolean
  tables?: string[]
  excludeTables?: string[]
  compress: boolean
}

interface BackupResult {
  success: boolean
  filename: string
  size: number
  duration: number
  error?: string
}
```

### Creating a Custom Database Adapter

Implement a custom adapter for a new database type:

```ts
import type { DatabaseAdapter, BackupOptions, BackupResult } from 'backupx'

export class MongoDBAdapter implements DatabaseAdapter {
  type = 'mongodb'
  private client: any
  private connectionString: string

  constructor(connectionString: string) {
    this.connectionString = connectionString
  }

  async connect(): Promise<void> {
    const { MongoClient } = await import('mongodb')
    this.client = new MongoClient(this.connectionString)
    await this.client.connect()
  }

  async disconnect(): Promise<void> {
    await this.client.close()
  }

  async getSchema(): Promise<string> {
    const db = this.client.db()
    const collections = await db.listCollections().toArray()

    const schema = collections.map((col: any) => ({
      name: col.name,
      type: col.type,
      options: col.options,
    }))

    return JSON.stringify(schema, null, 2)
  }

  async getData(tables?: string[]): Promise<string> {
    const db = this.client.db()
    const collections = tables || (await db.listCollections().toArray()).map((c: any) => c.name)

    const data: Record<string, any[]> = {}

    for (const collection of collections) {
      const documents = await db.collection(collection).find({}).toArray()
      data[collection] = documents
    }

    return JSON.stringify(data, null, 2)
  }

  async backup(outputPath: string, options: BackupOptions): Promise<BackupResult> {
    const startTime = Date.now()

    try {
      let content = ''

      if (options.includeSchema) {
        content += `-- Schema\n${await this.getSchema()}\n\n`
      }

      if (options.includeData) {
        content += `-- Data\n${await this.getData(options.tables)}\n`
      }

      const filename = `mongodb-backup-${Date.now()}.json`
      const fullPath = `${outputPath}/${filename}`

      if (options.compress) {
        const compressed = Bun.gzipSync(Buffer.from(content))
        await Bun.write(`${fullPath}.gz`, compressed)
      }
      else {
        await Bun.write(fullPath, content)
      }

      const stats = await Bun.file(options.compress ? `${fullPath}.gz` : fullPath)

      return {
        success: true,
        filename: options.compress ? `${filename}.gz` : filename,
        size: stats.size,
        duration: Date.now() - startTime,
      }
    }
    catch (error) {
      return {
        success: false,
        filename: '',
        size: 0,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
```

### Registering Custom Adapters

Register your custom adapter with the backup manager:

```ts
import { BackupManager, registerAdapter } from 'backupx'
import { MongoDBAdapter } from './adapters/mongodb'

// Register the custom adapter
registerAdapter('mongodb', MongoDBAdapter)

// Use in configuration
const config = {
  databases: [
    {
      type: 'mongodb',
      name: 'app-mongo',
      connection: process.env.MONGODB_URL,
      includeSchema: true,
      includeData: true,
    },
  ],
}

const manager = new BackupManager(config)
await manager.createBackup()
```

## Storage Adapter Architecture

### Base Storage Interface

Storage adapters handle where backups are saved:

```ts
interface StorageAdapter {
  type: string
  write(path: string, data: Buffer): Promise<void>
  read(path: string): Promise<Buffer>
  list(directory: string): Promise<string[]>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
}
```

### Creating a Custom Storage Adapter

Implement a custom storage adapter for S3:

```ts
import type { StorageAdapter } from 'backupx'
import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

export class S3StorageAdapter implements StorageAdapter {
  type = 's3'
  private client: S3Client
  private bucket: string

  constructor(config: { region: string, bucket: string }) {
    this.client = new S3Client({ region: config.region })
    this.bucket = config.bucket
  }

  async write(path: string, data: Buffer): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      Body: data,
    }))
  }

  async read(path: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    }))

    const stream = response.Body as any
    const chunks: Buffer[] = []

    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  }

  async list(directory: string): Promise<string[]> {
    const response = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: directory,
    }))

    return (response.Contents || []).map(obj => obj.Key!)
  }

  async delete(path: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: path,
    }))
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: path,
      }))
      return true
    }
    catch {
      return false
    }
  }
}
```

### Using Custom Storage Adapters

Configure the backup manager to use a custom storage adapter:

```ts
import { BackupManager, setStorageAdapter } from 'backupx'
import { S3StorageAdapter } from './adapters/s3-storage'

// Create and set the storage adapter
const s3Storage = new S3StorageAdapter({
  region: 'us-east-1',
  bucket: 'my-backups',
})

setStorageAdapter(s3Storage)

// Backups will now be stored in S3
const manager = new BackupManager(config)
await manager.createBackup()
```

## Notification Adapter Architecture

### Base Notification Interface

Notification adapters handle backup status notifications:

```ts
interface NotificationAdapter {
  type: string
  onBackupStart(backup: BackupInfo): Promise<void>
  onBackupComplete(result: BackupResult): Promise<void>
  onBackupFailed(error: BackupError): Promise<void>
}

interface BackupInfo {
  name: string
  type: string
  startTime: Date
}

interface BackupError {
  backup: BackupInfo
  error: string
  timestamp: Date
}
```

### Creating a Slack Notification Adapter

Send backup notifications to Slack:

```ts
import type { NotificationAdapter, BackupInfo, BackupResult, BackupError } from 'backupx'

export class SlackNotificationAdapter implements NotificationAdapter {
  type = 'slack'
  private webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  private async sendMessage(blocks: any[]): Promise<void> {
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })
  }

  async onBackupStart(backup: BackupInfo): Promise<void> {
    await this.sendMessage([
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:hourglass_flowing_sand: *Backup Started*\n*Name:* ${backup.name}\n*Type:* ${backup.type}`,
        },
      },
    ])
  }

  async onBackupComplete(result: BackupResult): Promise<void> {
    const sizeFormatted = this.formatBytes(result.size)
    const durationFormatted = `${(result.duration / 1000).toFixed(2)}s`

    await this.sendMessage([
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:white_check_mark: *Backup Completed*\n*File:* ${result.filename}\n*Size:* ${sizeFormatted}\n*Duration:* ${durationFormatted}`,
        },
      },
    ])
  }

  async onBackupFailed(error: BackupError): Promise<void> {
    await this.sendMessage([
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:x: *Backup Failed*\n*Name:* ${error.backup.name}\n*Error:* ${error.error}`,
        },
      },
    ])
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / 1024 ** i * 100) / 100} ${sizes[i]}`
  }
}
```

### Discord Notification Adapter

Send notifications to Discord:

```ts
import type { NotificationAdapter, BackupInfo, BackupResult, BackupError } from 'backupx'

export class DiscordNotificationAdapter implements NotificationAdapter {
  type = 'discord'
  private webhookUrl: string

  constructor(webhookUrl: string) {
    this.webhookUrl = webhookUrl
  }

  private async sendEmbed(embed: any): Promise<void> {
    await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    })
  }

  async onBackupStart(backup: BackupInfo): Promise<void> {
    await this.sendEmbed({
      title: 'Backup Started',
      color: 0x3498DB, // Blue
      fields: [
        { name: 'Name', value: backup.name, inline: true },
        { name: 'Type', value: backup.type, inline: true },
      ],
      timestamp: new Date().toISOString(),
    })
  }

  async onBackupComplete(result: BackupResult): Promise<void> {
    await this.sendEmbed({
      title: 'Backup Completed',
      color: 0x2ECC71, // Green
      fields: [
        { name: 'File', value: result.filename, inline: true },
        { name: 'Size', value: this.formatBytes(result.size), inline: true },
        { name: 'Duration', value: `${(result.duration / 1000).toFixed(2)}s`, inline: true },
      ],
      timestamp: new Date().toISOString(),
    })
  }

  async onBackupFailed(error: BackupError): Promise<void> {
    await this.sendEmbed({
      title: 'Backup Failed',
      color: 0xE74C3C, // Red
      fields: [
        { name: 'Name', value: error.backup.name, inline: true },
        { name: 'Error', value: error.error },
      ],
      timestamp: new Date().toISOString(),
    })
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / 1024 ** i * 100) / 100} ${sizes[i]}`
  }
}
```

### Using Notification Adapters

Register and use notification adapters:

```ts
import { BackupManager, addNotificationAdapter } from 'backupx'
import { SlackNotificationAdapter } from './adapters/slack'
import { DiscordNotificationAdapter } from './adapters/discord'

// Add multiple notification adapters
addNotificationAdapter(new SlackNotificationAdapter(process.env.SLACK_WEBHOOK!))
addNotificationAdapter(new DiscordNotificationAdapter(process.env.DISCORD_WEBHOOK!))

// Notifications will be sent to both Slack and Discord
const manager = new BackupManager(config)
await manager.createBackup()
```

## Compression Adapter

### Custom Compression Implementation

Create a custom compression adapter:

```ts
interface CompressionAdapter {
  type: string
  compress(data: Buffer): Promise<Buffer>
  decompress(data: Buffer): Promise<Buffer>
  extension: string
}

export class ZstdCompressionAdapter implements CompressionAdapter {
  type = 'zstd'
  extension = '.zst'

  async compress(data: Buffer): Promise<Buffer> {
    // Using zstd-wasm or similar library
    const { compress } = await import('zstd-wasm')
    return Buffer.from(compress(data))
  }

  async decompress(data: Buffer): Promise<Buffer> {
    const { decompress } = await import('zstd-wasm')
    return Buffer.from(decompress(data))
  }
}
```

## Plugin System

### Creating a Backup Plugin

Build reusable plugins that combine adapters:

```ts
import type { BackupPlugin } from 'backupx'

export function createCloudBackupPlugin(options: {
  storage: 's3' | 'gcs' | 'azure'
  notifications: ('slack' | 'discord' | 'email')[]
  region: string
  bucket: string
}): BackupPlugin {
  return {
    name: 'cloud-backup',

    async setup(manager) {
      // Configure storage
      const storage = createStorageAdapter(options.storage, {
        region: options.region,
        bucket: options.bucket,
      })
      manager.setStorage(storage)

      // Configure notifications
      for (const notificationType of options.notifications) {
        const adapter = createNotificationAdapter(notificationType)
        manager.addNotification(adapter)
      }
    },

    async beforeBackup(context) {
      console.log(`Starting backup to ${options.storage}...`)
    },

    async afterBackup(context, result) {
      console.log(`Backup completed: ${result.filename}`)
    },
  }
}

// Usage
import { BackupManager } from 'backupx'
import { createCloudBackupPlugin } from './plugins/cloud-backup'

const manager = new BackupManager(config)

manager.use(createCloudBackupPlugin({
  storage: 's3',
  notifications: ['slack', 'discord'],
  region: 'us-east-1',
  bucket: 'my-backups',
}))

await manager.createBackup()
```

## Best Practices

1. **Interface Compliance**: Always implement the full interface for adapters
2. **Error Handling**: Handle errors gracefully and return meaningful error messages
3. **Async Operations**: Use async/await for all I/O operations
4. **Resource Cleanup**: Properly close connections and clean up resources
5. **Configuration Validation**: Validate adapter configuration at construction time
6. **Logging**: Include detailed logging for debugging
7. **Testing**: Write comprehensive tests for custom adapters
8. **Documentation**: Document adapter capabilities and configuration options
