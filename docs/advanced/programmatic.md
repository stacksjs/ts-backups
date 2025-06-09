# Programmatic Usage

backupx is designed to be used programmatically in your applications, allowing for custom integration, automation, and advanced backup workflows.

## Overview

Programmatic usage enables:
- **Custom Integration**: Embed backups in your application logic
- **Dynamic Configuration**: Generate backup configs at runtime
- **Event-Driven Backups**: Trigger backups based on application events
- **Custom Error Handling**: Implement sophisticated error recovery
- **Progress Monitoring**: Track backup progress in real-time

## Basic Programmatic Usage

### Simple Backup

```ts
import type { BackupConfig } from 'backupx'
import { BackupManager, BackupType } from 'backupx'

const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',
  databases: [
    {
      type: BackupType.SQLITE,
      name: 'app-db',
      path: './database.sqlite',
      compress: true,
    }
  ],
  files: [
    {
      name: 'uploads',
      path: './uploads',
      compress: true,
    }
  ],
  retention: {
    count: 10,
    maxAge: 30,
  }
}

// Create and run backup
const manager = new BackupManager(config)
const summary = await manager.createBackup()

console.log(`✅ Backup completed: ${summary.successCount}/${summary.totalCount}`)
```

### Individual Backup Functions

Use specific backup functions for more control:

```ts
import {
  backupDirectory,
  backupFile,
  backupMySQL,
  backupPostgreSQL,
  backupSQLite
} from 'backupx'

// Database backups
const sqliteResult = await backupSQLite({
  type: BackupType.SQLITE,
  name: 'app-db',
  path: './database.sqlite',
}, './backups')

const pgResult = await backupPostgreSQL({
  type: BackupType.POSTGRESQL,
  name: 'main-db',
  connection: process.env.DATABASE_URL!,
  includeSchema: true,
  includeData: true,
}, './backups')

// File backups
const fileResult = await backupFile({
  name: 'config',
  path: './config.json',
  preserveMetadata: true,
}, './backups')

const dirResult = await backupDirectory({
  name: 'source',
  path: './src',
  exclude: ['node_modules/**'],
  compress: true,
}, './backups')
```

## Dynamic Configuration

### Runtime Configuration

Build configurations dynamically based on application state:

```ts
async function createDynamicBackupConfig(): Promise<BackupConfig> {
  const isProduction = process.env.NODE_ENV === 'production'
  const hasDatabase = await checkDatabaseConnection()
  const hasFiles = await checkFilesExist('./uploads')

  const config: BackupConfig = {
    verbose: !isProduction,
    outputPath: isProduction ? '/var/backups' : './dev-backups',
    databases: [],
    files: [],
    retention: isProduction
      ? { count: 30, maxAge: 90 }
      : { count: 5, maxAge: 7 }
  }

  // Add database config if available
  if (hasDatabase) {
    config.databases.push({
      type: BackupType.POSTGRESQL,
      name: 'app-db',
      connection: process.env.DATABASE_URL!,
      compress: true,
    })
  }

  // Add file config if directory exists
  if (hasFiles) {
    config.files.push({
      name: 'uploads',
      path: './uploads',
      compress: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
    })
  }

  return config
}

// Use dynamic configuration
const config = await createDynamicBackupConfig()
const manager = new BackupManager(config)
const summary = await manager.createBackup()
```

### Environment-Based Configuration

```ts
function getEnvironmentConfig(): BackupConfig {
  const env = process.env.NODE_ENV || 'development'

  const baseConfig: BackupConfig = {
    verbose: env === 'development',
    databases: [
      {
        type: BackupType.SQLITE,
        name: 'app-db',
        path: './database.sqlite',
      }
    ],
    files: [
      {
        name: 'config',
        path: './config',
      }
    ],
  }

  switch (env) {
    case 'development':
      return {
        ...baseConfig,
        outputPath: './dev-backups',
        retention: { count: 3 },
      }

    case 'staging':
      return {
        ...baseConfig,
        outputPath: './staging-backups',
        retention: { count: 14, maxAge: 30 },
        databases: baseConfig.databases.map(db => ({ ...db, compress: true })),
      }

    case 'production':
      return {
        ...baseConfig,
        verbose: false,
        outputPath: '/var/backups/app',
        retention: { count: 30, maxAge: 365 },
        databases: [
          {
            type: BackupType.POSTGRESQL,
            name: 'prod-db',
            connection: process.env.DATABASE_URL!,
            compress: true,
            excludeTables: ['sessions', 'logs'],
          }
        ],
      }

    default:
      return baseConfig
  }
}
```

## Event-Driven Backups

### Application Event Integration

```ts
import { EventEmitter } from 'node:events'

class ApplicationBackupService extends EventEmitter {
  private backupManager: BackupManager

  constructor(config: BackupConfig) {
    super()
    this.backupManager = new BackupManager(config)
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Backup on critical application events
    this.on('user:created', this.scheduleBackup.bind(this))
    this.on('data:imported', this.scheduleBackup.bind(this))
    this.on('config:changed', this.scheduleConfigBackup.bind(this))
    this.on('app:shutdown', this.forceBackup.bind(this))
  }

  private async scheduleBackup() {
    // Debounced backup to avoid too frequent backups
    if (this.backupTimeout) {
      clearTimeout(this.backupTimeout)
    }

    this.backupTimeout = setTimeout(async () => {
      try {
        const summary = await this.backupManager.createBackup()
        this.emit('backup:completed', summary)
      }
      catch (error) {
        this.emit('backup:failed', error)
      }
    }, 5000) // Wait 5 seconds for other events
  }

  private async scheduleConfigBackup() {
    // Immediate backup for critical configuration changes
    try {
      const configBackup = new BackupManager({
        verbose: false,
        outputPath: './config-backups',
        files: [
          {
            name: 'config',
            path: './config',
            preserveMetadata: true,
          }
        ],
        retention: { count: 20 },
      })

      await configBackup.createBackup()
      this.emit('config:backed-up')
    }
    catch (error) {
      this.emit('config-backup:failed', error)
    }
  }

  private async forceBackup() {
    // Critical backup before shutdown
    if (this.backupTimeout) {
      clearTimeout(this.backupTimeout)
    }

    try {
      const summary = await this.backupManager.createBackup()
      this.emit('shutdown-backup:completed', summary)
    }
    catch (error) {
      this.emit('shutdown-backup:failed', error)
    }
  }

  private backupTimeout?: NodeJS.Timeout
}

// Usage
const backupService = new ApplicationBackupService(config)

// Listen for backup events
backupService.on('backup:completed', (summary) => {
  console.log(`✅ Backup completed: ${summary.successCount} items`)
})

backupService.on('backup:failed', (error) => {
  console.error('❌ Backup failed:', error)
  // Send alert, retry, etc.
})

// Trigger backups from application events
app.on('user-registration', () => {
  backupService.emit('user:created')
})

app.on('data-import-complete', () => {
  backupService.emit('data:imported')
})
```

### Scheduled Backups

```ts
import { CronJob } from 'cron'

class ScheduledBackupService {
  private jobs: CronJob[] = []

  constructor(private configs: Record<string, BackupConfig>) {}

  start() {
    // Daily full backup at 2 AM
    this.addJob('0 2 * * *', 'full', async () => {
      const manager = new BackupManager(this.configs.full)
      const summary = await manager.createBackup()

      await this.sendNotification('daily-backup', summary)
    })

    // Hourly incremental backup (files only)
    this.addJob('0 * * * *', 'incremental', async () => {
      const manager = new BackupManager(this.configs.incremental)
      const summary = await manager.createBackup()

      if (summary.failureCount > 0) {
        await this.sendAlert('incremental-backup-failed', summary)
      }
    })

    // Weekly deep backup (everything + older retention)
    this.addJob('0 1 * * 0', 'weekly', async () => {
      const manager = new BackupManager(this.configs.weekly)
      const summary = await manager.createBackup()

      await this.sendReport('weekly-backup', summary)
    })
  }

  stop() {
    this.jobs.forEach(job => job.stop())
    this.jobs = []
  }

  private addJob(schedule: string, name: string, task: () => Promise<void>) {
    const job = new CronJob(schedule, async () => {
      try {
        console.log(`🕐 Starting ${name} backup...`)
        await task()
        console.log(`✅ ${name} backup completed`)
      }
      catch (error) {
        console.error(`❌ ${name} backup failed:`, error)
        await this.sendAlert(`${name}-backup-error`, error)
      }
    })

    this.jobs.push(job)
    job.start()
  }

  private async sendNotification(type: string, summary: any) {
    // Send success notification
  }

  private async sendAlert(type: string, error: any) {
    // Send error alert
  }

  private async sendReport(type: string, summary: any) {
    // Send detailed report
  }
}
```

## Advanced Error Handling

### Retry Logic

```ts
class RobustBackupManager {
  constructor(
    private config: BackupConfig,
    private retryOptions = { maxRetries: 3, delay: 1000, backoff: 2 }
  ) {}

  async createBackupWithRetry(): Promise<BackupSummary> {
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        console.log(`🔄 Backup attempt ${attempt}/${this.retryOptions.maxRetries}`)

        const manager = new BackupManager(this.config)
        const summary = await manager.createBackup()

        console.log(`✅ Backup succeeded on attempt ${attempt}`)
        return summary
      }
      catch (error) {
        lastError = error as Error
        console.error(`❌ Backup attempt ${attempt} failed:`, error)

        if (attempt < this.retryOptions.maxRetries) {
          const delay = this.retryOptions.delay * this.retryOptions.backoff ** (attempt - 1)
          console.log(`⏳ Retrying in ${delay}ms...`)
          await this.sleep(delay)
        }
      }
    }

    throw new Error(`Backup failed after ${this.retryOptions.maxRetries} attempts: ${lastError?.message}`)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Usage
const robustManager = new RobustBackupManager(config, {
  maxRetries: 5,
  delay: 2000,
  backoff: 1.5
})

try {
  const summary = await robustManager.createBackupWithRetry()
}
catch (error) {
  // All retries failed, handle critical error
  await sendCriticalAlert(error)
}
```

### Partial Failure Handling

```ts
async function handlePartialFailures(config: BackupConfig) {
  const manager = new BackupManager(config)
  const summary = await manager.createBackup()

  if (summary.failureCount > 0) {
    console.warn(`⚠️ ${summary.failureCount} backups failed`)

    // Analyze failures
    const dbFailures = summary.databaseBackups.filter(r => !r.success)
    const fileFailures = summary.fileBackups.filter(r => !r.success)

    // Handle database failures
    for (const failure of dbFailures) {
      if (failure.error?.includes('connection')) {
        await handleDatabaseConnectionError(failure)
      }
      else if (failure.error?.includes('permission')) {
        await handleDatabasePermissionError(failure)
      }
    }

    // Handle file failures
    for (const failure of fileFailures) {
      if (failure.error?.includes('ENOENT')) {
        await handleFileNotFoundError(failure)
      }
      else if (failure.error?.includes('EACCES')) {
        await handleFilePermissionError(failure)
      }
    }

    // Decide if we should retry failed items
    if (summary.successCount > 0 && summary.failureCount < summary.successCount) {
      console.log('💡 Some backups succeeded, considering partial success')
      await sendPartialSuccessNotification(summary)
    }
    else {
      console.error('❌ More failures than successes, treating as critical')
      await sendCriticalFailureAlert(summary)
    }
  }

  return summary
}

async function handleDatabaseConnectionError(failure: BackupResult) {
  console.log(`🔄 Retrying database backup: ${failure.name}`)
  // Implement database-specific retry logic
}

async function handleFileNotFoundError(failure: BackupResult) {
  console.log(`📁 File not found: ${failure.name}`)
  // Maybe the file was moved or deleted, update config
}
```

## Progress Monitoring

### Real-time Progress Tracking

```ts
interface BackupProgress {
  stage: 'database' | 'files' | 'cleanup'
  current: number
  total: number
  currentItem: string
  startTime: number
}

class ProgressAwareBackupManager {
  private progress: BackupProgress = {
    stage: 'database',
    current: 0,
    total: 0,
    currentItem: '',
    startTime: 0
  }

  private progressCallback?: (progress: BackupProgress) => void

  constructor(
    private config: BackupConfig,
    progressCallback?: (progress: BackupProgress) => void
  ) {
    this.progressCallback = progressCallback
  }

  async createBackup(): Promise<BackupSummary> {
    this.progress.startTime = Date.now()
    this.progress.total = this.config.databases.length + this.config.files.length
    this.progress.current = 0

    const results: BackupResult[] = []

    // Database backups
    this.progress.stage = 'database'
    this.updateProgress()

    for (const dbConfig of this.config.databases) {
      this.progress.currentItem = dbConfig.name
      this.updateProgress()

      try {
        const result = await this.backupDatabase(dbConfig)
        results.push(result)
      }
      catch (error) {
        results.push({
          type: dbConfig.type,
          name: dbConfig.name,
          filename: '',
          size: 0,
          success: false,
          error: error.message,
        })
      }

      this.progress.current++
      this.updateProgress()
    }

    // File backups
    this.progress.stage = 'files'
    this.updateProgress()

    for (const fileConfig of this.config.files) {
      this.progress.currentItem = fileConfig.name
      this.updateProgress()

      try {
        const result = await this.backupFile(fileConfig)
        results.push(result)
      }
      catch (error) {
        results.push({
          type: BackupType.FILE,
          name: fileConfig.name,
          filename: '',
          size: 0,
          success: false,
          error: error.message,
        })
      }

      this.progress.current++
      this.updateProgress()
    }

    // Cleanup
    this.progress.stage = 'cleanup'
    this.progress.currentItem = 'Cleaning up old backups'
    this.updateProgress()

    // ... cleanup logic

    return this.createSummary(results)
  }

  private updateProgress() {
    if (this.progressCallback) {
      this.progressCallback({ ...this.progress })
    }
  }

  private async backupDatabase(config: any): Promise<BackupResult> {
    // Implementation...
    return {} as BackupResult
  }

  private async backupFile(config: any): Promise<BackupResult> {
    // Implementation...
    return {} as BackupResult
  }

  private createSummary(results: BackupResult[]): BackupSummary {
    // Implementation...
    return {} as BackupSummary
  }
}

// Usage with progress tracking
const progressManager = new ProgressAwareBackupManager(config, (progress) => {
  const elapsed = Date.now() - progress.startTime
  const percentage = Math.round((progress.current / progress.total) * 100)

  console.log(`📊 ${progress.stage} backup: ${percentage}% (${progress.current}/${progress.total})`)
  console.log(`   Current: ${progress.currentItem}`)
  console.log(`   Elapsed: ${Math.round(elapsed / 1000)}s`)

  // Update UI, send to monitoring system, etc.
  updateBackupProgressUI(progress)
})

const summary = await progressManager.createBackup()
```

### Integration with Monitoring Systems

```ts
interface MonitoringService {
  sendMetric: (name: string, value: number, tags?: Record<string, string>) => void
  sendEvent: (event: string, data: any) => void
}

class MonitoredBackupManager {
  constructor(
    private config: BackupConfig,
    private monitoring: MonitoringService
  ) {}

  async createBackup(): Promise<BackupSummary> {
    const startTime = Date.now()

    this.monitoring.sendEvent('backup.started', {
      databases: this.config.databases.length,
      files: this.config.files.length,
    })

    try {
      const manager = new BackupManager(this.config)
      const summary = await manager.createBackup()

      const duration = Date.now() - startTime

      // Send success metrics
      this.monitoring.sendMetric('backup.duration', duration)
      this.monitoring.sendMetric('backup.success_count', summary.successCount)
      this.monitoring.sendMetric('backup.failure_count', summary.failureCount)

      // Send detailed events
      this.monitoring.sendEvent('backup.completed', {
        duration,
        totalCount: summary.totalCount,
        successCount: summary.successCount,
        failureCount: summary.failureCount,
      })

      return summary
    }
    catch (error) {
      const duration = Date.now() - startTime

      this.monitoring.sendMetric('backup.error', 1)
      this.monitoring.sendEvent('backup.failed', {
        duration,
        error: error.message,
      })

      throw error
    }
  }
}

// Usage with monitoring
const monitoredManager = new MonitoredBackupManager(config, {
  sendMetric: (name, value, tags) => {
    // Send to DataDog, Prometheus, etc.
    console.log(`Metric: ${name} = ${value}`, tags)
  },
  sendEvent: (event, data) => {
    // Send to logging service
    console.log(`Event: ${event}`, data)
  }
})
```

## Testing and Development

### Mock Backup Services

```ts
// For testing without actual backups
class MockBackupManager {
  constructor(private config: BackupConfig) {}

  async createBackup(): Promise<BackupSummary> {
    // Simulate backup process
    await this.sleep(100)

    const results: BackupResult[] = []

    // Mock database backups
    for (const db of this.config.databases) {
      results.push({
        type: db.type,
        name: db.name,
        filename: `${db.name}_mock.sql`,
        size: Math.floor(Math.random() * 1000000),
        success: Math.random() > 0.1, // 90% success rate
        error: Math.random() > 0.9 ? 'Mock error' : undefined,
      })
    }

    // Mock file backups
    for (const file of this.config.files) {
      results.push({
        type: BackupType.FILE,
        name: file.name,
        filename: `${file.name}_mock.tar`,
        size: Math.floor(Math.random() * 5000000),
        success: Math.random() > 0.05, // 95% success rate
        fileCount: Math.floor(Math.random() * 100),
      })
    }

    return {
      totalCount: results.length,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      databaseBackups: results.filter(r => r.type !== BackupType.FILE),
      fileBackups: results.filter(r => r.type === BackupType.FILE),
      duration: 100,
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### Integration Testing

```ts
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { rmdir } from 'node:fs/promises'

describe('BackupManager Integration', () => {
  const testOutputDir = './test-backups'

  beforeEach(async () => {
    // Setup test environment
    await mkdir(testOutputDir, { recursive: true })
  })

  afterEach(async () => {
    // Cleanup test environment
    await rmdir(testOutputDir, { recursive: true })
  })

  it('should create backups programmatically', async () => {
    const config: BackupConfig = {
      verbose: false,
      outputPath: testOutputDir,
      databases: [
        {
          type: BackupType.SQLITE,
          name: 'test-db',
          path: './test/fixtures/test.sqlite',
        }
      ],
      files: [
        {
          name: 'test-files',
          path: './test/fixtures/files',
        }
      ],
    }

    const manager = new BackupManager(config)
    const summary = await manager.createBackup()

    expect(summary.totalCount).toBe(2)
    expect(summary.successCount).toBe(2)
    expect(summary.failureCount).toBe(0)

    // Verify backup files exist
    const files = await readdir(testOutputDir)
    expect(files.length).toBeGreaterThan(0)
  })
})
```

## Next Steps

- Explore [Integration Patterns](/advanced/integration) for complex workflows
- Learn about [Performance Tuning](/advanced/performance) for large-scale operations
- Review [Error Handling](/advanced/error-handling) strategies
- Check out [Custom Extensions](/advanced/custom-extensions) for specialized needs
