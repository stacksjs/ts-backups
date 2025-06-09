import type { BackupResult, FileConfig } from '../types'
import { Buffer } from 'node:buffer'
import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { createGzip } from 'node:zlib'

export async function backupFile(config: FileConfig, outputPath: string): Promise<BackupResult> {
  const startTime = Date.now()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const baseFilename = config.filename || config.name
  const originalExt = extname(config.path)
  const extension = config.compress ? `${originalExt}.gz` : originalExt
  const filename = `${baseFilename}_${timestamp}${extension}`
  const fullPath = join(outputPath, filename)

  if (config.verbose) {
    console.warn(`📄 Starting file backup for: ${config.path}`)
    console.warn(`   Output: ${fullPath}`)
  }

  try {
    // Create output directory if it doesn't exist
    await mkdir(dirname(fullPath), { recursive: true })

    // Check if source file exists
    if (!existsSync(config.path)) {
      throw new Error(`File not found: ${config.path}`)
    }

    // Get file stats
    const fileStats = await stat(config.path)

    if (config.verbose) {
      console.warn(`   File size: ${formatBytes(fileStats.size)}`)
    }

    let actualSize: number

    if (config.compress) {
      actualSize = await compressFile(config.path, fullPath)
    }
    else {
      await copyFile(config.path, fullPath)
      actualSize = fileStats.size
    }

    // Preserve metadata if requested
    if (config.preserveMetadata) {
      await preserveFileMetadata(config.path, fullPath, fileStats)
    }

    const duration = Date.now() - startTime

    if (config.verbose) {
      console.warn(`✅ File backup completed in ${duration}ms`)
      console.warn(`   Size: ${formatBytes(actualSize)}`)
      if (config.compress) {
        const compressionRatio = ((fileStats.size - actualSize) / fileStats.size * 100).toFixed(1)
        console.warn(`   Compression: ${compressionRatio}% reduction`)
      }
    }

    return {
      name: config.name,
      type: 'file',
      filename,
      size: actualSize,
      duration,
      success: true,
      fileCount: 1,
    }
  }
  catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (config.verbose) {
      console.warn(`❌ File backup failed: ${errorMessage}`)
    }

    return {
      name: config.name,
      type: 'file',
      filename: '',
      size: 0,
      duration,
      success: false,
      error: errorMessage,
      fileCount: 0,
    }
  }
}

async function compressFile(sourcePath: string, outputPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const readStream = createReadStream(sourcePath)
    const writeStream = createWriteStream(outputPath)
    const gzipStream = createGzip()

    let totalSize = 0

    gzipStream.on('data', (chunk) => {
      totalSize += chunk.length
    })

    readStream.pipe(gzipStream).pipe(writeStream)

    writeStream.on('error', reject)
    gzipStream.on('error', reject)
    readStream.on('error', reject)

    writeStream.on('close', () => {
      resolve(totalSize)
    })
  })
}

async function preserveFileMetadata(sourcePath: string, outputPath: string, sourceStats: any): Promise<void> {
  try {
    // Note: In a real implementation, you might want to store metadata in a separate file
    // since compressed files might not preserve all original metadata
    const metadataPath = `${outputPath}.meta`
    const metadata = {
      originalPath: sourcePath,
      mtime: sourceStats.mtime.getTime(),
      atime: sourceStats.atime.getTime(),
      mode: sourceStats.mode,
      uid: sourceStats.uid,
      gid: sourceStats.gid,
      size: sourceStats.size,
    }

    await writeFile(metadataPath, JSON.stringify(metadata, null, 2))
  }
  catch {
    // Ignore metadata preservation errors
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}
