import type { S3Destination, UploadResult } from '../types'
import { basename } from 'node:path'
import process from 'node:process'
import { S3Client } from 'bun'
import { Logger } from '@stacksjs/clarity'

const logger = new Logger('ts-backups:s3')

function hasCredentials(dest: S3Destination): boolean {
  // Bun's S3Client reads AWS_ACCESS_KEY_ID/SECRET (and S3_* aliases) from
  // env; we only need to know whether *some* credential source exists so an
  // optional destination can skip cleanly instead of throwing.
  if (dest.credentials)
    return Boolean(dest.credentials.accessKeyId && dest.credentials.secretAccessKey)
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

/** The key prefix with exactly one trailing slash, or '' for none. */
function keyPrefix(dest: S3Destination): string {
  const prefix = (dest.prefix ?? '').replace(/^\/+|\/+$/g, '')
  return prefix ? `${prefix}/` : ''
}

/**
 * The client for one destination. Its own credentials when it names them,
 * so a second provider is never handed the environment's AWS keys.
 */
export function s3ClientFor(dest: S3Destination): S3Client {
  return new S3Client({
    bucket: dest.bucket,
    region: region(dest),
    endpoint: dest.endpoint,
    ...(dest.credentials
      ? { accessKeyId: dest.credentials.accessKeyId, secretAccessKey: dest.credentials.secretAccessKey }
      : {}),
  })
}

/**
 * Delete objects under the destination's prefix older than `keepDays`.
 *
 * Only ever under the prefix, and never the object just written: a prefix of
 * "" with a short keepDays must not be able to empty a shared bucket of
 * anything but its own old uploads, so an empty prefix prunes nothing.
 */
export async function pruneS3(
  dest: S3Destination,
  keepDays: number,
  options: { now?: Date, keep?: string, client?: Pick<S3Client, 'list' | 'delete'> } = {},
): Promise<string[]> {
  const prefix = keyPrefix(dest)
  if (!prefix || !(keepDays > 0))
    return []

  const client = options.client ?? s3ClientFor(dest)
  const cutoff = (options.now ?? new Date()).getTime() - keepDays * 86_400_000
  const old: string[] = []

  let startAfter: string | undefined
  for (let page = 0; page < 100; page++) {
    const listing = await client.list({ prefix, maxKeys: 1000, ...(startAfter ? { startAfter } : {}) })
    const contents = listing.contents ?? []
    for (const object of contents) {
      if (!object.key || object.key === options.keep || !object.key.startsWith(prefix))
        continue
      const modified = object.lastModified ? new Date(object.lastModified).getTime() : Number.NaN
      if (Number.isFinite(modified) && modified < cutoff)
        old.push(object.key)
    }
    if (!listing.isTruncated || contents.length === 0)
      break
    startAfter = contents[contents.length - 1].key
  }

  for (const key of old)
    await client.delete(key)
  return old
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
  const key = keyPrefix(dest) + basename(localFile)
  const target = `s3://${dest.bucket}/${key}`

  if (dest.optional !== false && !hasCredentials(dest)) {
    if (verbose)
      logger.warn(`⏭️  Skipping S3 upload (no credentials): ${target}`)
    return { destination: 's3', filename: basename(localFile), target, success: true, skipped: true }
  }

  try {
    if (verbose)
      logger.warn(`☁️  Uploading ${basename(localFile)} → ${target}`)

    const client = s3ClientFor(dest)

    // A BunFile, not its bytes: Bun streams it up in parts, so a backup the
    // size of the database never has to fit in the memory of the box taking
    // it. This used to read the whole archive in first.
    const file = Bun.file(localFile)
    const bytes = file.size
    await client.write(key, file)

    // Trust, then check: an upload that reported success and left nothing,
    // or a truncated object, is a backup that is not there.
    const stored = await client.size(key)
    if (stored !== bytes)
      throw new Error(`uploaded ${bytes} bytes but the bucket holds ${stored}`)

    const pruned = dest.keepDays ? await pruneS3(dest, dest.keepDays, { keep: key, client }) : []

    if (verbose)
      logger.warn(`✅ Uploaded ${target}${pruned.length ? `, pruned ${pruned.length} older` : ''}`)
    return { destination: 's3', filename: basename(localFile), target, success: true, bytes, ...(pruned.length ? { pruned } : {}) }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error(`❌ S3 upload failed for ${target}: ${message}`)
    return { destination: 's3', filename: basename(localFile), target, success: false, error: message }
  }
}
