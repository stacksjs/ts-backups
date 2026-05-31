import type {
  BackupConfig,
  FileConfig,
  RestoreOptions,
  RestoreResult,
  RestoreSummary,
} from '../types'
import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { chmod, mkdir, readdir, readFile, utimes, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { BackupType } from '../types'

/** A single file entry decoded from a directory archive. */
interface ArchiveEntry {
  relativePath: string
  content: Buffer
  /** Present only when the backup was taken with `preserveMetadata`. */
  mode?: number
  mtime?: number
}

/** Minimal verbose-gated logger (avoids a hard dependency for restore). */
function makeLogger(verbose: boolean) {
  return {
    info: (msg: string) => {
      if (verbose)
        console.warn(msg)
    },
    error: (msg: string) => console.error(msg),
  }
}

/**
 * Restores file and directory backups produced by `BackupManager`.
 *
 * Database snapshots are intentionally NOT auto-restored — replaying a SQL dump
 * is destructive and should be done deliberately with the database's native
 * tooling (`psql < dump.sql`, `mysql < dump.sql`, `sqlite3 db < dump.sql`). They
 * are reported as `skipped` so the summary stays honest.
 */
export class RestoreManager {
  private logger: ReturnType<typeof makeLogger>

  constructor(
    private config: BackupConfig,
    private options: RestoreOptions = {},
  ) {
    this.logger = makeLogger(this.verbose)
  }

  private get verbose(): boolean {
    return this.options.verbose ?? this.config.verbose
  }

  async restore(): Promise<RestoreSummary> {
    const startTime = performance.now()
    const outputPath = this.config.outputPath || './backups'

    if (!existsSync(outputPath))
      throw new Error(`Backup directory not found: ${outputPath}`)

    this.logger.info(`🔄 Restoring from ${outputPath}...`)

    const results: RestoreResult[] = []

    // Files & directories — the data we can safely restore.
    const fileTargets = this.options.only
      ? this.config.files.filter(f => this.options.only!.includes(f.name))
      : this.config.files

    for (const fileConfig of fileTargets) {
      try {
        results.push(await this.restoreFile(fileConfig, outputPath))
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.push({
          name: fileConfig.name,
          type: BackupType.FILE,
          snapshot: '',
          restoredPath: this.options.targetPath ?? fileConfig.path,
          size: 0,
          duration: 0,
          success: false,
          error: message,
        })
        this.logger.error(`❌ Failed to restore ${fileConfig.name}: ${message}`)
      }
    }

    // Databases — report as skipped with guidance.
    const dbTargets = this.options.only
      ? this.config.databases.filter(d => this.options.only!.includes(d.name))
      : this.config.databases

    for (const db of dbTargets) {
      results.push({
        name: db.name,
        type: db.type,
        snapshot: '',
        restoredPath: '',
        size: 0,
        duration: 0,
        success: false,
        skipped: true,
        error: 'Database restore is manual — load the dump with the database\'s native client.',
      })
      this.logger.info(`⏭️  Skipping database '${db.name}' — restore manually with its native client.`)
    }

    const summary: RestoreSummary = {
      results,
      totalDuration: performance.now() - startTime,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success && !r.skipped).length,
      skippedCount: results.filter(r => r.skipped).length,
    }

    this.logger.info(
      `\n✅ Restore complete: ${summary.successCount} restored, `
      + `${summary.failureCount} failed, ${summary.skippedCount} skipped.`,
    )

    return summary
  }

  private async restoreFile(config: FileConfig, outputPath: string): Promise<RestoreResult> {
    const startTime = performance.now()
    const base = config.filename || config.name

    const snapshot = this.options.snapshot ?? await findLatestSnapshot(outputPath, base)
    if (!snapshot)
      throw new Error(`No snapshot found for '${config.name}' in ${outputPath}`)

    const snapshotPath = join(outputPath, snapshot)
    if (!existsSync(snapshotPath))
      throw new Error(`Snapshot not found: ${snapshotPath}`)

    let content = await readFile(snapshotPath)
    let name = snapshot
    if (name.endsWith('.gz')) {
      content = gunzipSync(content)
      name = name.slice(0, -'.gz'.length)
    }

    // `.tar` snapshots are directory archives; anything else is a single file.
    if (name.endsWith('.tar'))
      return this.restoreDirectory(config, snapshot, content, startTime)

    return this.restoreSingleFile(config, snapshot, content, startTime)
  }

  private async restoreSingleFile(
    config: FileConfig,
    snapshot: string,
    content: Buffer,
    startTime: number,
  ): Promise<RestoreResult> {
    const dest = this.options.targetPath
      ? join(this.options.targetPath, basename(config.path))
      : config.path

    if (existsSync(dest) && !this.options.overwrite)
      throw new Error(`Destination exists: ${dest} (use --overwrite to replace)`)

    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, content)
    this.logger.info(`  ✓ restored ${config.name} → ${dest}`)

    return {
      name: config.name,
      type: BackupType.FILE,
      snapshot,
      restoredPath: dest,
      size: content.length,
      duration: performance.now() - startTime,
      success: true,
    }
  }

  private async restoreDirectory(
    config: FileConfig,
    snapshot: string,
    archive: Buffer,
    startTime: number,
  ): Promise<RestoreResult> {
    const destBase = this.options.targetPath ?? config.path
    const entries = parseArchive(archive)
    let bytes = 0
    let written = 0

    for (const entry of entries) {
      const dest = join(destBase, entry.relativePath)
      if (existsSync(dest) && !this.options.overwrite) {
        this.logger.info(`  ↷ exists, skipping ${dest} (use --overwrite)`)
        continue
      }
      await mkdir(dirname(dest), { recursive: true })
      await writeFile(dest, entry.content)
      if (entry.mode !== undefined)
        await chmod(dest, entry.mode).catch(() => {})
      if (entry.mtime !== undefined) {
        const t = new Date(entry.mtime)
        await utimes(dest, t, t).catch(() => {})
      }
      bytes += entry.content.length
      written++
    }

    this.logger.info(`  ✓ restored ${written} file(s) → ${destBase}`)

    return {
      name: config.name,
      type: BackupType.DIRECTORY,
      snapshot,
      restoredPath: destBase,
      size: bytes,
      fileCount: written,
      duration: performance.now() - startTime,
      success: true,
    }
  }
}

/**
 * Find the most recent snapshot for a backup whose files are named
 * `<base>_<ISO-timestamp>...`. ISO-8601 timestamps sort chronologically, so a
 * lexicographic sort suffices.
 */
export async function findLatestSnapshot(outputPath: string, base: string): Promise<string | null> {
  const prefix = `${base}_`
  const all = await readdir(outputPath)
  // Ignore sidecar metadata files written next to single-file backups.
  const matches = all.filter(f => f.startsWith(prefix) && !f.endsWith('.meta')).sort()
  return matches.length ? matches[matches.length - 1] : null
}

/**
 * Decode the archive written by `backupDirectory`.
 *
 * Layout (repeated per file): a 4-byte big-endian header length, that many bytes
 * of JSON (`{ path, size, mtime?, mode?, uid?, gid? }`), then `size` bytes of
 * raw file content. This matches `createFileHeader` in `src/backups/directory.ts`.
 */
export function parseArchive(buffer: Buffer): ArchiveEntry[] {
  const entries: ArchiveEntry[] = []
  let offset = 0

  while (offset < buffer.length) {
    if (offset + 4 > buffer.length)
      throw new Error('Corrupt archive: truncated header length')

    const headerSize = buffer.readUInt32BE(offset)
    offset += 4

    if (headerSize <= 0 || offset + headerSize > buffer.length)
      throw new Error('Corrupt archive: invalid header size')

    const headerJson = buffer.subarray(offset, offset + headerSize).toString('utf-8')
    offset += headerSize

    let header: { path?: string, size?: number, mtime?: number, mode?: number }
    try {
      header = JSON.parse(headerJson)
    }
    catch {
      throw new Error('Corrupt archive: header is not valid JSON')
    }

    if (typeof header.path !== 'string' || typeof header.size !== 'number')
      throw new Error('Corrupt archive: header missing path/size')

    const content = buffer.subarray(offset, offset + header.size)
    offset += header.size

    entries.push({
      relativePath: header.path,
      content: Buffer.from(content),
      mode: header.mode,
      mtime: header.mtime,
    })
  }

  return entries
}

/** Restore using a loaded config (the entry point used by `backups restore`). */
export async function restoreFromConfig(
  config: BackupConfig,
  options: RestoreOptions = {},
): Promise<RestoreSummary> {
  return new RestoreManager(config, options).restore()
}
