# Web Application Examples

This guide shows how to integrate ts-backups into web applications for automated database and file backups.

## Express.js Integration

### Basic Backup Route

```ts
import type { BackupConfig } from 'ts-backups'
import express from 'express'
import { BackupManager, BackupType } from 'ts-backups'

const app = express()
app.use(express.json())

// Backup configuration
const backupConfig: BackupConfig = {
  verbose: true,
  databases: [
    {
      type: BackupType.POSTGRESQL,
      name: 'main-database',
      connection: process.env.DATABASE_URL!,
    },
  ],
  files: [
    {
      name: 'uploads',
      path: './uploads',
      exclude: ['**/*.tmp'],
      compress: true,
    },
  ],
  outputPath: './backups',
  retention: {
    count: 30,
    maxAge: 90,
  },
}

// Manual backup trigger
app.post('/api/backup', async (req, res) => {
  try {
    const manager = new BackupManager(backupConfig)
    const summary = await manager.createBackup()

    res.json({
      success: true,
      summary,
    })
  }
  catch (error) {
    console.error('Backup failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

// Backup status endpoint
app.get('/api/backup/status', async (req, res) => {
  try {
    const manager = new BackupManager(backupConfig)
    const history = await manager.getBackupHistory(5)

    res.json({
      lastBackup: history[0] || null,
      recentBackups: history.length,
      isConfigured: backupConfig.databases.length > 0 || backupConfig.files.length > 0,
    })
  }
  catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

app.listen(3000)
```

### Scheduled Backups with Cron

```ts
import cron from 'node-cron'
import { BackupManager } from 'ts-backups'

class BackupScheduler {
  private manager: BackupManager
  private jobs: Map<string, cron.ScheduledTask> = new Map()

  constructor(config: BackupConfig) {
    this.manager = new BackupManager(config)
  }

  scheduleDaily(hour = 2, minute = 0): void {
    const cronExpression = `${minute} ${hour} * * *`

    const task = cron.schedule(cronExpression, async () => {
      console.log('🕐 Starting scheduled backup...')
      try {
        const summary = await this.manager.createBackup()
        console.log(`✅ Backup completed: ${summary.successCount}/${summary.results.length} successful`)

        // Send notification (email, Slack, etc.)
        await this.notifySuccess(summary)
      }
      catch (error) {
        console.error('❌ Scheduled backup failed:', error)
        await this.notifyFailure(error as Error)
      }
    }, {
      scheduled: false,
    })

    this.jobs.set('daily', task)
  }

  scheduleWeekly(dayOfWeek = 0, hour = 1, minute = 0): void {
    const cronExpression = `${minute} ${hour} * * ${dayOfWeek}`

    const task = cron.schedule(cronExpression, async () => {
      console.log('🗓️ Starting weekly backup...')

      try {
        // Create a more comprehensive backup weekly
        const summary = await this.manager.createBackup()

        // Additional weekly tasks
        await this.generateBackupReport(summary)
        await this.notifySuccess(summary, 'weekly')
      }
      catch (error) {
        console.error('❌ Weekly backup failed:', error)
        await this.notifyFailure(error as Error, 'weekly')
      }
    }, {
      scheduled: false,
    })

    this.jobs.set('weekly', task)
  }

  start(): void {
    this.jobs.forEach((task, name) => {
      task.start()
      console.log(`📅 Started ${name} backup schedule`)
    })
  }

  stop(): void {
    this.jobs.forEach((task, name) => {
      task.stop()
      console.log(`⏹️ Stopped ${name} backup schedule`)
    })
  }

  private async notifySuccess(summary: any, type = 'daily'): Promise<void> {
    // Implementation would send email/Slack notification
    console.log(`📧 Sending ${type} backup success notification`)
  }

  private async notifyFailure(error: Error, type = 'daily'): Promise<void> {
    // Implementation would send error notification
    console.error(`🚨 Sending ${type} backup failure notification:`, error.message)
  }

  private async generateBackupReport(summary: any): Promise<void> {
    // Generate detailed weekly report
    console.log('📊 Generating weekly backup report')
  }
}

// Usage in Express app
const scheduler = new BackupScheduler(backupConfig)

// Schedule daily backups at 2 AM
scheduler.scheduleDaily(2, 0)

// Schedule weekly backups on Sunday at 1 AM
scheduler.scheduleWeekly(0, 1, 0)

// Start the scheduler
scheduler.start()

// Graceful shutdown
process.on('SIGINT', () => {
  scheduler.stop()
  process.exit(0)
})
```

## Next.js API Route

### App Router API Route

```ts
// app/api/backup/route.ts
import type { BackupConfig } from 'ts-backups'
import { NextRequest, NextResponse } from 'next/server'
import { BackupManager, BackupType } from 'ts-backups'

const backupConfig: BackupConfig = {
  verbose: false,
  databases: [
    {
      type: BackupType.POSTGRESQL,
      name: 'nextjs-app',
      connection: process.env.DATABASE_URL!,
    },
  ],
  outputPath: './backups',
  retention: { count: 20, maxAge: 60 },
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const manager = new BackupManager(backupConfig)
    const summary = await manager.createBackup()

    return NextResponse.json({
      success: true,
      summary: {
        startTime: summary.startTime,
        duration: summary.duration,
        successCount: summary.successCount,
        failureCount: summary.failureCount,
        totalSize: summary.totalSize,
      },
    })
  }
  catch (error) {
    console.error('Backup failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backup failed' },
      { status: 500 },
    )
  }
}

export async function GET() {
  try {
    const manager = new BackupManager(backupConfig)
    const history = await manager.getBackupHistory(10)

    return NextResponse.json({
      recentBackups: history.map(backup => ({
        startTime: backup.startTime,
        duration: backup.duration,
        successCount: backup.successCount,
        totalSize: backup.totalSize,
      })),
    })
  }
  catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch backup history' },
      { status: 500 },
    )
  }
}
```

### Pages Router API Route

```ts
// pages/api/backup.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import type { BackupConfig } from 'ts-backups'
import { BackupManager, BackupType } from 'ts-backups'

const backupConfig: BackupConfig = {
  verbose: process.env.NODE_ENV === 'development',
  databases: [
    {
      type: BackupType.POSTGRESQL,
      name: 'app-database',
      connection: process.env.DATABASE_URL!,
    },
  ],
  files: [
    {
      name: 'public-uploads',
      path: './public/uploads',
      exclude: ['**/*.tmp', '**/.DS_Store'],
      compress: true,
    },
  ],
  outputPath: process.env.BACKUP_PATH || './backups',
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Check API key
  const apiKey = req.headers['x-api-key']
  if (apiKey !== process.env.BACKUP_API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  try {
    const manager = new BackupManager(backupConfig)
    const summary = await manager.createBackup()

    res.status(200).json({
      success: true,
      message: 'Backup completed successfully',
      summary: {
        duration: summary.duration,
        successCount: summary.successCount,
        failureCount: summary.failureCount,
        totalSize: summary.totalSize,
        results: summary.results.map(result => ({
          name: result.name,
          type: result.type,
          success: result.success,
          size: result.size,
          error: result.error,
        })),
      },
    })
  }
  catch (error) {
    console.error('Backup failed:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
```

## React Admin Dashboard

### Backup Management Component

```tsx
// components/BackupManager.tsx
import React, { useEffect, useState } from 'react'

interface BackupSummary {
  startTime: string
  duration: number
  successCount: number
  failureCount: number
  totalSize: number
}

interface BackupHistory {
  recentBackups: BackupSummary[]
}

export function BackupManager() {
  const [isRunning, setIsRunning] = useState(false)
  const [history, setHistory] = useState<BackupHistory | null>(null)
  const [lastBackup, setLastBackup] = useState<BackupSummary | null>(null)

  useEffect(() => {
    fetchBackupHistory()
  }, [])

  const fetchBackupHistory = async () => {
    try {
      const response = await fetch('/api/backup', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      })

      const data = await response.json()
      setHistory(data)
      setLastBackup(data.recentBackups[0] || null)
    }
    catch (error) {
      console.error('Failed to fetch backup history:', error)
    }
  }

  const triggerBackup = async () => {
    setIsRunning(true)

    try {
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (result.success) {
        setLastBackup(result.summary)
        await fetchBackupHistory()
        alert('Backup completed successfully!')
      }
      else {
        throw new Error(result.error)
      }
    }
    catch (error) {
      console.error('Backup failed:', error)
      alert(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    finally {
      setIsRunning(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0)
      return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / 1024 ** i * 100) / 100} ${sizes[i]}`
  }

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0)
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0)
      return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  return (
    <div className="backup-manager">
      <h2>Backup Management</h2>

      {/* Current Status */}
      <div className="status-card">
        <h3>Current Status</h3>
        {lastBackup
          ? (
              <div>
                <p>
                  Last backup:
                  {new Date(lastBackup.startTime).toLocaleString()}
                </p>
                <p>
                  Duration:
                  {formatDuration(lastBackup.duration)}
                </p>
                <p>
                  Success:
                  {lastBackup.successCount}
                  /
                  {lastBackup.successCount + lastBackup.failureCount}
                </p>
                <p>
                  Size:
                  {formatBytes(lastBackup.totalSize)}
                </p>
              </div>
            )
          : (
              <p>No backups found</p>
            )}
      </div>

      {/* Actions */}
      <div className="actions">
        <button
          onClick={triggerBackup}
          disabled={isRunning}
          className="backup-button"
        >
          {isRunning ? 'Creating Backup...' : 'Start Backup'}
        </button>

        <button
          onClick={fetchBackupHistory}
          className="refresh-button"
        >
          Refresh History
        </button>
      </div>

      {/* History */}
      {history && (
        <div className="history">
          <h3>Recent Backups</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {history.recentBackups.map((backup, index) => (
                <tr key={index}>
                  <td>{new Date(backup.startTime).toLocaleDateString()}</td>
                  <td>{formatDuration(backup.duration)}</td>
                  <td>
                    <span className={backup.failureCount > 0 ? 'status-warning' : 'status-success'}>
                      {backup.successCount}
                      /
                      {backup.successCount + backup.failureCount}
                    </span>
                  </td>
                  <td>{formatBytes(backup.totalSize)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

## Background Job Processing

### Bull Queue Integration

```ts
import type { BackupConfig } from 'ts-backups'
import Queue from 'bull'
import { BackupManager } from 'ts-backups'

// Create backup queue
const backupQueue = new Queue('backup processing', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6379'),
  },
})

// Process backup jobs
backupQueue.process('database-backup', async (job) => {
  const { config, userId } = job.data

  try {
    // Update job progress
    await job.progress(10)

    const manager = new BackupManager(config)

    await job.progress(50)

    const summary = await manager.createBackup()

    await job.progress(100)

    // Store result in database or send notification
    await notifyUser(userId, {
      success: true,
      summary,
    })

    return { success: true, summary }
  }
  catch (error) {
    await notifyUser(userId, {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    throw error
  }
})

// Queue a backup job
export async function queueBackup(config: BackupConfig, userId: string) {
  const job = await backupQueue.add('database-backup', {
    config,
    userId,
  }, {
    attempts: 3,
    backoff: 'exponential',
    delay: 5000, // 5 second delay
  })

  return job.id
}

// Express route to queue backup
app.post('/api/backup/queue', async (req, res) => {
  try {
    const userId = req.user.id // Assume auth middleware
    const jobId = await queueBackup(backupConfig, userId)

    res.json({
      success: true,
      jobId,
      message: 'Backup queued successfully',
    })
  }
  catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue backup',
    })
  }
})

async function notifyUser(userId: string, result: any) {
  // Implementation to notify user via email, push notification, etc.
  console.log(`Notifying user ${userId}:`, result)
}
```

This guide provides comprehensive examples for integrating ts-backups into web applications with proper error handling, scheduling, and user interfaces.
