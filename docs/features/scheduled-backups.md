# Scheduled Backups

Backupx supports scheduling automated backups using cron expressions, system schedulers, or programmatic timers. This ensures your data is backed up regularly without manual intervention.

## Programmatic Scheduling

### Using Node.js Timers

Set up recurring backups with simple interval-based scheduling:

```ts
import { createBackup } from 'backupx'

const config = {
  verbose: true,
  outputPath: './backups',
  databases: [
    {
      type: 'sqlite',
      name: 'app-db',
      path: './data/app.sqlite',
      compress: true,
    },
  ],
}

// Run backup every hour
const HOUR_MS = 60 * 60 * 1000

setInterval(async () => {
  console.log(`[${new Date().toISOString()}] Starting scheduled backup...`)
  try {
    const summary = await createBackup(config)
    console.log(`Backup completed: ${summary.successCount} successful`)
  }
  catch (error) {
    console.error('Scheduled backup failed:', error)
  }
}, HOUR_MS)

// Initial backup on startup
createBackup(config).then((summary) => {
  console.log(`Initial backup completed: ${summary.successCount} successful`)
})
```

### Using Cron Libraries

For more precise scheduling, use a cron library:

```ts
import { CronJob } from 'cron'
import { createBackup } from 'backupx'

const config = {
  verbose: false,
  outputPath: './backups',
  databases: [
    {
      type: 'postgresql',
      name: 'main-db',
      connection: process.env.DATABASE_URL,
      compress: true,
    },
  ],
  retention: {
    count: 7,
    maxAge: 30,
  },
}

// Daily backup at 2:00 AM
const dailyBackup = new CronJob('0 2 * * *', async () => {
  console.log('Running daily backup...')
  try {
    const summary = await createBackup(config)
    console.log(`Daily backup completed: ${summary.successCount} backups`)
  }
  catch (error) {
    console.error('Daily backup failed:', error)
  }
})

// Hourly backup during business hours (9 AM - 6 PM)
const hourlyBackup = new CronJob('0 9-18 * * 1-5', async () => {
  console.log('Running hourly backup...')
  await createBackup({
    ...config,
    outputPath: './backups/hourly',
    retention: { count: 24 }, // Keep last 24 hourly backups
  })
})

// Start the jobs
dailyBackup.start()
hourlyBackup.start()

console.log('Backup scheduler started')
```

## System Scheduler Integration

### Cron (Linux/macOS)

Create a backup script and schedule it with cron:

```bash
#!/bin/bash
# backup.sh

cd /path/to/your/project
bun run backup:scheduled
```

```bash
# Run daily at 2:00 AM
0 2 * * * /path/to/backup.sh >> /var/log/backupx.log 2>&1

# Run every 6 hours
0 */6 * * * /path/to/backup.sh >> /var/log/backupx.log 2>&1

# Run at 1:00 AM on weekdays
0 1 * * 1-5 /path/to/backup.sh >> /var/log/backupx.log 2>&1
```

### systemd Timer (Linux)

Create a systemd service and timer:

```ini
# /etc/systemd/system/backupx.service
[Unit]
Description=Backupx Database Backup
After=network.target

[Service]
Type=oneshot
User=backup
WorkingDirectory=/opt/myapp
ExecStart=/usr/local/bin/bun run backup
StandardOutput=append:/var/log/backupx.log
StandardError=append:/var/log/backupx-error.log

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/backupx.timer
[Unit]
Description=Run backupx daily

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# Enable and start the timer
sudo systemctl daemon-reload
sudo systemctl enable backupx.timer
sudo systemctl start backupx.timer

# Check timer status
sudo systemctl list-timers backupx.timer
```

### Windows Task Scheduler

Create a PowerShell script and schedule it:

```powershell
# backup.ps1
Set-Location "C:\path\to\your\project"
& bun run backup:scheduled
```

```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-File C:\scripts\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 2am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable

Register-ScheduledTask -TaskName "BackupxDaily" -Action $action -Trigger $trigger -Settings $settings
```

## Schedule Configuration

### Configuration File Scheduling

Define schedules in your configuration:

```ts
// backups.config.ts
import type { BackupConfig } from 'backupx'

export const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',

  databases: [
    {
      type: 'postgresql',
      name: 'production-db',
      connection: process.env.DATABASE_URL,
      compress: true,
    },
  ],

  files: [
    {
      name: 'uploads',
      path: './public/uploads',
      compress: true,
    },
  ],

  retention: {
    count: 30,
    maxAge: 90,
  },
}

// Schedule definitions (for use with scheduler)
export const schedules = {
  hourly: {
    cron: '0 * * * *',
    config: {
      ...config,
      outputPath: './backups/hourly',
      retention: { count: 24 },
    },
  },
  daily: {
    cron: '0 2 * * *',
    config: {
      ...config,
      outputPath: './backups/daily',
      retention: { count: 7 },
    },
  },
  weekly: {
    cron: '0 3 * * 0',
    config: {
      ...config,
      outputPath: './backups/weekly',
      retention: { count: 4 },
    },
  },
  monthly: {
    cron: '0 4 1 * *',
    config: {
      ...config,
      outputPath: './backups/monthly',
      retention: { count: 12 },
    },
  },
}
```

### Multi-Tier Backup Strategy

Implement a grandfather-father-son backup rotation:

```ts
import { createBackup } from 'backupx'

const baseConfig = {
  databases: [
    {
      type: 'postgresql',
      name: 'app-db',
      connection: process.env.DATABASE_URL,
      compress: true,
    },
  ],
}

// Daily backups (keep 7)
async function dailyBackup() {
  await createBackup({
    ...baseConfig,
    outputPath: './backups/daily',
    retention: { count: 7 },
  })
}

// Weekly backups (keep 4)
async function weeklyBackup() {
  await createBackup({
    ...baseConfig,
    outputPath: './backups/weekly',
    retention: { count: 4 },
  })
}

// Monthly backups (keep 12)
async function monthlyBackup() {
  await createBackup({
    ...baseConfig,
    outputPath: './backups/monthly',
    retention: { count: 12 },
  })
}

// Yearly backups (keep forever)
async function yearlyBackup() {
  await createBackup({
    ...baseConfig,
    outputPath: './backups/yearly',
    // No retention - keep all yearly backups
  })
}
```

## Monitoring Scheduled Backups

### Logging and Notifications

Track backup execution and send notifications:

```ts
import { createBackup, BackupSummary } from 'backupx'

interface BackupLog {
  timestamp: Date
  success: boolean
  duration: number
  summary: BackupSummary
  error?: string
}

const backupLogs: BackupLog[] = []

async function runScheduledBackup(config: any): Promise<BackupLog> {
  const startTime = Date.now()
  const log: BackupLog = {
    timestamp: new Date(),
    success: false,
    duration: 0,
    summary: null as any,
  }

  try {
    log.summary = await createBackup(config)
    log.success = log.summary.failureCount === 0
  }
  catch (error) {
    log.error = error instanceof Error ? error.message : String(error)
  }

  log.duration = Date.now() - startTime
  backupLogs.push(log)

  // Send notification on failure
  if (!log.success) {
    await sendNotification({
      type: 'error',
      message: `Backup failed: ${log.error || 'Unknown error'}`,
    })
  }

  return log
}

async function sendNotification(notification: { type: string, message: string }) {
  // Implement your notification logic (email, Slack, Discord, etc.)
  console.log(`[${notification.type.toUpperCase()}] ${notification.message}`)
}
```

### Health Checks

Implement health checks for backup status:

```ts
import { stat } from 'node:fs/promises'
import { join } from 'node:path'

interface BackupHealth {
  lastBackup: Date | null
  lastBackupAge: number // hours
  healthy: boolean
  message: string
}

async function checkBackupHealth(backupDir: string): Promise<BackupHealth> {
  const files = await readdir(backupDir)
  const backupFiles = files.filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))

  if (backupFiles.length === 0) {
    return {
      lastBackup: null,
      lastBackupAge: Infinity,
      healthy: false,
      message: 'No backup files found',
    }
  }

  // Get most recent backup
  let latestTime = 0
  for (const file of backupFiles) {
    const fileStat = await stat(join(backupDir, file))
    if (fileStat.mtimeMs > latestTime) {
      latestTime = fileStat.mtimeMs
    }
  }

  const lastBackup = new Date(latestTime)
  const lastBackupAge = (Date.now() - latestTime) / (1000 * 60 * 60) // hours

  // Consider unhealthy if last backup is more than 25 hours old (for daily backups)
  const healthy = lastBackupAge < 25

  return {
    lastBackup,
    lastBackupAge,
    healthy,
    message: healthy
      ? `Last backup: ${lastBackupAge.toFixed(1)} hours ago`
      : `WARNING: Last backup was ${lastBackupAge.toFixed(1)} hours ago`,
  }
}

// Usage in a health endpoint
async function healthEndpoint() {
  const health = await checkBackupHealth('./backups/daily')
  return {
    status: health.healthy ? 'healthy' : 'unhealthy',
    backups: health,
  }
}
```

## Best Practices

1. **Stagger Backup Times**: Don't schedule all backups at the same time to reduce system load
2. **Test Restores**: Regularly test that backups can be restored successfully
3. **Monitor Disk Space**: Ensure sufficient disk space for scheduled backups
4. **Use Retention Policies**: Automatically clean up old backups to manage storage
5. **Log Everything**: Keep detailed logs of backup operations
6. **Set Up Alerts**: Notify on backup failures immediately
7. **Consider Time Zones**: Be aware of time zone differences for distributed systems
8. **Backup Before Deployments**: Trigger backups before major deployments
