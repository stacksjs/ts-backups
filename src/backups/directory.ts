import type { BackupResult, FileConfig } from '../types'
import { Buffer } from 'node:buffer'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { createGzip } from 'node:zlib'

export async function backupDirectory(config: FileConfig, outputPath: string): Promise<BackupResult> {
  const startTime = Date.now()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const baseFilename = config.filename || config.name
  const extension = config.compress ? '.tar.gz' : '.tar'
  const filename = `${baseFilename}_${timestamp}${extension}`
  const fullPath = join(outputPath, filename)

  if (config.verbose) {
    console.warn(`📁 Starting directory backup for: ${config.path}`)
    console.warn(`   Output: ${fullPath}`)
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
      console.warn(`   Found ${filesToBackup.length} files to backup`)
    }

    // Create backup archive
    const { size } = await createArchive(config, filesToBackup, fullPath)

    const duration = Date.now() - startTime

    if (config.verbose) {
      console.warn(`✅ Directory backup completed in ${duration}ms`)
      console.warn(`   Size: ${formatBytes(size)}`)
      console.warn(`   Files: ${filesToBackup.length}`)
    }

    return {
      name: config.name,
      type: 'directory',
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
      console.warn(`❌ Directory backup failed: ${errorMessage}`)
    }

    return {
      name: config.name,
      type: 'directory',
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

  async function scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name)
        const relativePath = relative(config.path, fullPath)

        // Check exclusions
        if (config.exclude && matchesPatterns(relativePath, config.exclude)) {
          continue
        }

        // Check inclusions (if specified)
        if (config.include && !matchesPatterns(relativePath, config.include)) {
          continue
        }

        if (entry.isDirectory()) {
          await scanDirectory(fullPath)
        }
        else if (entry.isFile()) {
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
            await scanDirectory(fullPath)
          }
          else if (stats.isFile()) {
            files.push(fullPath)
          }
        }
      }
    }
    catch {
      // Skip directories we can't read
    }
  }

  await scanDirectory(config.path)
  return files
}

function matchesPatterns(path: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    // Simple glob pattern matching
    const regex = new RegExp(
      `^${pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
        .replace(/\//g, '[\\/\\\\]')}$`,
    )
    return regex.test(path) || regex.test(path.replace(/\\/g, '/'))
  })
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
