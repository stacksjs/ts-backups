# Retention Policies

ts-backups provides intelligent retention policies to automatically clean up old backups, preventing storage bloat while ensuring you keep enough backups for recovery needs.

## Overview

Retention policies automatically:
- ✅ **Delete old backups** based on count or age
- ✅ **Preserve recent backups** for quick recovery
- ✅ **Handle mixed backup types** (databases and files)
- ✅ **Run during backup process** for seamless maintenance
- ✅ **Provide detailed logging** of cleanup operations

## Basic Configuration

### Count-Based Retention

Keep only the most recent backups:

```ts
const config = {
  retention: {
    count: 7, // Keep only the 7 most recent backups
  }
}
```

### Age-Based Retention

Delete backups older than a specified age:

```ts
const config = {
  retention: {
    maxAge: 30, // Delete backups older than 30 days
  }
}
```

### Combined Retention

Use both count and age limits together:

```ts
const config = {
  retention: {
    count: 10, // Keep at least 10 backups
    maxAge: 90, // But delete anything older than 90 days
  }
}
```

## How Retention Works

### Cleanup Process

Retention cleanup happens automatically after each backup:

1. **Scan backup directory** for existing backup files
2. **Identify backup files** by extension (`.sql`, `.tar`, `.tar.gz`, etc.)
3. **Sort by modification time** (newest first)
4. **Apply retention rules** (count and/or age)
5. **Delete old backups** that exceed limits
6. **Log cleanup results** if verbose mode is enabled

### File Identification

ts-backups recognizes backup files by:
- **Extensions**: `.sql`, `.tar`, `.tar.gz`, `.gz`
- **Patterns**: Files containing backup-related patterns
- **Timestamps**: Files with timestamp patterns in names
- **Age**: Based on file modification time

## Retention Strategies

### Development Environment

Keep few backups for rapid iteration:

```ts
const devRetention: BackupConfig = {
  verbose: true,
  outputPath: './dev-backups',

  databases: [
    {
      type: BackupType.SQLITE,
      name: 'dev-db',
      path: './dev.sqlite',
    }
  ],

  files: [
    {
      name: 'src',
      path: './src',
      exclude: ['node_modules/**'],
    }
  ],

  retention: {
    count: 3, // Keep only 3 most recent backups
  }
}
```

### Staging Environment

Balanced approach for testing:

```ts
const stagingRetention: BackupConfig = {
  verbose: true,
  outputPath: './staging-backups',

  databases: [
    // ...
  ],
  files: [
    // ...
  ],

  retention: {
    count: 14, // Keep 2 weeks of backups
    maxAge: 30, // Delete anything older than 30 days
  }
}
```

### Production Environment

Conservative approach for production:

```ts
const productionRetention: BackupConfig = {
  verbose: false,
  outputPath: '/var/backups/app',

  databases: [
    // ...
  ],
  files: [
    // ...
  ],

  retention: {
    count: 30, // Keep 30 recent backups (1 month daily)
    maxAge: 365, // Keep backups for 1 year
  }
}
```

## Advanced Retention Scenarios

### Tiered Retention Strategy

Implement different retention for different backup types:

```ts
// Separate configurations for different needs
const configs = {
  // Frequent backups with short retention
  frequent: {
    outputPath: './frequent-backups',
    databases: [
      {
        type: BackupType.SQLITE,
        name: 'cache-db',
        path: './cache.sqlite',
      }
    ],
    retention: {
      count: 5, // Keep only 5 recent
      maxAge: 7, // Delete after 1 week
    }
  },

  // Important backups with long retention
  important: {
    outputPath: './important-backups',
    databases: [
      {
        type: BackupType.POSTGRESQL,
        name: 'main-db',
        connection: process.env.DATABASE_URL!,
      }
    ],
    retention: {
      count: 90, // Keep 90 backups
      maxAge: 730, // Keep for 2 years
    }
  },
}

// Run different backup schedules
async function runTieredBackups() {
  // Frequent backups (hourly)
  if (new Date().getMinutes() === 0) {
    await new BackupManager(configs.frequent).createBackup()
  }

  // Important backups (daily)
  if (new Date().getHours() === 2) {
    await new BackupManager(configs.important).createBackup()
  }
}
```

### Environment-Specific Retention

Adjust retention based on environment:

```ts
const retentionPolicies = {
  development: {
    count: 3, // Minimal retention for dev
    maxAge: 7,
  },
  staging: {
    count: 14, // Medium retention for staging
    maxAge: 30,
  },
  production: {
    count: 60, // Long retention for production
    maxAge: 365,
  },
}

const env = process.env.NODE_ENV || 'development'
const retention = retentionPolicies[env as keyof typeof retentionPolicies]

const config: BackupConfig = {
  // ... other configuration
  retention,
}
```

### Size-Based Considerations

Consider backup sizes when setting retention:

```ts
// For large backups, keep fewer copies
const largeDatabaseConfig = {
  databases: [
    {
      type: BackupType.POSTGRESQL,
      name: 'analytics-db', // Large database
      connection: process.env.ANALYTICS_DB_URL!,
      compress: true, // Essential for large DBs
    }
  ],
  retention: {
    count: 7, // Fewer copies due to size
    maxAge: 30,
  }
}

// For small backups, keep more copies
const smallConfigFiles = {
  files: [
    {
      name: 'config-files',
      path: './config',
      compress: false, // Small files don't need compression
    }
  ],
  retention: {
    count: 30, // More copies since they're small
    maxAge: 90,
  }
}
```

## Monitoring Retention

### Cleanup Logging

With verbose mode enabled, see detailed cleanup information:

```
🧹 Cleaning up old backups...
   Found 12 backup files
   Keeping 7 most recent files
   Deleting 5 old backup files:
   - old_backup_2023-11-15T10-30-00.sql (18 days old)
   - old_backup_2023-11-14T10-30-00.sql (19 days old)
   - old_backup_2023-11-13T10-30-00.sql (20 days old)
   - old_backup_2023-11-12T10-30-00.sql (21 days old)
   - old_backup_2023-11-11T10-30-00.sql (22 days old)
✅ Cleanup completed: 5 files deleted
```

### Retention Metrics

Track retention effectiveness:

```ts
async function trackRetentionMetrics(summary: BackupSummary) {
  const backupDir = './backups'
  const files = await readdir(backupDir)

  const backupFiles = files.filter(file =>
    file.endsWith('.sql')
    || file.endsWith('.tar')
    || file.endsWith('.tar.gz')
    || file.endsWith('.gz')
  )

  const metrics = {
    timestamp: new Date().toISOString(),
    totalBackups: backupFiles.length,
    newBackups: summary.successCount,
    retentionActive: !!config.retention,
    retentionCount: config.retention?.count,
    retentionMaxAge: config.retention?.maxAge,
  }

  // Log metrics for monitoring
  console.log(`📊 Backup metrics:`, metrics)

  // Store for analysis
  fs.appendFileSync('./retention-metrics.jsonl', `${JSON.stringify(metrics)}\n`)
}
```

### Storage Usage Tracking

Monitor how retention affects storage usage:

```ts
async function trackStorageUsage(outputPath: string) {
  const files = await readdir(outputPath)
  let totalSize = 0
  let oldestFile = null
  let newestFile = null

  for (const file of files) {
    const filePath = join(outputPath, file)
    const stats = await stat(filePath)

    totalSize += stats.size

    if (!oldestFile || stats.mtime < oldestFile.mtime) {
      oldestFile = { name: file, mtime: stats.mtime }
    }

    if (!newestFile || stats.mtime > newestFile.mtime) {
      newestFile = { name: file, mtime: stats.mtime }
    }
  }

  console.log(`💾 Storage usage:`)
  console.log(`   Total size: ${formatBytes(totalSize)}`)
  console.log(`   Files: ${files.length}`)
  console.log(`   Oldest: ${oldestFile?.name} (${formatDate(oldestFile?.mtime)})`)
  console.log(`   Newest: ${newestFile?.name} (${formatDate(newestFile?.mtime)})`)
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0)
    return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / 1024 ** i * 100) / 100} ${sizes[i]}`
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}
```

## Error Handling

### Cleanup Failures

Handle retention cleanup errors gracefully:

```ts
// Retention cleanup is non-blocking
const manager = new BackupManager(config)

try {
  const summary = await manager.createBackup()

  // Backup succeeded even if cleanup failed
  if (summary.successCount > 0) {
    console.log('✅ Backups created successfully')
  }

  // Check for cleanup warnings (if any)
  // (ts-backups logs cleanup errors but doesn't fail the backup)
}
catch (error) {
  console.error('❌ Backup process failed:', error)
}
```

### Manual Cleanup

Implement manual cleanup for maintenance:

```ts
import { readdir, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'

async function manualCleanup(outputPath: string, options: RetentionConfig) {
  const files = await readdir(outputPath)

  // Filter backup files
  const backupFiles = files.filter((file) => {
    return file.endsWith('.sql')
      || file.endsWith('.tar')
      || file.endsWith('.tar.gz')
      || file.endsWith('.gz')
  })

  // Get file stats
  const fileStats = await Promise.all(
    backupFiles.map(async (file) => {
      const filePath = join(outputPath, file)
      const stats = await stat(filePath)
      return { name: file, path: filePath, mtime: stats.mtime }
    })
  )

  // Sort by modification time (newest first)
  fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

  const filesToDelete = []

  // Apply count-based retention
  if (options.count && fileStats.length > options.count) {
    filesToDelete.push(...fileStats.slice(options.count))
  }

  // Apply age-based retention
  if (options.maxAge) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - options.maxAge)

    const oldFiles = fileStats.filter(file => file.mtime < cutoffDate)
    filesToDelete.push(...oldFiles)
  }

  // Remove duplicates
  const uniqueFilesToDelete = Array.from(
    new Map(filesToDelete.map(f => [f.path, f])).values()
  )

  // Delete files
  for (const file of uniqueFilesToDelete) {
    try {
      await unlink(file.path)
      console.log(`🗑️ Deleted: ${file.name}`)
    }
    catch (error) {
      console.error(`❌ Failed to delete ${file.name}:`, error)
    }
  }

  console.log(`✅ Manual cleanup completed: ${uniqueFilesToDelete.length} files deleted`)
}

// Usage
await manualCleanup('./backups', { count: 10, maxAge: 30 })
```

## Best Practices

### 1. Start Conservative

Begin with longer retention and adjust based on needs:

```ts
// Start with conservative settings
const initialRetention = {
  count: 30, // Keep plenty of backups initially
  maxAge: 90, // Long retention period
}

// Monitor and adjust over time
const optimizedRetention = {
  count: 14, // Reduce after understanding patterns
  maxAge: 45, // Adjust based on recovery needs
}
```

### 2. Environment Alignment

Match retention to environment importance:

```ts
const environmentRetention = {
  // Development: Aggressive cleanup
  dev: { count: 3, maxAge: 7 },

  // Staging: Moderate retention
  staging: { count: 14, maxAge: 30 },

  // Production: Conservative retention
  prod: { count: 60, maxAge: 365 },
}
```

### 3. Consider Recovery Patterns

Align retention with how you actually recover:

```ts
// If you typically need backups from the last week
const weeklyPattern = {
  count: 7, // One week of daily backups
  maxAge: 14, // Keep extras for 2 weeks
}

// If you need longer history for auditing
const auditPattern = {
  count: 30, // Monthly backups
  maxAge: 365, // Keep for compliance
}
```

### 4. Monitor Storage Costs

Balance retention against storage costs:

```ts
async function calculateStorageCosts(outputPath: string) {
  const files = await readdir(outputPath)
  let totalSize = 0

  for (const file of files) {
    const stats = await stat(join(outputPath, file))
    totalSize += stats.size
  }

  // Estimate costs (example: $0.023 per GB per month for S3)
  const costPerGBPerMonth = 0.023
  const monthlyCost = (totalSize / (1024 ** 3)) * costPerGBPerMonth

  console.log(`💰 Estimated monthly storage cost: $${monthlyCost.toFixed(2)}`)
  console.log(`💡 Consider adjusting retention if costs are high`)
}
```

## Troubleshooting

### Retention Not Working

**Check configuration:**

```ts
// ❌ Problem: No retention configured
const config = {
  // retention property missing
}

// ✅ Solution: Add retention configuration
const config = {
  retention: {
    count: 7,
    maxAge: 30,
  }
}
```

**Verify file patterns:**

```bash
# Check what files exist in backup directory
ls -la ./backups/

# Check file modification times
ls -lt ./backups/
```

### Files Not Being Deleted

**Check file permissions:**

```bash
# Ensure write permissions on backup directory
chmod 755 ./backups/

# Check individual file permissions
ls -la ./backups/
```

**Manual verification:**

```ts
// Test retention logic manually
const testConfig = {
  retention: { count: 2 }
}

// Create test files and run backup to see if cleanup works
```

## Next Steps

- Learn about [Metadata Preservation](/features/metadata) for backup files
- Explore [CLI Interface](/features/cli) for retention management
- Review [Performance Tuning](/advanced/performance) for large-scale retention
- Check out [Integration Patterns](/advanced/integration) for automated retention

## Retention Configuration

Configure automatic cleanup of old backups:

```ts
const retentionConfig = {
  retention: {
    count: 10, // Keep last 10 backups
    maxAge: 30, // Delete backups older than 30 days
  },
}
```

### Count-Based Retention

```ts
const countBasedConfig = {
  retention: {
    count: 5, // Keep only the 5 most recent backups
  },
}
```

### Age-Based Retention

```ts
const ageBasedConfig = {
  retention: {
    maxAge: 7, // Delete backups older than 7 days
  },
}
```

For production systems:

```ts
const productionRetention = {
  retention: {
    count: 30, // Keep last 30 backups
    maxAge: 90, // But delete anything older than 90 days
  },
}
```

For development:

```ts
const devRetention = {
  retention: {
    count: 3, // Keep only last 3 backups
  },
}
```

Manual cleanup:

```ts
const retentionManager = new RetentionManager(
  { count: 5, maxAge: 30 },
  './backups'
)

const result = await retentionManager.cleanup()
console.log(`Deleted ${result.deletedCount} old backups`)
```
