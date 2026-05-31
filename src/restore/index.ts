import type {
  BackupConfig,
  FileConfig,
  RestoreOptions,
  RestoreResult,
  RestoreSummary,
} from '../types'
import { existsSync } from 'node:fs'
import { chmod, mkdir, readdir, readFile, utimes, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { Logger } from '@stacksjs/clarity'
import { BackupType } from '../types'

const ARCHIVE_MAGIC = 'BACKUPX1'

interface ArchiveEntry {
  relativePath: string
  mode: number
  mtime: Date
  content: Buffer
}

/**
 * Restores file and directory backups produced by {@link BackupManager}.
 *
 * Database snapshots are intentionally NOT auto-restored — restoring a SQL dump
 * is destructive and should be done deliberately with the database's native
 * tooling (`psql < dump.sql`, `mysql < dump.sql`, `sqlite3 db < dump.sql`). They
 * are reported as `skipped` so the summary stays honest.
 */
export class RestoreManager {
  private logger = new Logger('backupx:restore')

  constructor(
    private config: BackupConfig,
    private options: RestoreOptions = {},
  ) {}

  private get verbose(): boolean {
    return this.options.verbose ?? this.config.verbose
  }

  async restore(): Promise<RestoreSummary> {
    const startTime = performance.now()
    const outputPath = this.config.outputPath || './backups'

    if (!existsSync(outputPath))
      throw new Error(`Backup directory not found: ${outputPath}`)

    if (this.verbose)
      this.logger.warn(`🔄 Restoring from ${outputPath}...`)

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
        if (this.verbose)
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
      if (this.verbose)
        this.logger.warn(`⏭️  Skipping database '${db.name}' — restore manually with its native client.`)
    }

    const summary: RestoreSummary = {
      results,
      totalDuration: performance.now() - startTime,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success && !r.skipped).length,
      skippedCount: results.filter(r => r.skipped).length,
    }

    if (this.verbose) {
      this.logger.warn(
        `\n✅ Restore complete: ${summary.successCount} restored, `
        + `${summary.failureCount} failed, ${summary.skippedCount} skipped.`,
      )
    }

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

    // `.tar` snapshots are directory archives; everything else is a single file.
    if (name.endsWith('.tar')) {
      const destBase = this.options.targetPath ?? config.path
      const entries = parseArchive(content)
      let bytes = 0

      for (const entry of entries) {
        const dest = join(destBase, entry.relativePath)
        if (existsSync(dest) && !this.options.overwrite) {
          if (this.verbose)
            this.logger.warn(`  ↷ exists, skipping ${dest} (use --overwrite)`)
          continue
        }
        await mkdir(dirname(dest), { recursive: true })
        await writeFile(dest, entry.content)
        await chmod(dest, entry.mode).catch(() => {})
        await utimes(dest, entry.mtime, entry.mtime).catch(() => {})
        bytes += entry.content.length
      }

      if (this.verbose)
        this.logger.warn(`  ✓ restored ${entries.length} file(s) → ${destBase}`)

      return {
        name: config.name,
        type: BackupType.DIRECTORY,
        snapshot,
        restoredPath: destBase,
        size: bytes,
        fileCount: entries.length,
        duration: performance.now() - startTime,
        success: true,
      }
    }

    // Single file.
    const dest = this.options.targetPath
      ? join(this.options.targetPath, basename(config.path))
      : config.path

    if (existsSync(dest) && !this.options.overwrite)
      throw new Error(`Destination exists: ${dest} (use --overwrite to replace)`)

    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, content)

    if (this.verbose)
      this.logger.warn(`  ✓ restored ${config.name} → ${dest}`)

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
}

/**
 * Find the most recent snapshot for a backup whose files are named
 * `<base>_<ISO-timestamp>...`. Timestamps are ISO-8601, so a lexicographic
 * sort is chronological.
 */
export async function findLatestSnapshot(outputPath: string, base: string): Promise<string | null> {
  const prefix = `${base}_`
  const all = await readdir(outputPath)
  const matches = all.filter(f => f.startsWith(prefix)).sort()
  return matches.length ? matches[matches.length - 1] : null
}

/**
 * Parse the custom `BACKUPX1` archive written by {@link backupDirectory}.
 *
 * Layout: magic(8) then per-entry
 *   pathLength(uint32 LE) + path + mode(uint32 LE) + mtime(uint64 LE ms) + contentLength(uint64 LE) + content
 */
export function parseArchive(buffer: Buffer): ArchiveEntry[] {
  const magic = buffer.subarray(0, ARCHIVE_MAGIC.length).toString('utf-8')
  if (magic !== ARCHIVE_MAGIC)
    throw new Error(`Not a ${ARCHIVE_MAGIC} archive (bad magic: ${JSON.stringify(magic)})`)

  const entries: ArchiveEntry[] = []
  let offset = ARCHIVE_MAGIC.length

  while (offset < buffer.length) {
    const pathLength = buffer.readUInt32LE(offset)
    offset += 4

    const relativePath = buffer.subarray(offset, offset + pathLength).toString('utf-8')
    offset += pathLength

    const mode = buffer.readUInt32LE(offset)
    offset += 4

    const mtime = new Date(Number(buffer.readBigUInt64LE(offset)))
    offset += 8

    const contentLength = Number(buffer.readBigUInt64LE(offset))
    offset += 8

    const content = buffer.subarray(offset, offset + contentLength)
    offset += contentLength

    entries.push({ relativePath, mode, mtime, content: Buffer.from(content) })
  }

  return entries
}

/**
 * Restore using the project's loaded config (the one used by `backupx restore`).
 */
export async function restoreFromConfig(
  config: BackupConfig,
  options: RestoreOptions = {},
): Promise<RestoreSummary> {
  return new RestoreManager(config, options).restore()
}
