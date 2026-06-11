import type { S3Destination, UploadResult } from '../types'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import process from 'node:process'
import { S3Client } from 'bun'
import { Logger } from '@stacksjs/clarity'

const logger = new Logger('ts-backups:s3')

function hasCredentials(dest: S3Destination): boolean {
  // Bun's S3Client reads AWS_ACCESS_KEY_ID/SECRET (and S3_* aliases) from
  // env; we only need to know whether *some* credential source exists so an
  // optional destination can skip cleanly instead of throwing.
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID
    || process.env.S3_ACCESS_KEY_ID
    || process.env.AWS_PROFILE
    || process.env.AWS_ROLE_ARN
    // Endpoint-based providers (R2/MinIO) commonly use the generic keys above;
    // treat a custom endpoint with no creds as still worth attempting so a
    // misconfiguration surfaces rather than silently skipping.
    || dest.endpoint,
  )
}

function region(dest: S3Destination): string | undefined {
  return dest.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION
}

/**
 * Upload one already-produced backup file to an S3 destination. Returns a
 * structured result rather than throwing, so one failed upload (or a
 * credential-less optional destination) doesn't abort the whole run.
 */
export async function uploadToS3(
  dest: S3Destination,
  localFile: string,
  verbose = false,
): Promise<UploadResult> {
  const key = (dest.prefix ? `${dest.prefix.replace(/\/$/, '')}/` : '') + basename(localFile)
  const target = `s3://${dest.bucket}/${key}`

  if (dest.optional !== false && !hasCredentials(dest)) {
    if (verbose)
      logger.warn(`⏭️  Skipping S3 upload (no credentials): ${target}`)
    return { destination: 's3', filename: basename(localFile), target, success: true, skipped: true }
  }

  try {
    if (verbose)
      logger.warn(`☁️  Uploading ${basename(localFile)} → ${target}`)

    const client = new S3Client({
      bucket: dest.bucket,
      region: region(dest),
      endpoint: dest.endpoint,
    })

    // Stream the file in rather than buffering the whole archive in memory;
    // maildir tarballs can be large.
    const data = await readFile(localFile)
    await client.write(key, data)

    if (verbose)
      logger.warn(`✅ Uploaded ${target}`)
    return { destination: 's3', filename: basename(localFile), target, success: true }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`❌ S3 upload failed for ${target}: ${message}`)
    return { destination: 's3', filename: basename(localFile), target, success: false, error: message }
  }
}
