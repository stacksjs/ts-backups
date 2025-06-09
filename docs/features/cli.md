# CLI Interface

backupx provides a powerful command-line interface for running backups, managing configurations, and integrating with automation systems.

## Overview

The CLI offers:
- **Simple Commands**: Easy-to-use backup commands
- **Verbose Output**: Detailed progress and error reporting
- **Configuration Auto-discovery**: Automatic config file detection
- **Exit Codes**: Proper exit codes for scripting
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### Global Installation

```bash
# Install globally with your package manager
bun add -g backupx
npm install -g backupx
pnpm add -g backupx
yarn global add backupx
```

### Using Without Installation

```bash
# Run directly with package runners
bunx backupx start --verbose
npx backupx start --verbose
pnpm dlx backupx start --verbose
```

## Basic Commands

### Start Backup

Run backups using your configuration:

```bash
# Basic backup
backups start

# With verbose output
backups start --verbose

# Short form
backups start -v
```

### Help and Version

```bash
# Show help
backups --help
backups -h

# Show version
backups --version
backups -v
```

## Command Reference

### `backups start`

Runs the backup process using your configuration file.

**Syntax:**
```bash
backups start [options]
```

**Options:**
- `--verbose`, `-v`: Enable verbose logging output
- `--help`, `-h`: Show command help

**Examples:**
```bash
# Basic backup with default config
backups start

# Verbose backup showing detailed progress
backups start --verbose

# Using short flag
backups start -v
```

### Exit Codes

The CLI returns appropriate exit codes for automation:

| Exit Code | Meaning |
|-----------|---------|
| `0` | All backups succeeded |
| `1` | One or more backups failed |
| `1` | Configuration error |
| `1` | No databases or files configured |

## Configuration Discovery

The CLI automatically looks for configuration files in this order:

1. `backups.config.ts` (TypeScript)
2. `backups.config.js` (JavaScript)
3. `backups.config.json` (JSON)

### Custom Configuration

You can specify a custom configuration file:

```bash
# Using environment variable
BACKUP_CONFIG=./custom-config.ts backups start

# Or place config in expected location
mv ./my-config.ts ./backups.config.ts
backups start
```

## Output Examples

### Successful Backup

```bash
$ backups start --verbose

🗄️ Starting database backups...

📊 Starting SQLite backup for: app-database
   Database: ./database.sqlite
   Output: ./backups/app-database_2023-12-01T10-30-00.sql
✅ SQLite backup completed in 45ms
   Size: 2.1 MB

📁 Starting file backups...

📄 Starting file backup for: config.json
   Output: ./backups/config_2023-12-01T10-30-00.json
✅ File backup completed in 12ms
   Size: 3.2 KB

📁 Starting directory backup for: ./src
   Output: ./backups/src_2023-12-01T10-30-00.tar.gz
   Found 245 files to backup
✅ Directory backup completed in 180ms
   Size: 892 KB
   Files: 245

🧹 Cleaning up old backups...
   Found 8 backup files
   Keeping 5 most recent files
   Deleting 3 old backup files

📊 Backup Summary:
   Total backups: 3
   Successful: 3
   Failed: 0
   Total duration: 237ms

✅ All backups completed successfully
```

### Failed Backup

```bash
$ backups start --verbose

🗄️ Starting database backups...

📊 Starting SQLite backup for: app-database
   Database: ./database.sqlite
❌ SQLite backup failed: ENOENT: no such file or directory

📁 Starting file backups...

📄 Starting file backup for: config.json
   Output: ./backups/config_2023-12-01T10-30-00.json
✅ File backup completed in 12ms
   Size: 3.2 KB

📊 Backup Summary:
   Total backups: 2
   Successful: 1
   Failed: 1
   Total duration: 52ms

❌ Some backups failed. Check the errors above.

$ echo $?
1
```

## Automation and Scripting

### Exit Code Handling

```bash
#!/bin/bash

# Run backup and capture exit code
if backups start --verbose; then
    echo "Backup successful"
    # Continue with other tasks
else
    echo "Backup failed - exit code: $?"
    # Handle failure (send alert, retry, etc.)
    exit 1
fi
```

### Cron Jobs

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/project && backups start

# Weekly backup with full verbose output logged
0 3 * * 0 cd /path/to/project && backups start --verbose >> backup.log 2>&1

# Backup every 6 hours with error-only logging
0 */6 * * * cd /path/to/project && backups start 2>> backup-errors.log
```

### Systemd Service

Create a systemd service for automated backups:

```ini
# /etc/systemd/system/app-backup.service
[Unit]
Description=Application Backup Service
Requires=network.target
After=network.target

[Service]
Type=oneshot
User=backup
Group=backup
WorkingDirectory=/opt/myapp
ExecStart=/usr/local/bin/backups start --verbose
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/app-backup.timer
[Unit]
Description=Run Application Backup Daily
Requires=app-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# Enable and start the timer
sudo systemctl enable app-backup.timer
sudo systemctl start app-backup.timer

# Check status
sudo systemctl status app-backup.timer
```

## Docker Integration

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    image: my-app:latest
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups

  backup:
    image: oven/bun:1
    volumes:
      - ./data:/app/data
      - ./backups:/app/backups
      - ./backups.config.ts:/app/backups.config.ts
    working_dir: /app
    command: |
      sh -c "
        bun add -g backupx &&
        backups start --verbose
      "
    depends_on:
      - app
```

### Kubernetes CronJob

```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: app-backup
spec:
  schedule: '0 2 * * *' # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: oven/bun:1
              command:
                - /bin/sh
                - -c
                - |
                  bun add -g backupx
                  backups start --verbose
              volumeMounts:
                - name: data
                  mountPath: /app/data
                - name: backup-storage
                  mountPath: /app/backups
                - name: config
                  mountPath: /app/backups.config.ts
                  subPath: backups.config.ts
              workingDir: /app
          volumes:
            - name: data
              persistentVolumeClaim:
                claimName: app-data
            - name: backup-storage
              persistentVolumeClaim:
                claimName: backup-storage
            - name: config
              configMap:
                name: backup-config
          restartPolicy: OnFailure
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/backup.yml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install backupx
        run: bun add -g backupx

      - name: Run backup
        run: backups start --verbose
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Upload backup artifacts
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: backups-${{ github.run_number }}
          path: ./backups/
          retention-days: 30
```

### GitLab CI

```yaml
# .gitlab-ci.yml
backup:
  image: oven/bun:1
  stage: deploy
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule"
    - if: $CI_PIPELINE_SOURCE == "web"
  script:
    - bun add -g backupx
    - backups start --verbose
  artifacts:
    paths:
      - backups/
    expire_in: 30 days
  only:
    variables:
      - $BACKUP_ENABLED == "true"
```

## Environment Variables

### Configuration

```bash
# Custom configuration file location
export BACKUP_CONFIG=./production-backup.config.ts

# Database connection (if using environment-based config)
export DATABASE_URL=postgres://user:pass@localhost/db

# Output directory override
export BACKUP_OUTPUT_PATH=/var/backups

# Enable debug logging
export DEBUG=backupx:*
```

### Production Example

```bash
#!/bin/bash
# production-backup.sh

# Set environment
export NODE_ENV=production
export BACKUP_CONFIG=./production.config.ts
export BACKUP_OUTPUT_PATH=/var/backups/myapp

# Database connections
export PRIMARY_DB_URL="postgres://backup_user:$DB_PASSWORD@db.example.com/production"
export ANALYTICS_DB_URL="mysql://analytics:$ANALYTICS_PASSWORD@analytics.example.com/analytics"

# Run backup with full logging
if backups start --verbose 2>&1 | tee -a backup.log; then
    echo "$(date): Backup completed successfully" >> backup.log

    # Optional: Upload to cloud storage
    aws s3 sync /var/backups/myapp s3://company-backups/myapp/
else
    echo "$(date): Backup failed with exit code $?" >> backup.log

    # Send alert
    curl -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data '{"text":"🚨 Production backup failed!"}'

    exit 1
fi
```

## Troubleshooting

### Common Issues

**Config Not Found:**
```bash
$ backups start
❌ No databases or files configured for backup.
💡 Please configure databases and/or files in your backup configuration file.

# Solutions:
# 1. Create backups.config.ts
# 2. Ensure you're in the correct directory
# 3. Check file permissions
```

**Permission Errors:**
```bash
$ backups start
❌ Backup process failed: EACCES: permission denied

# Solutions:
chmod 755 ./backups           # Fix output directory permissions
sudo chown -R $USER ./backups # Fix ownership
```

**Binary Not Found:**
```bash
$ backups start
bash: backups: command not found

# Solutions:
npm install -g backupx     # Install globally
which backups                 # Check if installed
echo $PATH                    # Check PATH includes npm globals
```

### Debug Mode

Enable detailed debugging:

```bash
# Enable all debug output
DEBUG=backupx:* backups start --verbose

# Enable specific module debugging
DEBUG=backupx:database backups start
DEBUG=backupx:files backups start
```

### Verbose vs Debug

| Mode | Purpose | Output Level |
|------|---------|-------------|
| Normal | Production use | Minimal output |
| Verbose (`--verbose`) | Detailed progress | Progress + results |
| Debug (`DEBUG=*`) | Development | All internal operations |

## Best Practices

### 1. Use Verbose Mode for Manual Runs

```bash
# For manual testing and verification
backups start --verbose

# For automated scripts (less noise)
backups start
```

### 2. Implement Proper Error Handling

```bash
#!/bin/bash
set -e  # Exit on any error

# Capture output and exit code
if output=$(backups start --verbose 2>&1); then
    echo "✅ Backup successful"
    echo "$output" | tail -5  # Show summary
else
    echo "❌ Backup failed"
    echo "$output" | grep -E "(❌|Error)" # Show only errors
    exit 1
fi
```

### 3. Log Rotation

```bash
# Rotate backup logs
logrotate_config="
/var/log/backup.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
"

echo "$logrotate_config" | sudo tee /etc/logrotate.d/backup
```

### 4. Monitoring Integration

```bash
# Send metrics to monitoring system
backup_start_time=$(date +%s)
if backups start --verbose; then
    backup_duration=$(($(date +%s) - backup_start_time))

    # Send success metric
    curl -X POST "http://monitoring.example.com/metrics" \
        -d "backup.success=1&backup.duration=$backup_duration"
else
    # Send failure metric
    curl -X POST "http://monitoring.example.com/metrics" \
        -d "backup.failure=1"
fi
```

## Next Steps

- Learn about [Advanced Configuration](/config) for complex CLI setups
- Explore [Integration Patterns](/advanced/integration) for automation
- Review [Error Handling](/advanced/error-handling) for robust CLI usage
- Check out [Performance Tuning](/advanced/performance) for large-scale CLI operations
