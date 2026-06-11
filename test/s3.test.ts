import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import process from 'node:process'
import { uploadToS3 } from '../src/backups/s3'

describe('S3 upload', () => {
  // Snapshot/restore the credential env so tests don't leak into each other.
  let savedEnv: Record<string, string | undefined>

  beforeEach(() => {
    savedEnv = {
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      AWS_PROFILE: process.env.AWS_PROFILE,
      AWS_ROLE_ARN: process.env.AWS_ROLE_ARN,
    }
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.S3_ACCESS_KEY_ID
    delete process.env.AWS_PROFILE
    delete process.env.AWS_ROLE_ARN
  })

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined)
        delete process.env[k]
      else process.env[k] = v
    }
  })

  it('skips cleanly when optional and no credentials are present', async () => {
    const result = await uploadToS3(
      { type: 's3', bucket: 'example-bucket', prefix: 'mail', optional: true },
      '/tmp/whatever_2026-06-11.sql',
    )
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    expect(result.destination).toBe('s3')
    expect(result.target).toBe('s3://example-bucket/mail/whatever_2026-06-11.sql')
  })

  it('builds the target key from prefix + basename', async () => {
    const result = await uploadToS3(
      { type: 's3', bucket: 'b', prefix: 'a/b/', optional: true },
      '/var/backups/maildir_2026-06-11.tar.gz',
    )
    // trailing slash on prefix is normalized
    expect(result.target).toBe('s3://b/a/b/maildir_2026-06-11.tar.gz')
  })

  it('omits the prefix segment when none is given', async () => {
    const result = await uploadToS3(
      { type: 's3', bucket: 'b', optional: true },
      '/var/backups/x.sql',
    )
    expect(result.target).toBe('s3://b/x.sql')
  })
})
