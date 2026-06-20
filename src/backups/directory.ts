import type { BackupResult, FileConfig } from '../types'
import { Buffer } from 'node:buffer'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { createGzip } from 'node:zlib'
import { Logger } from '@stacksjs/clarity'
import { BackupType } from '../types'

const logger = new Logger('ts-backups:directory')

export async function backupDirectory(config: FileConfig, outputPath: string): Promise<BackupResult> {
  const startTime = Date.now()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const baseFilename = config.filename || config.name
  const extension = config.compress ? '.tar.gz' : '.tar'
  const filename = `${baseFilename}_${timestamp}${extension}`
  const fullPath = join(outputPath, filename)

  if (config.verbose) {
    logger.warn(`📁 Starting directory backup for: ${config.path}`)
    logger.warn(`   Output: ${fullPath}`)
  }

  try {
    // Create output directory if it doesn't exist
    await mkdir(dirname(fullPath), { recursive: true })

    // Check if source directory exists
    if (!existsSync(config.path)) {
      throw new Error(`Directory not found: ${config.path}`)
    }

    // Get list of files to backup
    const filesToBackup = await getFilesToBackup(config)

    if (config.verbose) {
      logger.warn(`   Found ${filesToBackup.length} files to backup`)
    }

    // Create backup archive
    const { size } = await createArchive(config, filesToBackup, fullPath)

    const duration = Date.now() - startTime

    if (config.verbose) {
      logger.warn(`✅ Directory backup completed in ${duration}ms`)
      logger.warn(`   Size: ${formatBytes(size)}`)
      logger.warn(`   Files: ${filesToBackup.length}`)
    }

    return {
      name: config.name,
      type: BackupType.DIRECTORY,
      filename,
      size,
      duration,
      success: true,
      fileCount: filesToBackup.length,
    }
  }
  catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (config.verbose) {
      logger.error(`❌ Directory backup failed: ${errorMessage}`)
    }

    return {
      name: config.name,
      type: BackupType.DIRECTORY,
      filename: '',
      size: 0,
      duration,
      success: false,
      error: errorMessage,
      fileCount: 0,
    }
  }
}

async function getFilesToBackup(config: FileConfig): Promise<string[]> {
  const files: string[] = []

  // Compile the glob patterns ONCE up front. Compiling them per-entry (as this
  // used to) means tens of millions of `new RegExp` calls on a large tree —
  // e.g. ~30 patterns over a 1.4M-file source dir — which dominates the run and
  // turns a few-second walk into several minutes.
  const includeM = compileMatcher(config.include)
  const excludeM = compileMatcher(config.exclude)

  // `relDir` is the entry's directory path relative to config.path, using '/'
  // separators. We thread it down the recursion and append entry names, which
  // avoids calling the (surprisingly expensive) path.relative() once per entry
  // — on a 1.4M-file tree that single change is the difference between minutes
  // and seconds. Patterns are matched against this '/'-joined form directly.
  async function scanDirectory(dirPath: string, relDir: string): Promise<void> {
    let entries
    try {
      entries = await readdir(dirPath, { withFileTypes: true })
    }
    catch {
      return // Skip directories we can't read
    }

    for (const entry of entries) {
      const relativePath = relDir ? `${relDir}/${entry.name}` : entry.name

      // Exclusions apply to BOTH files and directories, so an excluded
      // directory (e.g. node_modules) is pruned before we descend into it.
      if (excludeM && matches(excludeM, relDir, entry.name, relativePath)) {
        continue
      }

      const fullPath = join(dirPath, entry.name)

      if (entry.isDirectory()) {
        // Always recurse into non-excluded directories. `include` is a FILE
        // filter only — applying it to directories would halt traversal
        // before we ever reached the matching files inside them (e.g. an
        // `include: ['**/.env']` pattern would never enter any subfolder).
        await scanDirectory(fullPath, relativePath)
        continue
      }

      // Inclusions (if specified) gate individual files/symlinked files.
      if (includeM && !matches(includeM, relDir, entry.name, relativePath)) {
        continue
      }

      if (entry.isFile()) {
        // Check file size limit
        if (config.maxFileSize) {
          const stats = await stat(fullPath)
          if (stats.size > config.maxFileSize) {
            continue
          }
        }

        files.push(fullPath)
      }
      else if (entry.isSymbolicLink() && config.followSymlinks) {
        const stats = await stat(fullPath)
        if (stats.isDirectory()) {
          await scanDirectory(fullPath, relativePath)
        }
        else if (stats.isFile()) {
          files.push(fullPath)
        }
      }
    }
  }

  await scanDirectory(config.path, '')
  return files
}

/** Translate a single glob pattern into an anchored RegExp. */
// eslint-disable-next-line pickier/no-unused-vars
function compilePattern(pattern: string): RegExp {
  // eslint-disable-next-line pickier/no-unused-vars
  return new RegExp(
    `^${pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\//g, '[\\/\\\\]')}$`,
  )
}

/**
 * A set of glob patterns precompiled for fast repeated matching against a huge
 * file tree. The overwhelmingly common patterns — a plain directory/file name
 * (`node_modules`) or that same name at any depth (`**​/node_modules`) — are
 * lifted out of regex-land into O(1) Set lookups on the basename, so a walk of
 * a 1.4M-file tree does one Set check per entry instead of dozens of regex
 * tests. Anything with embedded globs or path separators still falls back to a
 * compiled RegExp, preserving the original semantics exactly.
 */
interface CompiledMatcher {
  /** `**​/<name>` → match a non-root entry whose basename is <name>. */
  anywhereNames: Set<string>
  /** `<name>` → match only the root-level entry whose basename is <name>. */
  topLevelNames: Set<string>
  /** Everything else (real globs, paths with separators). */
  regexes: RegExp[]
}

/** A plain token: no glob metacharacters (`*`, `?`) and no path separator. */
function isLiteralToken(token: string): boolean {
  return token.length > 0
    && !token.includes('*')
    && !token.includes('?')
    && !token.includes('/')
}

function compileMatcher(patterns?: string[]): CompiledMatcher | null {
  if (!patterns || patterns.length === 0)
    return null

  const anywhereNames = new Set<string>()
  const topLevelNames = new Set<string>()
  const regexes: RegExp[] = []

  for (const pattern of patterns) {
    const anywhere = pattern.startsWith('**/') ? pattern.slice(3) : null
    if (anywhere !== null && isLiteralToken(anywhere))
      anywhereNames.add(anywhere)
    else if (isLiteralToken(pattern))
      topLevelNames.add(pattern)
    else
      regexes.push(compilePattern(pattern))
  }

  return { anywhereNames, topLevelNames, regexes }
}

/**
 * Test one entry against a compiled matcher. `relDir` is the entry's parent
 * path relative to the backup root ('' at the root); `name` is the basename;
 * `relativePath` is the '/'-joined full relative path used for glob regexes.
 */
function matches(m: CompiledMatcher, relDir: string, name: string, relativePath: string): boolean {
  if (relDir === '') {
    if (m.topLevelNames.has(name))
      return true
  }
  else if (m.anywhereNames.has(name)) {
    return true
  }
  for (const re of m.regexes) {
    if (re.test(relativePath))
      return true
  }
  return false
}

async function createArchive(
  config: FileConfig,
  filePaths: string[],
  outputPath: string,
): Promise<{ size: number }> {
  return new Promise((resolve, reject) => {
    const writeStream = createWriteStream(outputPath)
    const gzipStream = config.compress ? createGzip() : null
    const finalStream = gzipStream || writeStream

    if (gzipStream) {
      gzipStream.pipe(writeStream)
    }

    let totalSize = 0
    let currentIndex = 0

    async function writeNextFile() {
      if (currentIndex >= filePaths.length) {
        finalStream.end()
        return
      }

      const filePath = filePaths[currentIndex++]
      const relativePath = relative(config.path, filePath)

      try {
        const fileContent = await readFile(filePath)
        const stats = await stat(filePath)

        // Write file header (simple format for now)
        const header = createFileHeader(relativePath, fileContent.length, stats, config.preserveMetadata)
        finalStream.write(header)

        // Write file content
        finalStream.write(fileContent)

        totalSize += header.length + fileContent.length

        // Continue with next file
        setImmediate(writeNextFile)
      }
      catch {
        // Skip files we can't read
        setImmediate(writeNextFile)
      }
    }

    writeStream.on('error', reject)
    if (gzipStream) {
      gzipStream.on('error', reject)
    }

    writeStream.on('close', () => {
      resolve({ size: totalSize })
    })

    // Start writing files
    writeNextFile()
  })
}

function createFileHeader(
  relativePath: string,
  size: number,
  stats: any,
  preserveMetadata?: boolean,
): Buffer {
  const metadata = preserveMetadata
    ? {
        mtime: stats.mtime.getTime(),
        mode: stats.mode,
        uid: stats.uid,
        gid: stats.gid,
      }
    : {}

  const headerData = {
    path: relativePath,
    size,
    ...metadata,
  }

  const headerJson = JSON.stringify(headerData)
  const headerSize = Buffer.byteLength(headerJson, 'utf8')

  // Create header: [4 bytes header size][header json][file content follows]
  const header = Buffer.alloc(4 + headerSize)
  header.writeUInt32BE(headerSize, 0)
  header.write(headerJson, 4, 'utf8')

  return header
}

function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}
