# Error Handling

This guide covers comprehensive error handling strategies for backupx, including custom error types, recovery mechanisms, and debugging techniques.

## Error Types & Classification

### Built-in Error Codes

```ts
enum BackupErrorCode {
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  INVALID_PATH = 'INVALID_PATH',

  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DISK_FULL = 'DISK_FULL',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  QUERY_FAILED = 'QUERY_FAILED',
  SCHEMA_ERROR = 'SCHEMA_ERROR',
}

class BackupError extends Error {
  constructor(
    public readonly code: BackupErrorCode,
    message: string,
    public readonly details: Record<string, any> = {},
    public readonly recoverable = false,
  ) {
    super(message)
    this.name = 'BackupError'
  }
}
```

### Error Classification

```ts
class ErrorClassifier {
  static classifyError(error: Error): {
    category: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    recoverable: boolean
    retryable: boolean
  } {
    // File system errors
    if (error.message.includes('ENOENT') || error.message.includes('no such file')) {
      return {
        category: 'filesystem',
        severity: 'medium',
        recoverable: false,
        retryable: false,
      }
    }

    // Permission errors
    if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
      return {
        category: 'permissions',
        severity: 'high',
        recoverable: false,
        retryable: false,
      }
    }

    // Network/connection errors
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
      return {
        category: 'network',
        severity: 'medium',
        recoverable: true,
        retryable: true,
      }
    }

    // Memory errors
    if (error.message.includes('out of memory') || error.message.includes('heap')) {
      return {
        category: 'memory',
        severity: 'critical',
        recoverable: true,
        retryable: false,
      }
    }

    // Disk space errors
    if (error.message.includes('ENOSPC') || error.message.includes('no space')) {
      return {
        category: 'storage',
        severity: 'critical',
        recoverable: false,
        retryable: false,
      }
    }

    // Default classification
    return {
      category: 'unknown',
      severity: 'medium',
      recoverable: false,
      retryable: true,
    }
  }
}
```

## Retry Mechanisms

### Exponential Backoff

```ts
class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
    baseDelay = 1000,
  ): Promise<T> {
    let attempt = 1

    while (attempt <= maxAttempts) {
      try {
        return await operation()
      }
      catch (error) {
        if (attempt === maxAttempts)
          throw error

        const delay = baseDelay * (2 ** (attempt - 1))
        await new Promise(resolve => setTimeout(resolve, delay))
        attempt++
      }
    }

    throw new Error('Max attempts reached')
  }
}
```

### Circuit Breaker Pattern

```ts
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private lastFailureTime = 0
  private successCount = 0

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly monitoringPeriod: number = 10000, // 10 seconds
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = CircuitState.HALF_OPEN
        this.successCount = 0
      }
      else {
        throw new BackupError(
          BackupErrorCode.CONNECTION_FAILED,
          'Circuit breaker is OPEN',
          { state: this.state, failureCount: this.failureCount },
        )
      }
    }

    try {
      const result = await operation()
      this.onSuccess()
      return result
    }
    catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = CircuitState.CLOSED
      }
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN
    }
    else if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN
    }
  }

  getState(): CircuitState {
    return this.state
  }
}
```

## Resilient Backup Manager

### Comprehensive Error Handling

```ts
class ResilientBackupManager extends BackupManager {
  private readonly retryManager = new RetryManager()
  private readonly circuitBreakers = new Map<string, CircuitBreaker>()
  private readonly errorLog: BackupError[] = []

  async createBackup(): Promise<BackupSummary> {
    const startTime = Date.now()
    const results: BackupResult[] = []

    try {
      // Process databases with error handling
      for (const dbConfig of this.config.databases) {
        try {
          const result = await this.backupDatabaseWithResilience(dbConfig)
          results.push(result)
        }
        catch (error) {
          const backupError = this.wrapError(error, dbConfig.name)
          this.logError(backupError)

          results.push({
            name: dbConfig.name,
            type: dbConfig.type,
            filename: '',
            size: 0,
            duration: 0,
            success: false,
            error: backupError.message,
          })
        }
      }

      // Process files with error handling
      for (const fileConfig of this.config.files) {
        try {
          const result = await this.backupFileWithResilience(fileConfig)
          results.push(result)
        }
        catch (error) {
          const backupError = this.wrapError(error, fileConfig.name)
          this.logError(backupError)

          results.push({
            name: fileConfig.name,
            type: BackupType.FILE,
            filename: '',
            size: 0,
            duration: 0,
            success: false,
            error: backupError.message,
          })
        }
      }

      // Clean up old backups with error handling
      if (this.config.retention) {
        try {
          await this.cleanupWithErrorHandling()
        }
        catch (error) {
          console.warn('⚠️ Cleanup failed:', error instanceof Error ? error.message : String(error))
        }
      }

      const duration = Date.now() - startTime
      return this.createSummaryWithErrorAnalysis(results, duration)
    }
    catch (error) {
      const wrappedError = this.wrapError(error, 'backup-process')
      this.logError(wrappedError)
      throw wrappedError
    }
  }

  private async backupDatabaseWithResilience(config: DatabaseConfig): Promise<BackupResult> {
    const circuitBreaker = this.getCircuitBreaker(`db-${config.name}`)

    return this.retryManager.executeWithRetry(
      () => circuitBreaker.execute(() => this.backupDatabase(config)),
      {
        maxAttempts: config.type === BackupType.SQLITE ? 2 : 3,
        baseDelay: 2000,
        maxDelay: 15000,
      },
    )
  }

  private async backupFileWithResilience(config: FileConfig): Promise<BackupResult> {
    return this.retryManager.executeWithRetry(
      () => this.backupFile(config),
      {
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 10000,
      },
    )
  }

  private getCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker(3, 30000, 5000))
    }
    return this.circuitBreakers.get(key)!
  }

  private wrapError(error: unknown, context: string): BackupError {
    if (error instanceof BackupError) {
      return error
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    const classification = ErrorClassifier.classifyError(error as Error)

    // Map common error patterns to specific codes
    let code = BackupErrorCode.UNKNOWN_ERROR

    if (errorMessage.includes('ENOENT')) {
      code = BackupErrorCode.FILE_NOT_FOUND
    }
    else if (errorMessage.includes('EACCES')) {
      code = BackupErrorCode.PERMISSION_DENIED
    }
    else if (errorMessage.includes('ENOSPC')) {
      code = BackupErrorCode.DISK_FULL
    }
    else if (errorMessage.includes('connection')) {
      code = BackupErrorCode.CONNECTION_FAILED
    }

    return new BackupError(
      code,
      errorMessage,
      {
        context,
        originalError: error instanceof Error ? error.stack : String(error),
        classification,
      },
      classification.recoverable,
    )
  }

  private logError(error: BackupError): void {
    this.errorLog.push(error)

    // Keep only last 100 errors
    if (this.errorLog.length > 100) {
      this.errorLog.shift()
    }

    // Log to console with appropriate level
    const classification = ErrorClassifier.classifyError(error)

    switch (classification.severity) {
      case 'critical':
        console.error('🚨 CRITICAL:', error.message, error.details)
        break
      case 'high':
        console.error('❌ ERROR:', error.message)
        break
      case 'medium':
        console.warn('⚠️ WARNING:', error.message)
        break
      default:
        console.info('ℹ️ INFO:', error.message)
    }
  }

  private createSummaryWithErrorAnalysis(
    results: BackupResult[],
    duration: number,
  ): BackupSummary {
    const summary = {
      startTime: new Date(Date.now() - duration),
      endTime: new Date(),
      duration,
      results,
      successCount: results.filter(r => r.success).length,
      failureCount: results.filter(r => !r.success).length,
      totalSize: results.reduce((sum, r) => sum + (r.success ? r.size : 0), 0),
      errors: this.errorLog.slice(-10), // Include last 10 errors in summary
    }

    // Log summary with error analysis
    if (this.config.verbose) {
      this.logSummaryWithErrors(summary)
    }

    return summary
  }

  private logSummaryWithErrors(summary: any): void {
    console.warn('\n📊 Backup Summary:')
    console.warn(`   Duration: ${summary.duration}ms`)
    console.warn(`   Success: ${summary.successCount}`)
    console.warn(`   Failures: ${summary.failureCount}`)
    console.warn(`   Total Size: ${this.formatBytes(summary.totalSize)}`)

    if (summary.failureCount > 0) {
      console.warn('\n❌ Failures:')
      summary.errors.forEach((error: BackupError) => {
        console.warn(`   ${error.code}: ${error.message}`)
      })
    }

    // Circuit breaker status
    console.warn('\n🔌 Circuit Breaker Status:')
    this.circuitBreakers.forEach((cb, key) => {
      console.warn(`   ${key}: ${cb.getState()}`)
    })
  }

  getErrorReport(): any {
    const errorsByCode = new Map<string, number>()
    const errorsByCategory = new Map<string, number>()

    this.errorLog.forEach((error) => {
      // Count by error code
      errorsByCode.set(error.code, (errorsByCode.get(error.code) || 0) + 1)

      // Count by category
      const classification = ErrorClassifier.classifyError(error)
      errorsByCategory.set(
        classification.category,
        (errorsByCategory.get(classification.category) || 0) + 1,
      )
    })

    return {
      totalErrors: this.errorLog.length,
      errorsByCode: Object.fromEntries(errorsByCode),
      errorsByCategory: Object.fromEntries(errorsByCategory),
      recentErrors: this.errorLog.slice(-5).map(e => e.toJSON()),
      circuitBreakerStatus: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([key, cb]) => [key, cb.getState()]),
      ),
    }
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

## Debugging and Diagnostics

### Debug Mode Configuration

```ts
interface DebugConfig {
  enabled: boolean
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace'
  outputFile?: string
  includeStackTrace: boolean
  captureEnvironment: boolean
}

class DebugBackupManager extends ResilientBackupManager {
  private debugConfig: DebugConfig
  private debugLog: any[] = []

  constructor(config: BackupConfig, debugConfig: Partial<DebugConfig> = {}) {
    super(config)
    this.debugConfig = {
      enabled: false,
      level: 'info',
      includeStackTrace: true,
      captureEnvironment: false,
      ...debugConfig,
    }
  }

  async createBackup(): Promise<BackupSummary> {
    if (this.debugConfig.enabled) {
      this.debug('Starting backup process', {
        config: this.sanitizeConfig(this.config),
        environment: this.debugConfig.captureEnvironment ? this.captureEnvironment() : undefined,
      })
    }

    try {
      const summary = await super.createBackup()

      if (this.debugConfig.enabled) {
        this.debug('Backup completed', { summary })
        await this.saveDebugLog()
      }

      return summary
    }
    catch (error) {
      if (this.debugConfig.enabled) {
        this.debug('Backup failed', { error: this.serializeError(error) })
        await this.saveDebugLog()
      }
      throw error
    }
  }

  private debug(message: string, data?: any): void {
    if (!this.debugConfig.enabled)
      return

    const entry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      data,
      stack: this.debugConfig.includeStackTrace ? new Error('Stack trace').stack : undefined,
    }

    this.debugLog.push(entry)
    console.debug(`[DEBUG] ${message}`, data)
  }

  private sanitizeConfig(config: any): any {
    // Remove sensitive information from config
    const sanitized = JSON.parse(JSON.stringify(config))

    sanitized.databases?.forEach((db: any) => {
      if (typeof db.connection === 'string') {
        // Hide password in connection string
        db.connection = db.connection.replace(/:([^:@]+)@/, ':***@')
      }
      else if (typeof db.connection === 'object') {
        if (db.connection.password) {
          db.connection.password = '***'
        }
      }
    })

    return sanitized
  }

  private captureEnvironment(): any {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      cwd: process.cwd(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        // Add other non-sensitive env vars as needed
      },
    }
  }

  private serializeError(error: unknown): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as any), // Include any additional properties
      }
    }
    return { value: String(error) }
  }

  private async saveDebugLog(): Promise<void> {
    if (!this.debugConfig.outputFile)
      return

    try {
      const fs = await import('node:fs/promises')
      const content = JSON.stringify(this.debugLog, null, 2)
      await fs.writeFile(this.debugConfig.outputFile, content)
    }
    catch (error) {
      console.error('Failed to save debug log:', error)
    }
  }

  getDebugInfo(): any {
    return {
      config: this.debugConfig,
      logEntries: this.debugLog.length,
      lastEntries: this.debugLog.slice(-10),
      errorReport: this.getErrorReport(),
    }
  }
}
```

### Health Check System

```ts
interface HealthCheck {
  name: string
  status: 'healthy' | 'warning' | 'unhealthy'
  message: string
  details?: any
  lastChecked: Date
}

class BackupHealthMonitor {
  private checks: HealthCheck[] = []

  async performHealthChecks(config: BackupConfig): Promise<HealthCheck[]> {
    this.checks = []

    // Check output directory
    await this.checkOutputDirectory(config.outputPath)

    // Check database connections
    for (const dbConfig of config.databases) {
      await this.checkDatabaseConnection(dbConfig)
    }

    // Check file paths
    for (const fileConfig of config.files) {
      await this.checkFilePath(fileConfig)
    }

    // Check system resources
    await this.checkSystemResources()

    return this.checks
  }

  private async checkOutputDirectory(outputPath?: string): Promise<void> {
    try {
      const path = outputPath || './backups'
      const fs = await import('node:fs/promises')

      await fs.access(path)
      const stats = await fs.stat(path)

      if (!stats.isDirectory()) {
        this.addCheck({
          name: 'output-directory',
          status: 'unhealthy',
          message: 'Output path is not a directory',
          details: { path },
        })
        return
      }

      // Check write permissions
      const testFile = `${path}/.write-test-${Date.now()}`
      await fs.writeFile(testFile, 'test')
      await fs.unlink(testFile)

      this.addCheck({
        name: 'output-directory',
        status: 'healthy',
        message: 'Output directory is writable',
        details: { path },
      })
    }
    catch (error) {
      this.addCheck({
        name: 'output-directory',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: { outputPath },
      })
    }
  }

  private async checkDatabaseConnection(config: DatabaseConfig): Promise<void> {
    try {
      // This would implement actual connection testing
      // For now, just check configuration

      if (config.type === BackupType.SQLITE) {
        const fs = await import('node:fs/promises')
        await fs.access((config as any).path)
      }

      this.addCheck({
        name: `database-${config.name}`,
        status: 'healthy',
        message: 'Database connection valid',
        details: { type: config.type, name: config.name },
      })
    }
    catch (error) {
      this.addCheck({
        name: `database-${config.name}`,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Connection failed',
        details: { type: config.type, name: config.name },
      })
    }
  }

  private async checkFilePath(config: FileConfig): Promise<void> {
    try {
      const fs = await import('node:fs/promises')
      await fs.access(config.path)

      this.addCheck({
        name: `file-${config.name}`,
        status: 'healthy',
        message: 'File path accessible',
        details: { path: config.path },
      })
    }
    catch (error) {
      this.addCheck({
        name: `file-${config.name}`,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'File not accessible',
        details: { path: config.path },
      })
    }
  }

  private async checkSystemResources(): Promise<void> {
    const usage = process.memoryUsage()
    const memoryUsagePercent = (usage.heapUsed / usage.heapTotal) * 100

    let status: 'healthy' | 'warning' | 'unhealthy' = 'healthy'
    let message = 'System resources normal'

    if (memoryUsagePercent > 90) {
      status = 'unhealthy'
      message = 'Critical memory usage'
    }
    else if (memoryUsagePercent > 80) {
      status = 'warning'
      message = 'High memory usage'
    }

    this.addCheck({
      name: 'system-resources',
      status,
      message,
      details: {
        memory: usage,
        memoryUsagePercent: memoryUsagePercent.toFixed(1),
      },
    })
  }

  private addCheck(check: Omit<HealthCheck, 'lastChecked'>): void {
    this.checks.push({
      ...check,
      lastChecked: new Date(),
    })
  }

  getOverallHealth(): 'healthy' | 'warning' | 'unhealthy' {
    if (this.checks.some(c => c.status === 'unhealthy')) {
      return 'unhealthy'
    }
    if (this.checks.some(c => c.status === 'warning')) {
      return 'warning'
    }
    return 'healthy'
  }
}
```

This comprehensive error handling guide provides robust strategies for dealing with failures, implementing retry mechanisms, and maintaining system health in backup operations.
