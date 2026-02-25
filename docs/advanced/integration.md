# Integration Patterns

This guide covers advanced integration patterns for backupx, including monitoring systems, web frameworks, and external services.

## Monitoring System Integration

### Prometheus & Grafana

```ts
import type { BackupResult, BackupSummary } from 'backupx'
import { BackupManager } from 'backupx'
// Expose metrics endpoint
import express from 'express'

import { Counter, Gauge, Histogram, register } from 'prom-client'

// Define metrics
const backupCounter = new Counter({
  name: 'backups_total',
  help: 'Total number of backups attempted',
  labelNames: ['type', 'name', 'status'],
})

const backupDuration = new Histogram({
  name: 'backup_duration_seconds',
  help: 'Backup duration in seconds',
  labelNames: ['type', 'name'],
  buckets: [1, 5, 10, 30, 60, 300, 600],
})

const backupSize = new Gauge({
  name: 'backup_size_bytes',
  help: 'Backup size in bytes',
  labelNames: ['type', 'name'],
})

class MonitoredBackupManager extends BackupManager {
  async createBackup(): Promise<BackupSummary> {
    const summary = await super.createBackup()

    // Update metrics for each backup result
    summary.results.forEach((result: BackupResult) => {
      const labels = {
        type: result.type,
        name: result.name,
        status: result.success ? 'success' : 'failure',
      }

      backupCounter.inc(labels)
      backupDuration.observe(
        { type: result.type, name: result.name },
        result.duration / 1000
      )

      if (result.success) {
        backupSize.set(
          { type: result.type, name: result.name },
          result.size
        )
      }
    })

    return summary
  }
}
const app = express()

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

app.listen(9090)
```

### Custom Webhook Integration

```ts
import type { BackupSummary } from 'backupx'

interface WebhookPayload {
  timestamp: string
  summary: BackupSummary
  environment: string
  server: string
}

class WebhookNotifier {
  constructor(
    private webhookUrl: string,
    private secret?: string,
  ) {}

  async notify(summary: BackupSummary): Promise<void> {
    const payload: WebhookPayload = {
      timestamp: new Date().toISOString(),
      summary,
      environment: process.env.NODE_ENV || 'development',
      server: process.env.HOSTNAME || 'unknown',
    }

    const body = JSON.stringify(payload)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'backupx/1.0',
    }

    // Add signature if secret is provided
    if (this.secret) {
      const crypto = await import('node:crypto')
      const signature = crypto
        .createHmac('sha256', this.secret)
        .update(body)
        .digest('hex')
      headers['X-Signature-SHA256'] = `sha256=${signature}`
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body,
      })

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`)
      }
    }
    catch (error) {
      console.error('Webhook notification failed:', error)
      // Don't throw - backup success shouldn't depend on notification
    }
  }
}

// Usage
const notifier = new WebhookNotifier(
  'https://api.example.com/webhooks/backups',
  process.env.WEBHOOK_SECRET,
)

const manager = new BackupManager(config)
const summary = await manager.createBackup()
await notifier.notify(summary)
```

## Web Framework Integration

### Express.js API

```ts
import type { BackupConfig } from 'backupx'
import { BackupManager } from 'backupx'
import express from 'express'

const app = express()
app.use(express.json())

// Backup status tracking
const backupStatus = {
  isRunning: false,
  lastRun: null as Date | null,
  lastResult: null as any,
}

// Trigger backup endpoint
app.post('/api/backup/trigger', async (req, res) => {
  if (backupStatus.isRunning) {
    return res.status(409).json({
      error: 'Backup already in progress',
      isRunning: true,
    })
  }

  try {
    backupStatus.isRunning = true
    const config: BackupConfig = req.body.config || defaultConfig

    const manager = new BackupManager(config)
    const summary = await manager.createBackup()

    backupStatus.lastRun = new Date()
    backupStatus.lastResult = summary

    res.json({
      success: true,
      summary,
      timestamp: backupStatus.lastRun,
    })
  }
  catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Backup failed',
      timestamp: new Date(),
    })
  }
  finally {
    backupStatus.isRunning = false
  }
})

// Status endpoint
app.get('/api/backup/status', (req, res) => {
  res.json(backupStatus)
})

// List backups endpoint
app.get('/api/backup/list', async (req, res) => {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    const backupDir = process.env.BACKUP_PATH || './backups'
    const files = await fs.readdir(backupDir)

    const backups = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(backupDir, file)
        const stats = await fs.stat(filePath)
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        }
      }),
    )

    res.json(backups.sort((a, b) =>
      new Date(b.created).getTime() - new Date(a.created).getTime()
    ))
  }
  catch (error) {
    res.status(500).json({
      error: 'Failed to list backups',
    })
  }
})

app.listen(3000)
```

### Fastify Integration

```ts
import type { BackupConfig } from 'backupx'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { BackupManager } from 'backupx'
import fastify from 'fastify'

// Plugin for backup functionality
async function backupPlugin(fastify: FastifyInstance) {
  let currentBackup: Promise<any> | null = null

  fastify.post('/backup', async (request: FastifyRequest, reply: FastifyReply) => {
    if (currentBackup) {
      reply.code(409)
      return { error: 'Backup in progress' }
    }

    try {
      const config = request.body as BackupConfig
      const manager = new BackupManager(config)

      currentBackup = manager.createBackup()
      const summary = await currentBackup

      return {
        success: true,
        summary,
        timestamp: new Date().toISOString(),
      }
    }
    catch (error) {
      reply.code(500)
      return {
        error: error instanceof Error ? error.message : 'Backup failed',
      }
    }
    finally {
      currentBackup = null
    }
  })

  fastify.get('/backup/status', async () => {
    return {
      isRunning: currentBackup !== null,
      timestamp: new Date().toISOString(),
    }
  })
}

const app = fastify({ logger: true })
app.register(backupPlugin)
app.listen({ port: 3000 })
```

## Cloud Services Integration

### AWS S3 Upload

```ts
import type { BackupResult } from 'backupx'
import { createReadStream } from 'node:fs'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { BackupManager } from 'backupx'

class S3BackupManager extends BackupManager {
  private s3Client: S3Client

  constructor(
    config: any,
    private bucketName: string,
    private s3Config?: any,
  ) {
    super(config)
    this.s3Client = new S3Client(s3Config || {})
  }

  async createBackup() {
    const summary = await super.createBackup()

    // Upload successful backups to S3
    for (const result of summary.results) {
      if (result.success && result.filename) {
        await this.uploadToS3(result)
      }
    }

    return summary
  }

  private async uploadToS3(result: BackupResult): Promise<void> {
    try {
      const filePath = `${this.config.outputPath}/${result.filename}`
      const s3Key = `backups/${new Date().toISOString().split['T'](0)}/${result.filename}`

      const fileStream = createReadStream(filePath)

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: fileStream,
        ContentType: 'application/octet-stream',
        Metadata: {
          'backup-type': result.type,
          'backup-name': result.name,
          'original-size': result.size.toString(),
          'created-at': new Date().toISOString(),
        },
      })

      await this.s3Client.send(command)

      if (this.config.verbose) {
        console.warn(`📤 Uploaded ${result.filename} to S3: ${s3Key}`)
      }
    }
    catch (error) {
      console.error(`Failed to upload ${result.filename} to S3:`, error)
      // Don't throw - backup success shouldn't depend on upload
    }
  }
}

// Usage
const manager = new S3BackupManager(
  backupConfig,
  'my-backup-bucket',
  {
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  },
)
```

### Google Cloud Storage

```ts
import type { BackupResult } from 'backupx'
import { Storage } from '@google-cloud/storage'

class GCSBackupManager extends BackupManager {
  private storage: Storage
  private bucket: any

  constructor(
    config: any,
    private bucketName: string,
    private gcsConfig?: any,
  ) {
    super(config)
    this.storage = new Storage(gcsConfig)
    this.bucket = this.storage.bucket(bucketName)
  }

  async createBackup() {
    const summary = await super.createBackup()

    // Upload to GCS in parallel
    await Promise.allSettled(
      summary.results
        .filter(result => result.success && result.filename)
        .map(result => this.uploadToGCS(result)),
    )

    return summary
  }

  private async uploadToGCS(result: BackupResult): Promise<void> {
    try {
      const filePath = `${this.config.outputPath}/${result.filename}`
      const gcsPath = `backups/${new Date().toISOString().split['T'](0)}/${result.filename}`

      await this.bucket.upload(filePath, {
        destination: gcsPath,
        metadata: {
          metadata: {
            backupType: result.type,
            backupName: result.name,
            originalSize: result.size.toString(),
            createdAt: new Date().toISOString(),
          },
        },
      })

      if (this.config.verbose) {
        console.warn(`📤 Uploaded ${result.filename} to GCS: ${gcsPath}`)
      }
    }
    catch (error) {
      console.error(`Failed to upload ${result.filename} to GCS:`, error)
    }
  }
}
```

## Message Queue Integration

### Redis/Bull Queue

```ts
import type { BackupConfig } from 'backupx'
import { BackupManager } from 'backupx'
import Queue from 'bull'

// Create backup queue
const backupQueue = new Queue('backup processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6379'),
  },
})

// Define job processor
backupQueue.process('database-backup', async (job) => {
  const { config } = job.data
  const manager = new BackupManager(config)

  // Update job progress
  job.progress(10)

  try {
    const summary = await manager.createBackup()
    job.progress(100)

    return {
      success: true,
      summary,
      completedAt: new Date().toISOString(),
    }
  }
  catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Backup failed')
  }
})

// Schedule recurring backups
export async function scheduleBackup(config: BackupConfig, cronPattern: string) {
  return backupQueue.add(
    'database-backup',
    { config },
    {
      repeat: { cron: cronPattern },
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  )
}

// Usage
await scheduleBackup(config, '0 2 _ _ *') // Daily at 2 AM
```

## Event-Driven Architecture

### Custom Event System

```ts
import type { BackupResult, BackupSummary } from 'backupx'
import { EventEmitter } from 'node:events'

interface BackupEvents {
  'backup:start': (config: any) => void
  'backup:progress': (current: number, total: number) => void
  'backup:complete': (summary: BackupSummary) => void
  'backup:error': (error: Error) => void
  'backup:result': (result: BackupResult) => void
}

class EventDrivenBackupManager extends BackupManager {
  private emitter = new EventEmitter()

  on<K extends keyof BackupEvents>(event: K, listener: BackupEvents[K]) {
    this.emitter.on(event, listener)
    return this
  }

  async createBackup(): Promise<BackupSummary> {
    this.emitter.emit('backup:start', this.config)

    try {
      const summary = await super.createBackup()

      // Emit individual results
      summary.results.forEach((result) => {
        this.emitter.emit('backup:result', result)
      })

      this.emitter.emit('backup:complete', summary)
      return summary
    }
    catch (error) {
      this.emitter.emit('backup:error', error as Error)
      throw error
    }
  }
}

// Usage with multiple listeners
const manager = new EventDrivenBackupManager(config)

// Log progress
manager.on('backup:start', () => {
  console.log('🚀 Backup process started')
})

// Send notifications
manager.on('backup:complete', async (summary) => {
  if (summary.failureCount > 0) {
    await sendSlackNotification(`⚠️ Backup completed with ${summary.failureCount} failures`)
  }
  else {
    await sendSlackNotification('✅ All backups completed successfully')
  }
})

// Update metrics
manager.on('backup:result', (result) => {
  updatePrometheusMetrics(result)
})
```

This integration patterns guide provides comprehensive examples for integrating backupx with various systems and architectures, enabling robust, monitored, and scalable backup solutions.
