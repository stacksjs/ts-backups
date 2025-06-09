# GitHub Actions CI/CD Integration

This guide shows how to integrate ts-backups into GitHub Actions workflows for automated backup operations.

## Basic Backup Workflow

### Daily Scheduled Backup

```yaml
# .github/workflows/backup.yml
name: Daily Database Backup

on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC
  workflow_dispatch: # Manual trigger

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

      - name: Install dependencies
        run: bun install

      - name: Run backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          BACKUP_OUTPUT_PATH: ./backups
        run: bun run bin/cli.ts

      - name: Upload backup to S3
        uses: aws-actions/configure-aws-credentials@v3
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Sync backups to S3
        run: |
          aws s3 sync ./backups s3://${{ secrets.BACKUP_BUCKET }}/daily/ \
            --delete \
            --exclude "*.tmp"
```

## Multi-Environment Backup

### Environment-Specific Workflows

```yaml
# .github/workflows/backup-production.yml
name: Production Backup

on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch:
    inputs:
      backup_type:
        description: Type of backup to perform
        required: true
        default: full
        type: choice
        options:
          - full
          - incremental
          - schema-only

jobs:
  production-backup:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Create backup configuration
        run: |
          cat > backup-config.json << EOF
          {
            "verbose": true,
            "databases": [
              {
                "type": "POSTGRESQL",
                "name": "production-db",
                "connection": "${{ secrets.PROD_DATABASE_URL }}",
                "includeSchema": true,
                "includeData": ${{ github.event.inputs.backup_type != 'schema-only' }}
              }
            ],
            "outputPath": "./backups",
            "retention": {
              "count": 72,
              "maxAge": 30
            }
          }
          EOF

      - name: Run backup
        env:
          BACKUP_CONFIG_PATH: ./backup-config.json
        run: bun run bin/cli.ts --config ./backup-config.json

      - name: Verify backup integrity
        run: |
          # Check if backup files were created
          if [ ! "$(ls -A ./backups)" ]; then
            echo "No backup files found!"
            exit 1
          fi

          # Verify file sizes
          for file in ./backups/*.sql*; do
            if [ -f "$file" ] && [ ! -s "$file" ]; then
              echo "Empty backup file: $file"
              exit 1
            fi
          done

      - name: Upload to multiple locations
        run: |
          # Upload to primary S3 bucket
          aws s3 sync ./backups s3://${{ secrets.PRIMARY_BACKUP_BUCKET }}/production/ \
            --storage-class STANDARD_IA

          # Upload to secondary bucket for redundancy
          aws s3 sync ./backups s3://${{ secrets.SECONDARY_BACKUP_BUCKET }}/production/ \
            --storage-class GLACIER

      - name: Notify on failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          text: Production backup failed! Check the workflow logs.
```

## Container-Based Backup

### Docker Workflow

```yaml
# .github/workflows/backup-docker.yml
name: Containerized Backup

on:
  schedule:
    - cron: '0 3 * * *'
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build backup container
        run: |
          docker build -t backup-runner -f Dockerfile.backup .

      - name: Run backup in container
        run: |
          docker run \
            --network host \
            -v $(pwd)/backups:/app/backups \
            -e DATABASE_URL="postgres://postgres:testpass@localhost:5432/testdb" \
            -e BACKUP_VERBOSE=true \
            backup-runner

      - name: Archive backup artifacts
        uses: actions/upload-artifact@v3
        with:
          name: database-backups
          path: ./backups/
          retention-days: 30
```

## Restore Testing Workflow

### Automated Backup Verification

```yaml
# .github/workflows/backup-test.yml
name: Backup and Restore Test

on:
  schedule:
    - cron: '0 4 * * 0' # Weekly on Sunday
  workflow_dispatch:

jobs:
  backup-and-test:
    runs-on: ubuntu-latest

    services:
      postgres-source:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: sourcepass
          POSTGRES_DB: sourcedb
        ports:
          - 5432:5432

      postgres-target:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: targetpass
          POSTGRES_DB: targetdb
        ports:
          - 5433:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Setup test data
        run: |
          # Create test data in source database
          PGPASSWORD=sourcepass psql -h localhost -p 5432 -U postgres -d sourcedb << EOF
          CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT, email TEXT);
          INSERT INTO users (name, email) VALUES
            ('John Doe', 'john@example.com'),
            ('Jane Smith', 'jane@example.com');
          EOF

      - name: Create backup
        env:
          DATABASE_URL: postgres://postgres:sourcepass@localhost:5432/sourcedb
        run: bun run bin/cli.ts

      - name: Verify backup file
        run: |
          # Check backup was created
          BACKUP_FILE=$(ls ./backups/*.sql | head -1)
          if [ ! -f "$BACKUP_FILE" ]; then
            echo "Backup file not found!"
            exit 1
          fi

          # Check backup contains expected data
          if ! grep -q "users" "$BACKUP_FILE"; then
            echo "Backup doesn't contain expected table!"
            exit 1
          fi

          echo "Backup verification passed"

      - name: Test restore
        run: |
          # Restore backup to target database
          BACKUP_FILE=$(ls ./backups/*.sql | head -1)
          PGPASSWORD=targetpass psql -h localhost -p 5433 -U postgres -d targetdb < "$BACKUP_FILE"

          # Verify restored data
          RESTORED_COUNT=$(PGPASSWORD=targetpass psql -h localhost -p 5433 -U postgres -d targetdb -t -c "SELECT COUNT(*) FROM users;")

          if [ "$RESTORED_COUNT" -ne 2 ]; then
            echo "Restore verification failed! Expected 2 users, got $RESTORED_COUNT"
            exit 1
          fi

          echo "Restore verification passed"

      - name: Performance benchmark
        run: |
          # Benchmark backup performance
          time bun run bin/cli.ts

          # Check backup size
          BACKUP_SIZE=$(du -sh ./backups | cut -f1)
          echo "Backup size: $BACKUP_SIZE"
```

## Multi-Database Backup

### Parallel Database Backup

```yaml
# .github/workflows/multi-db-backup.yml
name: Multi-Database Backup

on:
  schedule:
    - cron: '0 1 * * *'
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        database:
          - name: users-db
            url: ${{ secrets.USERS_DB_URL }}
            retention_days: 90
          - name: analytics-db
            url: ${{ secrets.ANALYTICS_DB_URL }}
            retention_days: 30
          - name: logs-db
            url: ${{ secrets.LOGS_DB_URL }}
            retention_days: 7

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Create database-specific config
        run: |
          cat > backup-config.json << EOF
          {
            "verbose": true,
            "databases": [
              {
                "type": "POSTGRESQL",
                "name": "${{ matrix.database.name }}",
                "connection": "${{ matrix.database.url }}",
                "compress": true
              }
            ],
            "outputPath": "./backups/${{ matrix.database.name }}",
            "retention": {
              "maxAge": ${{ matrix.database.retention_days }}
            }
          }
          EOF

      - name: Run backup for ${{ matrix.database.name }}
        run: bun run bin/cli.ts --config ./backup-config.json

      - name: Upload to S3 with lifecycle policy
        run: |
          aws s3 sync ./backups/${{ matrix.database.name }} \
            s3://${{ secrets.BACKUP_BUCKET }}/${{ matrix.database.name }}/ \
            --storage-class STANDARD_IA
```

## Notification Integration

### Slack/Discord Notifications

```yaml
# .github/workflows/backup-with-notifications.yml
name: Backup with Notifications

on:
  schedule:
    - cron: '0 2 * * *'

jobs:
  backup:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run backup
        id: backup
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          # Capture backup output
          OUTPUT=$(bun run bin/cli.ts 2>&1)
          echo "$OUTPUT"

          # Extract metrics
          SUCCESS_COUNT=$(echo "$OUTPUT" | grep -o 'successful: [0-9]*' | grep -o '[0-9]*' || echo "0")
          TOTAL_SIZE=$(du -sh ./backups | cut -f1)

          echo "success_count=$SUCCESS_COUNT" >> $GITHUB_OUTPUT
          echo "total_size=$TOTAL_SIZE" >> $GITHUB_OUTPUT

      - name: Notify success
        if: success()
        uses: 8398a7/action-slack@v3
        with:
          status: success
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          text: |
            ✅ Daily backup completed successfully!

            📊 **Backup Summary:**
            • Success Count: ${{ steps.backup.outputs.success_count }}
            • Total Size: ${{ steps.backup.outputs.total_size }}
            • Workflow: ${{ github.workflow }}
            • Repository: ${{ github.repository }}

      - name: Notify failure
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
          text: |
            ❌ Daily backup failed!

            🔗 **Check the logs:** ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

This guide provides comprehensive examples for integrating ts-backups into CI/CD pipelines with proper error handling, testing, and notifications.
