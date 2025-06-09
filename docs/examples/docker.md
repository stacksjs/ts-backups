# Docker Integration Examples

This guide shows how to use ts-backups in Docker containers and docker-compose setups.

## Basic Docker Container

### Dockerfile

```dockerfile
FROM oven/bun:1.0-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY backups.config.ts ./

# Install dependencies
RUN bun install

# Copy source code
COPY src/ ./src/
COPY bin/ ./bin/

# Create backup directory
RUN mkdir -p /backups

# Set environment variables
ENV BACKUP_OUTPUT_PATH=/backups
ENV NODE_ENV=production

# Run backups
CMD ["bun", "run", "bin/cli.ts"]
```

### Docker Run Example

```bash
# Build the image
docker build -t my-app-backup .

# Run backup container
docker run \
  -v $(pwd)/backups:/backups \
  -v $(pwd)/data:/data:ro \
  -e DATABASE_URL="postgres://user:pass@host:5432/db" \
  my-app-backup
```

## Docker Compose Setup

### Complete Stack with Scheduled Backups

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Main application
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgres://user:password@postgres:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db-backups:/backups
    ports:
      - '5432:5432'

  # Redis Cache
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - '6379:6379'

  # Backup Service
  backup:
    build:
      context: .
      dockerfile: Dockerfile.backup
    environment:
      - DATABASE_URL=postgres://user:password@postgres:5432/myapp
      - BACKUP_SCHEDULE=0 2 * * * # Daily at 2 AM
      - BACKUP_RETENTION_DAYS=30
      - BACKUP_RETENTION_COUNT=10
    volumes:
      - ./backups:/app/backups
      - ./app-data:/app/data:ro
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### Backup Service Dockerfile

```dockerfile
# Dockerfile.backup
FROM oven/bun:1.0-alpine

# Install cron
RUN apk add --no-cache dcron

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./
COPY backups.config.ts ./

# Install dependencies
RUN bun install

# Copy backup configuration and scripts
COPY src/ ./src/
COPY bin/ ./bin/
COPY scripts/backup-cron.sh ./scripts/

# Make scripts executable
RUN chmod +x ./scripts/backup-cron.sh

# Create backup directory
RUN mkdir -p /app/backups

# Setup cron job
RUN echo "${BACKUP_SCHEDULE:-0 2 * * *} /app/scripts/backup-cron.sh" > /etc/crontabs/root

# Start cron daemon
CMD ["sh", "-c", "crond -f -d 8"]
```

### Backup Cron Script

```bash
#!/bin/sh
# scripts/backup-cron.sh

echo "$(date): Starting scheduled backup..."

# Run the backup
cd /app
bun run bin/cli.ts

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "$(date): Backup completed successfully"
else
    echo "$(date): Backup failed with exit code $?"
    exit 1
fi
```

## Kubernetes Deployment

### Backup CronJob

```yaml
# k8s/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: app-backup
  namespace: production
spec:
  schedule: '0 2 * * *' # Daily at 2 AM
  timeZone: UTC
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: my-app-backup:latest
              imagePullPolicy: Always
              env:
                - name: DATABASE_URL
                  valueFrom:
                    secretKeyRef:
                      name: app-secrets
                      key: database-url
                - name: BACKUP_OUTPUT_PATH
                  value: /backups
                - name: VERBOSE
                  value: 'true'
              volumeMounts:
                - name: backup-storage
                  mountPath: /backups
                - name: app-data
                  mountPath: /data
                  readOnly: true
              resources:
                requests:
                  memory: 256Mi
                  cpu: 100m
                limits:
                  memory: 1Gi
                  cpu: 500m
          volumes:
            - name: backup-storage
              persistentVolumeClaim:
                claimName: backup-pvc
            - name: app-data
              persistentVolumeClaim:
                claimName: app-data-pvc
```

### Persistent Volume Claim

```yaml
# k8s/backup-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backup-pvc
  namespace: production
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: fast-ssd
```

## Multi-Stage Docker Build

### Optimized Dockerfile

```dockerfile
# Multi-stage build for production
FROM oven/bun:1.0-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY bin/ ./bin/
COPY backups.config.ts ./

# Build the application (if needed)
RUN bun run build

# Production stage
FROM oven/bun:1.0-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    mysql-client \
    dcron \
    bash

WORKDIR /app

# Copy built application
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/backups.config.ts ./

# Copy scripts
COPY scripts/ ./scripts/
RUN chmod +x ./scripts/*.sh

# Create backup user
RUN addgroup -g 1001 backup && \
    adduser -D -u 1001 -G backup backup

# Create directories
RUN mkdir -p /app/backups /app/logs && \
    chown -R backup:backup /app

# Switch to backup user
USER backup

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ["bun", "run", "bin/cli.ts", "--health-check"]

# Default command
CMD ["bun", "run", "bin/cli.ts"]
```

## Docker Compose with External Database

### Backup Service for External PostgreSQL

```yaml
# docker-compose.backup.yml
version: '3.8'

services:
  postgres-backup:
    build:
      context: .
      dockerfile: Dockerfile.backup
    environment:
      # External database connection
      - DATABASE_URL=postgres://user:pass@external-host:5432/production_db
      - BACKUP_TYPE=postgresql
      - BACKUP_NAME=production-db
      - BACKUP_SCHEDULE=0 */6 * * * # Every 6 hours
      - BACKUP_COMPRESSION=true
      - BACKUP_RETENTION_COUNT=48 # Keep 48 backups (12 days)
      - BACKUP_VERBOSE=false
    volumes:
      - ./backups/postgresql:/app/backups
      - ./logs:/app/logs
    networks:
      - backup-network
    restart: unless-stopped

  file-backup:
    build:
      context: .
      dockerfile: Dockerfile.backup
    environment:
      - BACKUP_TYPE=file
      - BACKUP_NAME=app-files
      - BACKUP_SCHEDULE=0 3 * * * # Daily at 3 AM
      - BACKUP_SOURCE_PATH=/data
      - BACKUP_COMPRESSION=true
      - BACKUP_RETENTION_DAYS=30
    volumes:
      - ./backups/files:/app/backups
      - /var/app-data:/data:ro
      - ./logs:/app/logs
    networks:
      - backup-network
    restart: unless-stopped

networks:
  backup-network:
    driver: bridge
```

## Backup Monitoring with Docker

### Healthcheck Script

```bash
#!/bin/bash
# scripts/healthcheck.sh

# Check if backup process is running
if pgrep -f "backup" > /dev/null; then
    echo "Backup process is running"
    exit 0
fi

# Check last backup timestamp
LAST_BACKUP=$(find /app/backups -name "*.sql*" -type f -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)

if [ -z "$LAST_BACKUP" ]; then
    echo "No backups found"
    exit 1
fi

# Check if last backup is less than 25 hours old
LAST_BACKUP_TIME=$(stat -c %Y "$LAST_BACKUP")
CURRENT_TIME=$(date +%s)
DIFF=$((CURRENT_TIME - LAST_BACKUP_TIME))

if [ $DIFF -gt 90000 ]; then  # 25 hours in seconds
    echo "Last backup is too old: $(date -d @$LAST_BACKUP_TIME)"
    exit 1
fi

echo "Health check passed. Last backup: $(date -d @$LAST_BACKUP_TIME)"
exit 0
```

### Monitoring with Telegraf

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  telegraf:
    image: telegraf:1.28-alpine
    volumes:
      - ./monitoring/telegraf.conf:/etc/telegraf/telegraf.conf
      - ./backups:/backups:ro
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - INFLUXDB_URL=http://influxdb:8086
      - INFLUXDB_TOKEN=${INFLUXDB_TOKEN}
    depends_on:
      - influxdb

  influxdb:
    image: influxdb:2.7-alpine
    ports:
      - '8086:8086'
    volumes:
      - influxdb_data:/var/lib/influxdb2
    environment:
      - INFLUXDB_DB=monitoring
      - INFLUXDB_ADMIN_TOKEN=${INFLUXDB_TOKEN}

volumes:
  influxdb_data:
```

This guide provides comprehensive examples for running ts-backups in containerized environments with proper monitoring and scheduling.
