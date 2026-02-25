# CI/CD Integration

Integrate backupx into your continuous integration and deployment pipelines for automated database backups, testing data snapshots, and disaster recovery workflows.

## GitHub Actions

### Scheduled Database Backup

Run automated backups on a schedule:

```yaml
name: Database Backup

on:
  schedule:
# Run daily at 2:00 AM UTC

    - cron: '0 2 * * *'

  workflow*dispatch:
    inputs:
      backup*type:
        description: 'Backup type'
        required: true
        default: 'full'
        type: choice
        options:

          - full
          - schema-only
          - data-only

jobs:
  backup:
    runs-on: ubuntu-latest

    steps:

      - uses: actions/checkout@v4

      - name: Setup Bun

        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies

        run: bun install

      - name: Run database backup

        env:
          DATABASE*URL: ${{ secrets.DATABASE*URL }}
          BACKUP*ENCRYPTION*KEY: ${{ secrets.BACKUP*ENCRYPTION*KEY }}
        run: |
          bun run backupx start --verbose

      - name: Upload backup artifacts

        uses: actions/upload-artifact@v4
        with:
          name: database-backup-${{ github.run*number }}
          path: backups/
          retention-days: 30

      - name: Upload to S3

        if: success()
        env:
          AWS*ACCESS*KEY*ID: ${{ secrets.AWS*ACCESS*KEY*ID }}
          AWS*SECRET*ACCESS*KEY: ${{ secrets.AWS*SECRET*ACCESS*KEY }}
          AWS*REGION: us-east-1
        run: |
          aws s3 sync backups/ s3://${{ secrets.S3*BUCKET }}/backups/$(date +%Y-%m-%d)/
```

### Pre-Deployment Backup

Create backups before deploying changes:

```yaml
name: Deploy with Backup

on:
  push:
    branches: [main]

jobs:
  backup-and-deploy:
    runs-on: ubuntu-latest

    steps:

      - uses: actions/checkout@v4

      - name: Setup Bun

        uses: oven-sh/setup-bun@v1

      - name: Install dependencies

        run: bun install

      - name: Create pre-deployment backup

        env:
          DATABASE*URL: ${{ secrets.DATABASE*URL }}
        run: |
          bun run backupx start --verbose
          echo "BACKUP*FILE=$(ls -t backups/*.sql* | head -1)" >> $GITHUB*ENV

      - name: Upload backup

        uses: actions/upload-artifact@v4
        with:
          name: pre-deploy-backup-${{ github.sha }}
          path: backups/

      - name: Run migrations

        env:
          DATABASE*URL: ${{ secrets.DATABASE*URL }}
        run: bun run db:migrate

      - name: Deploy application

        run: |
# Your deployment commands
          echo "Deploying..."

      - name: Verify deployment

        id: verify
        continue-on-error: true
        run: |
# Health check
          curl -f https://your-app.com/health || exit 1

      - name: Rollback on failure

        if: steps.verify.outcome == 'failure'
        env:
          DATABASE*URL: ${{ secrets.DATABASE*URL }}
        run: |
          echo "Deployment verification failed, initiating rollback..."
# Restore from backup
# psql $DATABASE*URL < ${{ env.BACKUP*FILE }}
```

### Test Data Snapshot

Create and restore test data snapshots:

```yaml
name: Test with Database Snapshot

on:
  pull*request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES*USER: test
          POSTGRES*PASSWORD: test
          POSTGRES*DB: test*db
        ports:

          - 5432:5432

        options: >-
          --health-cmd pg*isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:

      - uses: actions/checkout@v4

      - name: Setup Bun

        uses: oven-sh/setup-bun@v1

      - name: Install dependencies

        run: bun install

      - name: Restore test data snapshot

        env:
          DATABASE*URL: postgres://test:test@localhost:5432/test*db
        run: |
# Download snapshot from cache or artifact
          if [ -f test-fixtures/snapshot.sql ]; then
            psql $DATABASE*URL < test-fixtures/snapshot.sql
          else
            bun run db:seed
          fi

      - name: Run tests

        env:
          DATABASE*URL: postgres://test:test@localhost:5432/test*db
        run: bun test

      - name: Create snapshot after test

        if: always()
        env:
          DATABASE*URL: postgres://test:test@localhost:5432/test*db
        run: |
          bun run backupx start --output test-fixtures
```

## GitLab CI

### Scheduled Backup Pipeline

```yaml
# .gitlab-ci.yml
stages:

  - backup
  - upload
  - cleanup

variables:
  BACKUP*DIR: ./backups

daily-backup:
  stage: backup
  image: oven/bun:latest
  rules:

    - if: $CI*PIPELINE*SOURCE == "schedule"

  script:

    - bun install
    - bun run backupx start --verbose

  artifacts:
    paths:

      - $BACKUP*DIR/

    expire*in: 30 days

upload-to-cloud:
  stage: upload
  image: amazon/aws-cli:latest
  needs: ['daily-backup']
  rules:

    - if: $CI*PIPELINE*SOURCE == "schedule"

  script:

    - aws s3 sync $BACKUP*DIR/ s3://$S3*BUCKET/backups/$(date +%Y-%m-%d)/

cleanup-old-backups:
  stage: cleanup
  image: amazon/aws-cli:latest
  rules:

    - if: $CI*PIPELINE*SOURCE == "schedule"

  script:
# Delete backups older than 30 days

    - |

      aws s3 ls s3://$S3*BUCKET/backups/ | while read -r line; do
        createDate=$(echo $line | awk '{print $1" "$2}')
        createDate=$(date -d "$createDate" +%s)
        olderThan=$(date -d "30 days ago" +%s)
        if [[ $createDate -lt $olderThan ]]; then
          folder=$(echo $line | awk '{print $4}')
          aws s3 rm s3://$S3*BUCKET/backups/$folder --recursive
        fi
      done
```

## Docker Integration

### Dockerfile for Backup Service

```dockerfile
FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy application files
COPY . .

# Create backup directory
RUN mkdir -p /backups

# Set environment
ENV NODE*ENV=production
ENV BACKUP*OUTPUT*PATH=/backups

# Default command
CMD ["bun", "run", "backupx", "start", "--verbose"]
```

### Docker Compose for Scheduled Backups

```yaml
# docker-compose.yml
version: '3.8'

services:
  backup:
    build: .
    environment:

      - DATABASE*URL=${DATABASE*URL}
      - BACKUP*OUTPUT*PATH=/backups
      - AWS*ACCESS*KEY*ID=${AWS*ACCESS*KEY*ID}
      - AWS*SECRET*ACCESS*KEY=${AWS*SECRET*ACCESS*KEY}
      - S3*BUCKET=${S3*BUCKET}

    volumes:

      - backup-data:/backups

    restart: unless-stopped

# Cron scheduler for backups
  scheduler:
    image: mcuadros/ofelia:latest
    depends*on:

      - backup

    command: daemon --docker
    volumes:

      - /var/run/docker.sock:/var/run/docker.sock:ro

    labels:
      ofelia.job-run.backup.schedule: "0 2 * * *"
      ofelia.job-run.backup.container: "backup"
      ofelia.job-run.backup.command: "bun run backupx start"

volumes:
  backup-data:
```

### Kubernetes CronJob

```yaml
# backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:

            - name: backup

              image: your-registry/backupx:latest
              env:

                - name: DATABASE*URL

                  valueFrom:
                    secretKeyRef:
                      name: database-secrets
                      key: url

                - name: AWS*ACCESS*KEY*ID

                  valueFrom:
                    secretKeyRef:
                      name: aws-secrets
                      key: access-key-id

                - name: AWS*SECRET*ACCESS*KEY

                  valueFrom:
                    secretKeyRef:
                      name: aws-secrets
                      key: secret-access-key
              command:

                - bun
                - run
                - backupx
                - start
                - --verbose

              volumeMounts:

                - name: backup-storage

                  mountPath: /backups
          volumes:

            - name: backup-storage

              persistentVolumeClaim:
                claimName: backup-pvc
          restartPolicy: OnFailure
```

## Backup Scripts

### Comprehensive Backup Script

```ts
// scripts/backup.ts
import { createBackup } from 'backupx'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

interface BackupResult {
  success: boolean
  localPath?: string
  remotePath?: string
  error?: string
}

async function runBackup(): Promise<BackupResult> {
  const startTime = Date.now()

  console.log('Starting backup process...')

  try {
    // Create local backup
    const summary = await createBackup({
      verbose: true,
      outputPath: './backups',
      databases: [
        {
          type: 'postgresql',
          name: 'production',
          connection: process.env.DATABASE*URL!,
          compress: true,
        },
      ],
      retention: {
        count: 7,
      },
    })

    if (summary.failureCount > 0) {
      throw new Error(`${summary.failureCount} backup(s) failed`)
    }

    // Find the latest backup file
    const files = await readdir('./backups')
    const latestBackup = files
      .filter(f => f.endsWith('.sql.gz'))
      .sort()
      .reverse()[0]

    if (!latestBackup) {
      throw new Error('No backup file created')
    }

    // Upload to S3
    const s3Client = new S3Client({ region: process.env.AWS*REGION })
    const fileContent = await readFile(join('./backups', latestBackup))
    const remotePath = `backups/${new Date().toISOString().split['T'](0)}/${latestBackup}`

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3*BUCKET!,
      Key: remotePath,
      Body: fileContent,
      ServerSideEncryption: 'AES256',
    }))

    const duration = Date.now() - startTime
    console.log(`Backup completed in ${duration}ms`)
    console.log(`Local: ./backups/${latestBackup}`)
    console.log(`Remote: s3://${process.env.S3*BUCKET}/${remotePath}`)

    return {
      success: true,
      localPath: `./backups/${latestBackup}`,
      remotePath: `s3://${process.env.S3*BUCKET}/${remotePath}`,
    }
  }
  catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Backup failed:', errorMessage)

    // Send alert
    await sendAlert({
      type: 'backup*failed',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    })

    return {
      success: false,
      error: errorMessage,
    }
  }
}

async function sendAlert(alert: any): Promise<void> {
  // Send to Slack, PagerDuty, etc.
  if (process.env.SLACK*WEBHOOK) {
    await fetch(process.env.SLACK*WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:warning: Backup Alert: ${alert.message}`,
      }),
    })
  }
}

// Run backup
runBackup().then((result) => {
  process.exit(result.success ? 0 : 1)
})
```

## Monitoring and Alerting

### Health Check Endpoint

```ts
// api/backup-health.ts
import { stat, readdir } from 'node:fs/promises'
import { join } from 'node:path'

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical'
  lastBackup: Date | null
  lastBackupAgeHours: number
  backupCount: number
  message: string
}

export async function checkBackupHealth(backupDir: string): Promise<HealthStatus> {
  try {
    const files = await readdir(backupDir)
    const backupFiles = files.filter(f => f.endsWith('.sql') || f.endsWith('.sql.gz'))

    if (backupFiles.length === 0) {
      return {
        status: 'critical',
        lastBackup: null,
        lastBackupAgeHours: Infinity,
        backupCount: 0,
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
    const ageHours = (Date.now() - latestTime) / (1000 * 60 * 60)

    let status: 'healthy' | 'warning' | 'critical'
    let message: string

    if (ageHours < 25) {
      status = 'healthy'
      message = `Last backup ${ageHours.toFixed(1)} hours ago`
    }
    else if (ageHours < 48) {
      status = 'warning'
      message = `Backup overdue: ${ageHours.toFixed(1)} hours since last backup`
    }
    else {
      status = 'critical'
      message = `Critical: No backup for ${ageHours.toFixed(1)} hours`
    }

    return {
      status,
      lastBackup,
      lastBackupAgeHours: ageHours,
      backupCount: backupFiles.length,
      message,
    }
  }
  catch (error) {
    return {
      status: 'critical',
      lastBackup: null,
      lastBackupAgeHours: Infinity,
      backupCount: 0,
      message: `Error checking backup health: ${error}`,
    }
  }
}
```

## Best Practices

1. **Encrypt Backups**: Always encrypt sensitive database backups
2. **Multiple Destinations**: Store backups in multiple locations
3. **Test Restores**: Regularly verify backups can be restored
4. **Monitor Failures**: Set up alerts for backup failures
5. **Retention Policies**: Implement automatic cleanup of old backups
6. **Pre-Deployment Backups**: Always backup before migrations or deployments
7. **Document Procedures**: Maintain runbooks for backup and restore procedures
8. **Access Control**: Limit access to backup files and credentials
9. **Audit Logging**: Log all backup and restore operations
10. **Performance Impact**: Schedule backups during low-traffic periods
