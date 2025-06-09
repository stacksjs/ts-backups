# Examples

Real-world examples and common usage patterns for backupx.

## Web Application Backup

Complete backup setup for a typical web application:

```ts
// backups.config.ts
import type { BackupConfig } from 'backupx'
import { BackupType } from 'backupx'

const config: BackupConfig = {
  verbose: process.env.NODE_ENV === 'development',
  outputPath: process.env.BACKUP_PATH || './backups',

  databases: [
    // Main application database
    {
      type: BackupType.POSTGRESQL,
      name: 'app-database',
      connection: process.env.DATABASE_URL!,
      includeSchema: true,
      includeData: true,
      excludeTables: [
        'sessions', // Temporary session data
        'password_resets', // Security tokens
        'failed_jobs', // Queue failures
        'cache', // Application cache
      ],
      compress: true,
    },

    // Analytics database (separate instance)
    {
      type: BackupType.MYSQL,
      name: 'analytics',
      connection: {
        hostname: process.env.ANALYTICS_DB_HOST!,
        database: 'analytics',
        username: process.env.ANALYTICS_DB_USER!,
        password: process.env.ANALYTICS_DB_PASSWORD!,
        ssl: true,
      },
      includeSchema: false, // Schema rarely changes
      includeData: true,
      tables: ['events', 'user_analytics', 'reports'],
      compress: true,
    },
  ],

  files: [
    // User uploads
    {
      name: 'user-uploads',
      path: './storage/uploads',
      compress: true,
      exclude: [
        '*.tmp',
        'cache/**',
        'thumbnails/**', // Can be regenerated
      ],
      maxFileSize: 100 * 1024 * 1024, // 100MB limit
      preserveMetadata: true,
    },

    // Application configuration
    {
      name: 'app-config',
      path: './config',
      compress: true,
      preserveMetadata: true,
    },

    // Important individual files
    {
      name: 'env-example',
      path: './.env.example',
      preserveMetadata: true,
    },
  ],

  retention: {
    count: 14, // Keep 2 weeks of backups
    maxAge: 90, // Delete backups older than 3 months
  }
}

export default config
```

## Development Workflow

Simplified backup for development environment:

```ts
// dev-backup.config.ts
import type { BackupConfig } from 'backupx'
import { BackupType } from 'backupx'

const config: BackupConfig = {
  verbose: true,
  outputPath: './dev-backups',

  databases: [
    {
      type: BackupType.SQLITE,
      name: 'dev-db',
      path: './dev.sqlite',
      compress: false, // Faster for frequent backups
    }
  ],

  files: [
    // Source code only (for quick restoration)
    {
      name: 'source',
      path: './src',
      exclude: [
        'node_modules/**',
        '*.log',
        'dist/**',
        '.git/**',
      ],
      compress: true,
    },

    // Configuration files
    {
      name: 'config-files',
      path: './',
      include: [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        '.env.example',
      ],
      preserveMetadata: true,
    },
  ],

  retention: {
    count: 3, // Keep only recent backups
  }
}

export default config
```

## Production Automation

Production-ready backup with monitoring:

```ts
import type { BackupConfig, BackupSummary } from 'backupx'
// production-backup.ts
import { BackupManager, BackupType } from 'backupx'

class ProductionBackupService {
  private config: BackupConfig = {
    verbose: false,
    outputPath: '/var/backups/myapp',

    databases: [
      {
        type: BackupType.POSTGRESQL,
        name: 'production-db',
        connection: process.env.DATABASE_URL!,
        includeSchema: true,
        includeData: true,
        excludeTables: ['audit_logs'], // Very large table
        compress: true,
      }
    ],

    files: [
      // Critical application files
      {
        name: 'app-data',
        path: '/app/data',
        compress: true,
        exclude: ['temp/**', 'cache/**'],
        maxFileSize: 500 * 1024 * 1024, // 500MB limit
      },

      // Configuration backup
      {
        name: 'system-config',
        path: '/app/config',
        preserveMetadata: true,
        compress: true,
      },
    ],

    retention: {
      count: 30, // Keep 30 daily backups
      maxAge: 365, // Keep for 1 year
    }
  }

  async runBackup(): Promise<void> {
    const startTime = Date.now()

    try {
      console.log('🚀 Starting production backup...')

      const manager = new BackupManager(this.config)
      const summary = await manager.createBackup()

      const duration = Date.now() - startTime

      if (summary.successCount === summary.totalCount) {
        await this.reportSuccess(summary, duration)
      }
      else {
        await this.reportPartialFailure(summary, duration)
      }
    }
    catch (error) {
      const duration = Date.now() - startTime
      await this.reportFailure(error, duration)
      throw error
    }
  }

  private async reportSuccess(summary: BackupSummary, duration: number) {
    const message = `✅ Backup completed successfully in ${Math.round(duration / 1000)}s\n`
      + `📊 ${summary.successCount}/${summary.totalCount} items backed up`

    console.log(message)

    // Send to monitoring service
    await this.sendMetrics({
      success: true,
      duration,
      totalCount: summary.totalCount,
      successCount: summary.successCount,
    })

    // Optional: Send success notification to Slack/email
    await this.sendNotification('backup-success', message)
  }

  private async reportPartialFailure(summary: BackupSummary, duration: number) {
    const message = `⚠️ Backup completed with failures in ${Math.round(duration / 1000)}s\n`
      + `📊 ${summary.successCount}/${summary.totalCount} items backed up\n`
      + `❌ ${summary.failureCount} failures`

    console.warn(message)

    await this.sendMetrics({
      success: false,
      duration,
      totalCount: summary.totalCount,
      successCount: summary.successCount,
      failureCount: summary.failureCount,
    })

    await this.sendAlert('backup-partial-failure', message)
  }

  private async reportFailure(error: Error, duration: number) {
    const message = `❌ Backup failed after ${Math.round(duration / 1000)}s\n`
      + `Error: ${error.message}`

    console.error(message)

    await this.sendMetrics({
      success: false,
      duration,
      error: error.message,
    })

    await this.sendAlert('backup-critical-failure', message)
  }

  private async sendMetrics(data: any) {
    // Send to DataDog, Prometheus, etc.
    console.log('📊 Metrics:', data)
  }

  private async sendNotification(type: string, message: string) {
    // Send success notifications
    console.log(`🔔 Notification [${type}]:`, message)
  }

  private async sendAlert(type: string, message: string) {
    // Send failure alerts to PagerDuty, Slack, etc.
    console.log(`🚨 Alert [${type}]:`, message)
  }
}

// Usage in production
const backupService = new ProductionBackupService()

// Run via cron or systemd timer
if (require.main === module) {
  backupService.runBackup().catch((error) => {
    console.error('Critical backup failure:', error)
    process.exit(1)
  })
}

export { ProductionBackupService }
```

## Multi-Environment Setup

Different configurations for each environment:

```ts
// multi-env-backup.ts
import type { BackupConfig } from 'backupx'
import { BackupType } from 'backupx'

const environments = {
  development: {
    outputPath: './dev-backups',
    retention: { count: 3 },
    compression: false, // Faster
  },

  staging: {
    outputPath: './staging-backups',
    retention: { count: 14, maxAge: 30 },
    compression: true,
  },

  production: {
    outputPath: '/var/backups/prod',
    retention: { count: 30, maxAge: 365 },
    compression: true,
  },
}

function createEnvironmentConfig(): BackupConfig {
  const env = process.env.NODE_ENV || 'development'
  const envConfig = environments[env as keyof typeof environments]

  if (!envConfig) {
    throw new Error(`Unknown environment: ${env}`)
  }

  return {
    verbose: env === 'development',
    outputPath: envConfig.outputPath,

    databases: [
      {
        type: env === 'production' ? BackupType.POSTGRESQL : BackupType.SQLITE,
        name: 'app-db',
        path: env === 'production' ? undefined : './database.sqlite',
        connection: env === 'production' ? process.env.DATABASE_URL! : undefined,
        compress: envConfig.compression,
      }
    ].filter(Boolean),

    files: [
      {
        name: 'source-code',
        path: './src',
        exclude: ['node_modules/**', '*.log'],
        compress: envConfig.compression,
      },

      // Only backup uploads in staging/production
      ...(env !== 'development'
        ? [{
            name: 'uploads',
            path: './uploads',
            compress: envConfig.compression,
            maxFileSize: 100 * 1024 * 1024,
          }]
        : []),
    ],

    retention: envConfig.retention,
  }
}

export default createEnvironmentConfig()
```

## Event-Driven Backups

Trigger backups based on application events:

```ts
import type { BackupConfig } from 'backupx'
// event-driven-backup.ts
import { EventEmitter } from 'node:events'
import { BackupManager } from 'backupx'

class EventDrivenBackupService extends EventEmitter {
  private backupManager: BackupManager
  private backupTimeout?: NodeJS.Timeout
  private lastBackupTime = 0
  private readonly BACKUP_COOLDOWN = 5 * 60 * 1000 // 5 minutes

  constructor(config: BackupConfig) {
    super()
    this.backupManager = new BackupManager(config)
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Trigger backups on important events
    this.on('user:registered', () => this.scheduleBackup('user-registration'))
    this.on('data:imported', () => this.scheduleBackup('data-import'))
    this.on('config:changed', () => this.immediateBackup('config-change'))
    this.on('app:shutdown', () => this.immediateBackup('app-shutdown'))

    // Periodic backup
    setInterval(() => {
      this.scheduleBackup('periodic')
    }, 24 * 60 * 60 * 1000) // Daily
  }

  private scheduleBackup(reason: string) {
    // Debounce to avoid too frequent backups
    if (this.backupTimeout) {
      clearTimeout(this.backupTimeout)
    }

    this.backupTimeout = setTimeout(() => {
      this.executeBackup(reason)
    }, 30000) // Wait 30 seconds for more events
  }

  private async immediateBackup(reason: string) {
    if (this.backupTimeout) {
      clearTimeout(this.backupTimeout)
    }

    await this.executeBackup(reason)
  }

  private async executeBackup(reason: string) {
    const now = Date.now()

    // Cooldown check
    if (now - this.lastBackupTime < this.BACKUP_COOLDOWN) {
      console.log(`⏳ Backup skipped (cooldown): ${reason}`)
      return
    }

    try {
      console.log(`🚀 Starting backup (reason: ${reason})`)

      const summary = await this.backupManager.createBackup()
      this.lastBackupTime = now

      console.log(`✅ Backup completed: ${summary.successCount}/${summary.totalCount}`)
      this.emit('backup:success', { reason, summary })
    }
    catch (error) {
      console.error(`❌ Backup failed (reason: ${reason}):`, error)
      this.emit('backup:error', { reason, error })
    }
  }
}

// Usage in your application
const backupService = new EventDrivenBackupService(config)

// Listen for backup events
backupService.on('backup:success', ({ reason, summary }) => {
  console.log(`📊 Backup triggered by ${reason} completed successfully`)
})

backupService.on('backup:error', ({ reason, error }) => {
  console.error(`🚨 Backup triggered by ${reason} failed:`, error)
  // Send alert to monitoring system
})

// Trigger backups from your application
app.post('/users', async (req, res) => {
  // ... create user logic
  backupService.emit('user:registered')
  res.json({ success: true })
})

app.post('/admin/import', async (req, res) => {
  // ... data import logic
  backupService.emit('data:imported')
  res.json({ imported: true })
})

// Graceful shutdown backup
process.on('SIGTERM', () => {
  backupService.emit('app:shutdown')
  // Give backup time to complete before exiting
  setTimeout(() => process.exit(0), 30000)
})
```

## Docker Integration

Backup service running in Docker:

```dockerfile
# Dockerfile
FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build if needed
RUN bun run build

# Set up backup user
RUN addgroup --system backup && \
    adduser --system --group backup && \
    mkdir -p /var/backups && \
    chown backup:backup /var/backups

USER backup

CMD ["bun", "run", "backup"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/myapp
    volumes:
      - ./data:/app/data
    depends_on:
      - db

  backup:
    build: .
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/myapp
      - NODE_ENV=production
    volumes:
      - ./backups:/var/backups
      - ./data:/app/data:ro
    depends_on:
      - db
    command: |
      sh -c "
        # Wait for database to be ready
        sleep 30
        # Run backup
        bun run backup
      "

  backup-cron:
    build: .
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/myapp
    volumes:
      - ./backups:/var/backups
      - ./data:/app/data:ro
    depends_on:
      - db
    command: |
      sh -c "
        # Install cron
        apt-get update && apt-get install -y cron
        # Add cron job
        echo '0 2 * * * cd /app && bun run backup' | crontab -
        # Start cron
        cron -f
      "

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=myapp
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
```

## Next Steps

- Check out more [Configuration Examples](/config) for specific scenarios
- Learn about [Advanced Integration Patterns](/advanced/integration)
- Explore [Performance Optimization](/advanced/performance) for large-scale backups
- Review [Error Handling Strategies](/advanced/error-handling) for production use
