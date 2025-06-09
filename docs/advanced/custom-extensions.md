# Custom Extensions

This guide covers how to extend backupx with custom backup types, storage providers, compression algorithms, and transformation pipelines.

## Custom Backup Types

### Creating a Custom Database Backup

```ts
import type { BackupResult, DatabaseConfig } from 'backupx'
import { BackupType } from 'backupx'

// Define custom backup type
export enum CustomBackupType {
  REDIS = 'REDIS',
  MONGODB = 'MONGODB',
}

interface RedisConfig extends DatabaseConfig {
  type: CustomBackupType.REDIS
  host: string
  port: number
  password?: string
  db?: number
  keyPattern?: string
}

class RedisBackupProvider {
  async backup(config: RedisConfig, outputPath: string): Promise<BackupResult> {
    const startTime = Date.now()
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${config.name}_${timestamp}.json`
    const fullPath = `${outputPath}/${filename}`

    try {
      // Connect to Redis and export data
      const data = await this.exportRedisData(config)

      // Save to file
      const fs = await import('node:fs/promises')
      await fs.writeFile(fullPath, JSON.stringify(data, null, 2))

      const stats = await fs.stat(fullPath)
      const duration = Date.now() - startTime

      return {
        name: config.name,
        type: CustomBackupType.REDIS,
        filename,
        size: stats.size,
        duration,
        success: true,
      }
    }
    catch (error) {
      return {
        name: config.name,
        type: CustomBackupType.REDIS,
        filename: '',
        size: 0,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private async exportRedisData(config: RedisConfig): Promise<any> {
    // Implementation would connect to Redis and export data
    // This is a simplified example
    return {
      timestamp: new Date().toISOString(),
      database: config.db || 0,
      keys: [], // Would contain actual Redis data
    }
  }
}
```

## Custom Storage Providers

### Abstract Storage Interface

```ts
interface StorageProvider {
  upload: (localPath: string, remotePath: string) => Promise<void>
  download: (remotePath: string, localPath: string) => Promise<void>
  list: (prefix?: string) => Promise<string[]>
  delete: (remotePath: string) => Promise<void>
}

class FTPStorageProvider implements StorageProvider {
  constructor(
    private config: {
      host: string
      port: number
      username: string
      password: string
    },
  ) {}

  async upload(localPath: string, remotePath: string): Promise<void> {
    // Implementation would use FTP client to upload file
    console.log(`Uploading ${localPath} to ${remotePath}`)
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    // Implementation would download from FTP
    console.log(`Downloading ${remotePath} to ${localPath}`)
  }

  async list(prefix = ''): Promise<string[]> {
    // Implementation would list FTP directory contents
    return []
  }

  async delete(remotePath: string): Promise<void> {
    // Implementation would delete file from FTP
    console.log(`Deleting ${remotePath}`)
  }
}
```

## Custom Compression

### Compression Provider Interface

```ts
import { Buffer } from 'node:buffer'

interface CompressionProvider {
  compress: (input: Buffer | string) => Promise<Buffer>
  decompress: (input: Buffer) => Promise<Buffer>
  getExtension: () => string
}

class BrotliCompressionProvider implements CompressionProvider {
  async compress(input: Buffer | string): Promise<Buffer> {
    const zlib = await import('node:zlib')
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8')

    return new Promise((resolve, reject) => {
      zlib.brotliCompress(buffer, (error, result) => {
        if (error)
          reject(error)
        else resolve(result)
      })
    })
  }

  async decompress(input: Buffer): Promise<Buffer> {
    const zlib = await import('node:zlib')

    return new Promise((resolve, reject) => {
      zlib.brotliDecompress(input, (error, result) => {
        if (error)
          reject(error)
        else resolve(result)
      })
    })
  }

  getExtension(): string {
    return '.br'
  }
}
```

## Plugin System

### Extensible Backup Manager

```ts
interface BackupPlugin {
  name: string
  version: string
  providers?: {
    database?: Map<string, any>
    storage?: Map<string, any>
    compression?: Map<string, any>
  }
  hooks?: {
    beforeBackup?: (config: any) => Promise<void>
    afterBackup?: (result: any) => Promise<void>
    onError?: (error: any) => Promise<void>
  }
}

class ExtensibleBackupManager extends BackupManager {
  private plugins: BackupPlugin[] = []
  private providers = {
    database: new Map<string, any>(),
    storage: new Map<string, any>(),
    compression: new Map<string, any>(),
  }

  registerPlugin(plugin: BackupPlugin): void {
    this.plugins.push(plugin)

    // Register providers
    if (plugin.providers?.database) {
      plugin.providers.database.forEach((provider, type) => {
        this.providers.database.set(type, provider)
      })
    }
  }

  async createBackup(): Promise<BackupSummary> {
    // Execute before hooks
    for (const plugin of this.plugins) {
      if (plugin.hooks?.beforeBackup) {
        await plugin.hooks.beforeBackup(this.config)
      }
    }

    try {
      const summary = await super.createBackup()

      // Execute after hooks
      for (const plugin of this.plugins) {
        if (plugin.hooks?.afterBackup) {
          await plugin.hooks.afterBackup(summary)
        }
      }

      return summary
    }
    catch (error) {
      // Execute error hooks
      for (const plugin of this.plugins) {
        if (plugin.hooks?.onError) {
          await plugin.hooks.onError(error)
        }
      }

      throw error
    }
  }
}

// Usage example
const manager = new ExtensibleBackupManager(config)

// Register Redis plugin
manager.registerPlugin({
  name: 'redis-backup',
  version: '1.0.0',
  providers: {
    database: new Map([
      [CustomBackupType.REDIS, new RedisBackupProvider()],
    ]),
  },
  hooks: {
    beforeBackup: async (config) => {
      console.log('Starting Redis backup...')
    },
    afterBackup: async (result) => {
      console.log('Redis backup completed!')
    },
  },
})
```

This extension system allows backupx to be highly customizable and adaptable to specific use cases while maintaining a clean, modular architecture.
