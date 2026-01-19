# Cloud Storage

Backupx can integrate with various cloud storage providers to store your backups securely off-site. This guide covers setting up cloud storage integration for disaster recovery and geographic redundancy.

## AWS S3 Integration

### Basic S3 Upload

Upload backups to Amazon S3 after creation:

```ts
import { createBackup } from 'backupx'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

async function backupToS3() {
  const localPath = './backups'

  // Create local backup
  const summary = await createBackup({
    outputPath: localPath,
    databases: [
      {
        type: 'postgresql',
        name: 'production-db',
        connection: process.env.DATABASE_URL,
        compress: true,
      },
    ],
  })

  // Upload successful backups to S3
  for (const backup of summary.databaseBackups) {
    if (!backup.success)
      continue

    const filePath = join(localPath, backup.filename)
    const fileContent = await readFile(filePath)

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Key: `backups/${backup.filename}`,
      Body: fileContent,
      ContentType: 'application/sql',
      ServerSideEncryption: 'AES256',
      Metadata: {
        'backup-name': backup.name,
        'backup-date': new Date().toISOString(),
      },
    }))

    console.log(`Uploaded to S3: ${backup.filename}`)
  }
}
```

### S3 with Lifecycle Rules

Configure S3 lifecycle rules for automatic archival and deletion:

```ts
import { S3Client, PutBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3'

async function configureS3Lifecycle() {
  const s3Client = new S3Client({ region: process.env.AWS_REGION })

  await s3Client.send(new PutBucketLifecycleConfigurationCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    LifecycleConfiguration: {
      Rules: [
        {
          ID: 'backup-lifecycle',
          Status: 'Enabled',
          Filter: {
            Prefix: 'backups/',
          },
          Transitions: [
            {
              Days: 30,
              StorageClass: 'STANDARD_IA', // Infrequent Access after 30 days
            },
            {
              Days: 90,
              StorageClass: 'GLACIER', // Glacier after 90 days
            },
          ],
          Expiration: {
            Days: 365, // Delete after 1 year
          },
        },
      ],
    },
  }))
}
```

## Google Cloud Storage

### GCS Integration

Upload backups to Google Cloud Storage:

```ts
import { createBackup } from 'backupx'
import { Storage } from '@google-cloud/storage'
import { join } from 'node:path'

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: process.env.GCP_KEY_FILE,
})

const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)

async function backupToGCS() {
  const localPath = './backups'

  // Create local backup
  const summary = await createBackup({
    outputPath: localPath,
    databases: [
      {
        type: 'postgresql',
        name: 'production-db',
        connection: process.env.DATABASE_URL,
        compress: true,
      },
    ],
  })

  // Upload to GCS
  for (const backup of summary.databaseBackups) {
    if (!backup.success)
      continue

    const filePath = join(localPath, backup.filename)
    const destination = `backups/${backup.filename}`

    await bucket.upload(filePath, {
      destination,
      metadata: {
        contentType: 'application/sql',
        metadata: {
          backupName: backup.name,
          backupDate: new Date().toISOString(),
        },
      },
    })

    console.log(`Uploaded to GCS: ${backup.filename}`)
  }
}
```

## Azure Blob Storage

### Azure Integration

Upload backups to Azure Blob Storage:

```ts
import { createBackup } from 'backupx'
import { BlobServiceClient } from '@azure/storage-blob'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const blobServiceClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING!,
)
const containerClient = blobServiceClient.getContainerClient('backups')

async function backupToAzure() {
  const localPath = './backups'

  // Create local backup
  const summary = await createBackup({
    outputPath: localPath,
    databases: [
      {
        type: 'postgresql',
        name: 'production-db',
        connection: process.env.DATABASE_URL,
        compress: true,
      },
    ],
  })

  // Upload to Azure Blob Storage
  for (const backup of summary.databaseBackups) {
    if (!backup.success)
      continue

    const filePath = join(localPath, backup.filename)
    const fileContent = await readFile(filePath)
    const blockBlobClient = containerClient.getBlockBlobClient(backup.filename)

    await blockBlobClient.upload(fileContent, fileContent.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/sql',
      },
      metadata: {
        backupName: backup.name,
        backupDate: new Date().toISOString(),
      },
    })

    console.log(`Uploaded to Azure: ${backup.filename}`)
  }
}
```

## Multi-Cloud Strategy

### Redundant Cloud Storage

Upload backups to multiple cloud providers for redundancy:

```ts
import { createBackup } from 'backupx'
import { uploadToS3 } from './cloud/s3'
import { uploadToGCS } from './cloud/gcs'
import { uploadToAzure } from './cloud/azure'

interface CloudUploadResult {
  provider: string
  success: boolean
  error?: string
}

async function backupToMultiCloud() {
  const localPath = './backups'

  // Create local backup
  const summary = await createBackup({
    outputPath: localPath,
    databases: [
      {
        type: 'postgresql',
        name: 'production-db',
        connection: process.env.DATABASE_URL,
        compress: true,
      },
    ],
  })

  const results: CloudUploadResult[] = []

  for (const backup of summary.databaseBackups) {
    if (!backup.success)
      continue

    const filePath = join(localPath, backup.filename)

    // Upload to all providers in parallel
    const uploadPromises = [
      uploadToS3(filePath, backup.filename).then(() => ({
        provider: 'aws-s3',
        success: true,
      })).catch(error => ({
        provider: 'aws-s3',
        success: false,
        error: error.message,
      })),

      uploadToGCS(filePath, backup.filename).then(() => ({
        provider: 'gcs',
        success: true,
      })).catch(error => ({
        provider: 'gcs',
        success: false,
        error: error.message,
      })),

      uploadToAzure(filePath, backup.filename).then(() => ({
        provider: 'azure',
        success: true,
      })).catch(error => ({
        provider: 'azure',
        success: false,
        error: error.message,
      })),
    ]

    const uploadResults = await Promise.all(uploadPromises)
    results.push(...uploadResults)
  }

  return results
}
```

## Cloudflare R2

### R2 Integration (S3-Compatible)

Cloudflare R2 uses S3-compatible APIs:

```ts
import { createBackup } from 'backupx'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

async function backupToR2() {
  const localPath = './backups'

  const summary = await createBackup({
    outputPath: localPath,
    databases: [
      {
        type: 'postgresql',
        name: 'production-db',
        connection: process.env.DATABASE_URL,
        compress: true,
      },
    ],
  })

  for (const backup of summary.databaseBackups) {
    if (!backup.success)
      continue

    const filePath = join(localPath, backup.filename)
    const fileContent = await readFile(filePath)

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: `backups/${backup.filename}`,
      Body: fileContent,
      ContentType: 'application/sql',
    }))

    console.log(`Uploaded to R2: ${backup.filename}`)
  }
}
```

## Backup Restoration from Cloud

### Download and Restore

Download backups from cloud storage for restoration:

```ts
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { writeFile } from 'node:fs/promises'
import { Readable } from 'node:stream'

const s3Client = new S3Client({ region: process.env.AWS_REGION })

async function listCloudBackups(): Promise<string[]> {
  const response = await s3Client.send(new ListObjectsV2Command({
    Bucket: process.env.S3_BUCKET_NAME!,
    Prefix: 'backups/',
  }))

  return (response.Contents || [])
    .map(obj => obj.Key!)
    .filter(key => key.endsWith('.sql') || key.endsWith('.sql.gz'))
    .sort()
    .reverse() // Most recent first
}

async function downloadBackup(key: string, localPath: string): Promise<void> {
  const response = await s3Client.send(new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
  }))

  const stream = response.Body as Readable
  const chunks: Buffer[] = []

  for await (const chunk of stream) {
    chunks.push(chunk)
  }

  await writeFile(localPath, Buffer.concat(chunks))
  console.log(`Downloaded: ${key} -> ${localPath}`)
}

// Usage
const backups = await listCloudBackups()
console.log('Available backups:', backups)

// Download most recent backup
if (backups.length > 0) {
  await downloadBackup(backups[0], './restore/latest-backup.sql')
}
```

## Best Practices

1. **Enable Server-Side Encryption**: Always encrypt backups at rest
2. **Use IAM Roles**: Prefer IAM roles over access keys when possible
3. **Implement Versioning**: Enable bucket versioning for additional protection
4. **Set Up Lifecycle Policies**: Automatically transition to cheaper storage tiers
5. **Monitor Upload Status**: Track and alert on upload failures
6. **Test Restoration**: Regularly verify you can download and restore from cloud
7. **Geographic Redundancy**: Store backups in multiple regions
8. **Access Logging**: Enable access logging on storage buckets
9. **Cost Monitoring**: Monitor cloud storage costs and optimize as needed
10. **Cleanup Local Files**: Remove local backups after successful cloud upload
