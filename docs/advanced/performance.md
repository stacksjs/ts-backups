# Performance Tuning

This guide covers performance optimization strategies for backupx, including memory management, parallel processing, and bottleneck identification.

## Understanding Performance Characteristics

### Backup Operation Costs

```ts
interface PerformanceProfile {
  operation: 'read' | 'compress' | 'write' | 'network'
  cpuIntensive: boolean
  memoryIntensive: boolean
  ioIntensive: boolean
  networkBound: boolean
  scalability: 'linear' | 'logarithmic' | 'constant'
}

const operationProfiles: Record<string, PerformanceProfile> = {
  sqliteBackup: {
    operation: 'read',
    cpuIntensive: false,
    memoryIntensive: false,
    ioIntensive: true,
    networkBound: false,
    scalability: 'linear',
  },
  postgresBackup: {
    operation: 'read',
    cpuIntensive: false,
    memoryIntensive: true,
    ioIntensive: false,
    networkBound: true,
    scalability: 'linear',
  },
  fileCompression: {
    operation: 'compress',
    cpuIntensive: true,
    memoryIntensive: true,
    ioIntensive: true,
    networkBound: false,
    scalability: 'linear',
  },
  directoryScanning: {
    operation: 'read',
    cpuIntensive: false,
    memoryIntensive: false,
    ioIntensive: true,
    networkBound: false,
    scalability: 'logarithmic',
  },
}
```

## Memory Optimization

### Streaming vs Buffering

```ts
import type { BackupConfig } from 'backupx'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { createGzip } from 'node:zlib'

class MemoryOptimizedBackupManager extends BackupManager {
  private readonly CHUNK_SIZE = 64 _ 1024 // 64KB chunks
  private readonly MAX_MEMORY_USAGE = 100 _ 1024 _ 1024 // 100MB limit

  async backupLargeFile(filePath: string, outputPath: string): Promise<void> {
    // Use streaming to avoid loading entire file into memory
    const readStream = createReadStream(filePath, {
      highWaterMark: this.CHUNK_SIZE,
    })

    const gzipStream = createGzip({
      level: 6, // Balance between compression and speed
      chunkSize: this.CHUNK_SIZE,
    })

    const writeStream = createWriteStream(outputPath, {
      highWaterMark: this.CHUNK_SIZE,
    })

    // Pipeline automatically handles backpressure
    await pipeline(readStream, gzipStream, writeStream)
  }

  async backupLargeDirectory(config: FileConfig): Promise<void> {
    const files = await this.getFilesToBackup(config)

    // Process files in batches to control memory usage
    const batchSize = this.calculateOptimalBatchSize(files)

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)
      await this.processBatch(batch)

      // Force garbage collection between batches
      if (globalThis.gc) {
        globalThis.gc()
      }
    }
  }

  private calculateOptimalBatchSize(files: string[]): number {
    const averageFileSize = this.estimateAverageFileSize(files)
    const maxFilesInMemory = Math.floor(this.MAX_MEMORY_USAGE / averageFileSize)
    return Math.max(1, Math.min(maxFilesInMemory, 50)) // Min 1, max 50 files
  }

  private estimateAverageFileSize(files: string[]): number {
    // Sample first 10 files to estimate average size
    // Implementation would stat() first few files
    return 1024 _ 1024 // 1MB default estimate
  }
}
```

### Memory Monitoring

```ts
import { EventEmitter } from 'node:events'

class MemoryMonitor extends EventEmitter {
  private readonly WARNING_THRESHOLD = 0.8 // 80% of heap limit
  private readonly CRITICAL_THRESHOLD = 0.9 // 90% of heap limit
  private monitoringInterval?: NodeJS.Timeout

  startMonitoring(intervalMs = 5000): void {
    this.monitoringInterval = setInterval(() => {
      const usage = this.getMemoryUsage()
      this.checkThresholds(usage)
    }, intervalMs)
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }
  }

  private getMemoryUsage() {
    const usage = process.memoryUsage()
    const heapLimit = this.getHeapLimit()

    return {
      used: usage.heapUsed,
      total: usage.heapTotal,
      limit: heapLimit,
      utilization: usage.heapUsed / heapLimit,
      external: usage.external,
      rss: usage.rss,
    }
  }

  private getHeapLimit(): number {
    // Get V8 heap limit
    const v8 = require('node:v8')
    const stats = v8.getHeapStatistics()
    return stats.heap_size_limit
  }

  private checkThresholds(usage: any): void {
    if (usage.utilization > this.CRITICAL_THRESHOLD) {
      this.emit('memory:critical', usage)
    }
    else if (usage.utilization > this.WARNING_THRESHOLD) {
      this.emit('memory:warning', usage)
    }
  }
}

// Usage with backup manager
const memoryMonitor = new MemoryMonitor()

memoryMonitor.on('memory:warning', (usage) => {
  console.warn(`⚠️ High memory usage: ${(usage.utilization _ 100).toFixed(1)}%`)
  // Trigger garbage collection
  if (globalThis.gc) {
    globalThis.gc()
  }
})

memoryMonitor.on('memory:critical', (usage) => {
  console.error(`🚨 Critical memory usage: ${(usage.utilization _ 100).toFixed(1)}%`)
  // Consider pausing backup operations
})

memoryMonitor.startMonitoring()
```

## Parallel Processing

### Concurrent Database Backups

```ts
import type { BackupResult, DatabaseConfig } from 'backupx'

class ParallelBackupManager extends BackupManager {
  private readonly MAX_CONCURRENT_DATABASES = 3
  private readonly MAX_CONCURRENT_FILES = 5

  async createBackup(): Promise<BackupSummary> {
    const startTime = Date.now()

    // Separate database and file operations
    const { databases, files } = this.categorizeBackups()

    // Run database and file backups in parallel
    const [databaseResults, fileResults] = await Promise.all([
      this.runDatabaseBackupsInParallel(databases),
      this.runFileBackupsInParallel(files),
    ])

    const results = [...databaseResults, ...fileResults]
    const duration = Date.now() - startTime

    return this.createSummary(results, duration)
  }

  private async runDatabaseBackupsInParallel(
    configs: DatabaseConfig[],
  ): Promise<BackupResult[]> {
    // Use semaphore to limit concurrent database connections
    const semaphore = new Semaphore(this.MAX_CONCURRENT_DATABASES)

    return Promise.all(
      configs.map(async (config) => {
        await semaphore.acquire()
        try {
          return await this.backupDatabase(config)
        }
        finally {
          semaphore.release()
        }
      }),
    )
  }

  private async runFileBackupsInParallel(
    configs: FileConfig[],
  ): Promise<BackupResult[]> {
    // Group files by size for optimal scheduling
    const groups = this.groupFilesBySize(configs)
    const semaphore = new Semaphore(this.MAX_CONCURRENT_FILES)

    const allPromises = groups.map(group =>
      group.map(async (config) => {
        await semaphore.acquire()
        try {
          return await this.backupFile(config)
        }
        finally {
          semaphore.release()
        }
      }),
    ).flat()

    return Promise.all(allPromises)
  }

  private groupFilesBySize(configs: FileConfig[]): FileConfig[][] {
    // Sort by estimated size (large files first)
    const sorted = configs.sort((a, b) =>
      this.estimateFileSize(b) - this.estimateFileSize(a)
    )

    // Group to balance workload
    const groups: FileConfig[][] = [[], [], [], []]
    sorted.forEach((config, index) => {
      groups[index % groups.length].push(config)
    })

    return groups.filter(group => group.length > 0)
  }
}

class Semaphore {
  private permits: number
  private waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!
      resolve()
    }
    else {
      this.permits++
    }
  }
}
```

### Worker Threads for CPU-Intensive Tasks

```ts
import type { FileConfig } from 'backupx'
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads'

// Worker script (compression-worker.ts)
if (!isMainThread) {
  const { filePath, outputPath, options } = workerData

  async function compressFile() {
    try {
      const fs = await import('node:fs')
      const zlib = await import('node:zlib')
      const { pipeline } = await import('node:stream/promises')

      const readStream = fs.createReadStream(filePath)
      const gzipStream = zlib.createGzip(options)
      const writeStream = fs.createWriteStream(outputPath)

      await pipeline(readStream, gzipStream, writeStream)

      const stats = await fs.promises.stat(outputPath)
      parentPort?.postMessage({ success: true, size: stats.size })
    }
    catch (error) {
      parentPort?.postMessage({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  compressFile()
}

// Main thread usage
class WorkerPoolBackupManager extends BackupManager {
  private readonly workerPool = new WorkerPool(4) // 4 worker threads

  async compressFileWithWorker(
    filePath: string,
    outputPath: string,
  ): Promise<{ success: boolean, size?: number, error?: string }> {
    return this.workerPool.execute({
      filePath,
      outputPath,
      options: { level: 6 },
    })
  }
}

class WorkerPool {
  private workers: Worker[] = []
  private queue: Array<{
    data: any
    resolve: (value: any) => void
    reject: (error: any) => void
  }> = []

  private available: Worker[] = []

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      this.createWorker()
    }
  }

  private createWorker(): void {
    const worker = new Worker(__filename)

    worker.on('message', (result) => {
      this.available.push(worker)
      this.processQueue()
    })

    worker.on('error', (error) => {
      // Handle worker errors
      console.error('Worker error:', error)
    })

    this.workers.push(worker)
    this.available.push(worker)
  }

  async execute(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ data, resolve, reject })
      this.processQueue()
    })
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.available.length === 0) {
      return
    }

    const worker = this.available.pop()!
    const task = this.queue.shift()!

    worker.postMessage(task.data)

    const onMessage = (result: any) => {
      worker.off('message', onMessage)
      if (result.success) {
        task.resolve(result)
      }
      else {
        task.reject(new Error(result.error))
      }
      this.available.push(worker)
      this.processQueue()
    }

    worker.on('message', onMessage)
  }

  async terminate(): Promise<void> {
    await Promise.all(this.workers.map(worker => worker.terminate()))
  }
}
```

## I/O Optimization

### Disk I/O Patterns

```ts
interface IOStrategy {
  pattern: 'sequential' | 'random' | 'mixed'
  bufferSize: number
  syncWrites: boolean
  directIO: boolean
}

class IOOptimizedBackupManager extends BackupManager {
  private getOptimalIOStrategy(operation: string): IOStrategy {
    switch (operation) {
      case 'large-file-backup':
        return {
          pattern: 'sequential',
          bufferSize: 1024 _ 1024, // 1MB buffer
          syncWrites: false, // Use OS caching
          directIO: false,
        }

      case 'many-small-files':
        return {
          pattern: 'random',
          bufferSize: 64 _ 1024, // 64KB buffer
          syncWrites: true, // Ensure data persistence
          directIO: false,
        }

      case 'database-dump':
        return {
          pattern: 'sequential',
          bufferSize: 256 _ 1024, // 256KB buffer
          syncWrites: true, // Critical data
          directIO: false,
        }

      default:
        return {
          pattern: 'mixed',
          bufferSize: 128 _ 1024,
          syncWrites: false,
          directIO: false,
        }
    }
  }

  async optimizeFileOperations(config: FileConfig): Promise<void> {
    const strategy = this.getOptimalIOStrategy('large-file-backup')

    // Configure read stream with optimal buffer size
    const readOptions = {
      highWaterMark: strategy.bufferSize,
      // Add more platform-specific optimizations
    }

    // Implement strategy...
  }
}
```

### Network Optimization for Database Backups

```ts
class NetworkOptimizedBackupManager extends BackupManager {
  async optimizePostgreSQLConnection(config: PostgreSQLConfig): Promise<void> {
    // Connection pooling for multiple table backups
    const pool = new Pool({
      ...config.connection,
      max: 3, // Limit concurrent connections
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,

      // Performance optimizations
      statement_timeout: 0, // No statement timeout for dumps
      lock_timeout: 60000, // 1 minute lock timeout

      // Network optimizations
      tcp_keepalives_idle: 600,
      tcp_keepalives_interval: 30,
      tcp_keepalives_count: 3,
    })

    // Use COPY for faster data transfer
    const copyQuery = `
      COPY (SELECT _ FROM ${tableName})
      TO STDOUT
      WITH (FORMAT csv, HEADER true, DELIMITER ',')
    `
  }

  async batchTableBackup(tables: string[]): Promise<void> {
    // Process tables in parallel but limit concurrent connections
    const semaphore = new Semaphore(2)

    await Promise.all(
      tables.map(async (table) => {
        await semaphore.acquire()
        try {
          await this.backupTable(table)
        }
        finally {
          semaphore.release()
        }
      }),
    )
  }
}
```

## Performance Monitoring

### Real-time Performance Metrics

```ts
interface PerformanceMetrics {
  timestamp: number
  operation: string
  duration: number
  bytesProcessed: number
  throughput: number // bytes per second
  memoryUsage: number
  cpuUsage: number
  ioWait: number
}

class PerformanceTracker {
  private metrics: PerformanceMetrics[] = []
  private startTime = 0
  private startCPU: any = null

  startOperation(operation: string): void {
    this.startTime = performance.now()
    this.startCPU = process.cpuUsage()
  }

  endOperation(operation: string, bytesProcessed: number): PerformanceMetrics {
    const endTime = performance.now()
    const endCPU = process.cpuUsage(this.startCPU)
    const duration = endTime - this.startTime

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      operation,
      duration,
      bytesProcessed,
      throughput: bytesProcessed / (duration / 1000),
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: (endCPU.user + endCPU.system) / 1000000, // Convert to seconds
      ioWait: 0, // Would need OS-specific implementation
    }

    this.metrics.push(metrics)
    return metrics
  }

  getAverageMetrics(operation?: string): Partial<PerformanceMetrics> {
    const filtered = operation
      ? this.metrics.filter(m => m.operation === operation)
      : this.metrics

    if (filtered.length === 0)
      return {}

    return {
      duration: this.average(filtered, 'duration'),
      throughput: this.average(filtered, 'throughput'),
      memoryUsage: this.average(filtered, 'memoryUsage'),
      cpuUsage: this.average(filtered, 'cpuUsage'),
    }
  }

  private average(metrics: PerformanceMetrics[], key: keyof PerformanceMetrics): number {
    return metrics.reduce((sum, m) => sum + (m[key] as number), 0) / metrics.length
  }

  exportMetrics(): string {
    return JSON.stringify(this.metrics, null, 2)
  }
}

// Usage with backup manager
class MonitoredBackupManager extends BackupManager {
  private tracker = new PerformanceTracker()

  async createBackup(): Promise<BackupSummary> {
    this.tracker.startOperation('full-backup')

    try {
      const summary = await super.createBackup()

      const totalBytes = summary.results.reduce((sum, r) => sum + r.size, 0)
      const metrics = this.tracker.endOperation('full-backup', totalBytes)

      if (this.config.verbose) {
        console.warn(`📊 Performance metrics:`)
        console.warn(`   Duration: ${metrics.duration.toFixed(2)}ms`)
        console.warn(`   Throughput: ${this.formatThroughput(metrics.throughput)}`)
        console.warn(`   Memory: ${this.formatBytes(metrics.memoryUsage)}`)
      }

      return summary
    }
    catch (error) {
      this.tracker.endOperation('full-backup', 0)
      throw error
    }
  }

  private formatThroughput(bytesPerSecond: number): string {
    const mbps = bytesPerSecond / (1024 _ 1024)
    return `${mbps.toFixed(2)} MB/s`
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0)
      return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / 1024 ** i).toFixed(2)} ${sizes[i]}`
  }
}
```

## Bottleneck Identification

### Performance Profiling

```ts
class PerformanceProfiler {
  private profiles = new Map<string, number[]>()

  async profile<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()

    try {
      const result = await fn()
      const duration = performance.now() - start

      if (!this.profiles.has(name)) {
        this.profiles.set(name, [])
      }
      this.profiles.get(name)!.push(duration)

      return result
    }
    catch (error) {
      const duration = performance.now() - start
      this.profiles.get(name)?.push(duration)
      throw error
    }
  }

  getReport(): Record<string, any> {
    const report: Record<string, any> = {}

    for (const [name, durations] of this.profiles) {
      const sorted = durations.sort((a, b) => a - b)
      const sum = durations.reduce((a, b) => a + b, 0)

      report[name] = {
        count: durations.length,
        total: sum,
        average: sum / durations.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length _ 0.95)],
        p99: sorted[Math.floor(sorted.length _ 0.99)],
      }
    }

    return report
  }
}

// Usage in backup operations
const profiler = new PerformanceProfiler()

// Profile different operations
await profiler.profile('sqlite-backup', () => backupSQLite(config))
await profiler.profile('file-compression', () => compressFile(path))
await profiler.profile('directory-scan', () => scanDirectory(dir))

// Generate performance report
console.log(JSON.stringify(profiler.getReport(), null, 2))
```

This performance tuning guide provides comprehensive strategies for optimizing backupx operations, from memory management to parallel processing and bottleneck identification.
