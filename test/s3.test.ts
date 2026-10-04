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

/**
 * A tiny S3 stand-in: enough of PUT, HEAD, ListObjectsV2 and DELETE for
 * Bun's S3Client, recording the access key each request was signed with.
 */
function fakeS3(seed: Record<string, { body: string, lastModified: Date }> = {}) {
  const objects = new Map(Object.entries(seed).map(([k, v]) => [k, { ...v }]))
  const signedWith: string[] = []
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const url = new URL(req.url)
      const auth = req.headers.get('authorization') ?? ''
      signedWith.push(/Credential=([^/]+)\//.exec(auth)?.[1] ?? '')
      // Path style: /bucket/key
      const [, , ...rest] = url.pathname.split('/')
      const key = decodeURIComponent(rest.join('/'))
      if (req.method === 'PUT') {
        objects.set(key, { body: await req.text(), lastModified: new Date() })
        return new Response(null, { status: 200, headers: { etag: '"x"' } })
      }
      if (req.method === 'HEAD') {
        const o = objects.get(key)
        return o
          ? new Response(null, { status: 200, headers: { 'content-length': String(o.body.length), 'last-modified': o.lastModified.toUTCString() } })
          : new Response(null, { status: 404 })
      }
      if (req.method === 'DELETE') {
        objects.delete(key)
        return new Response(null, { status: 204 })
      }
      if (req.method === 'GET' && url.searchParams.get('list-type') === '2') {
        const prefix = url.searchParams.get('prefix') ?? ''
        const items = [...objects.entries()].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))
        const xml = `<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>b</Name><Prefix>${prefix}</Prefix><KeyCount>${items.length}</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>${
          items.map(([k, o]) => `<Contents><Key>${k}</Key><LastModified>${o.lastModified.toISOString()}</LastModified><Size>${o.body.length}</Size><ETag>"x"</ETag><StorageClass>STANDARD</StorageClass></Contents>`).join('')
        }</ListBucketResult>`
        return new Response(xml, { headers: { 'content-type': 'application/xml' } })
      }
      return new Response('unsupported', { status: 400 })
    },
  })
  return { server, objects, signedWith, endpoint: `http://127.0.0.1:${server.port}` }
}

describe('S3 upload to a second provider', () => {
  let saved: string | undefined
  beforeEach(() => {
    saved = process.env.AWS_ACCESS_KEY_ID
    // The environment holds somebody else's keys, as an app with its own AWS
    // uploads does. A destination with credentials must not use them.
    process.env.AWS_ACCESS_KEY_ID = 'AKIAENVIRONMENTKEY'
    process.env.AWS_SECRET_ACCESS_KEY = 'environment-secret'
  })
  afterEach(() => {
    if (saved === undefined)
      delete process.env.AWS_ACCESS_KEY_ID
    else process.env.AWS_ACCESS_KEY_ID = saved
    delete process.env.AWS_SECRET_ACCESS_KEY
  })

  it('signs with the destination credentials, checks the size, and prunes only old objects under its prefix', async () => {
    const day = 86_400_000
    const s3 = fakeS3({
      'db/old-1.sqlite.zst': { body: 'a', lastModified: new Date(Date.now() - 40 * day) },
      'db/recent.sqlite.zst': { body: 'b', lastModified: new Date(Date.now() - 2 * day) },
      'other/old.sqlite.zst': { body: 'c', lastModified: new Date(Date.now() - 40 * day) },
    })
    const dir = await Bun.$`mktemp -d`.text()
    const file = `${dir.trim()}/stacks-2026-10-04.sqlite.zst`
    await Bun.write(file, 'x'.repeat(4096))
    try {
      const result = await uploadToS3({
        type: 's3',
        bucket: 'b',
        prefix: 'db/',
        region: 'fsn1',
        endpoint: s3.endpoint,
        credentials: { accessKeyId: 'HETZNERKEY', secretAccessKey: 'hetzner-secret' },
        keepDays: 30,
      }, file)

      expect(result.success).toBe(true)
      expect(result.bytes).toBe(4096)
      expect(result.target).toBe('s3://b/db/stacks-2026-10-04.sqlite.zst')
      expect(s3.objects.get('db/stacks-2026-10-04.sqlite.zst')?.body.length).toBe(4096)
      expect(result.pruned).toEqual(['db/old-1.sqlite.zst'])
      expect(s3.objects.has('db/recent.sqlite.zst')).toBe(true)
      expect(s3.objects.has('other/old.sqlite.zst')).toBe(true)
      expect(s3.signedWith.every(key => key === 'HETZNERKEY')).toBe(true)
    }
    finally {
      s3.server.stop(true)
    }
  })

  it('prunes nothing without a prefix', async () => {
    const { pruneS3 } = await import('../src/backups/s3')
    const s3 = fakeS3({ 'old.sqlite.zst': { body: 'a', lastModified: new Date(0) } })
    try {
      const pruned = await pruneS3({ type: 's3', bucket: 'b', endpoint: s3.endpoint, credentials: { accessKeyId: 'k', secretAccessKey: 's' } }, 1)
      expect(pruned).toEqual([])
      expect(s3.objects.size).toBe(1)
    }
    finally {
      s3.server.stop(true)
    }
  })
})
