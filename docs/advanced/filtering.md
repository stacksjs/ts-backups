# Custom Filtering

This guide covers advanced filtering strategies for backupx, including custom glob patterns, dynamic filtering, and content-based exclusions.

## File Filtering Patterns

### Basic Glob Patterns

```ts
interface FilterConfig {
  include?: string[]
  exclude?: string[]
  caseSensitive?: boolean
  followSymlinks?: boolean
}

// Common filtering patterns
const commonPatterns = {
  // Development files
  development: [
    'node_modules/**',
    '_.log',
    '_.tmp',
    '.git/**',
    'dist/**',
    'build/**',
    'coverage/**',
  ],

  // Source code only
  sourceCode: [
    '**/*.ts',
    '**/*.js',
    '**/*.json',
    '**/*.md',
    '**/*.yml',
    '**/*.yaml',
  ],

  // Media files
  media: [
    '**/*.jpg',
    '**/*.jpeg',
    '**/*.png',
    '**/*.gif',
    '**/*.mp4',
    '**/*.mp3',
  ],

  // Documents
  documents: [
    '**/*.pdf',
    '**/*.doc',
    '**/*.docx',
    '**/*.xls',
    '**/*.xlsx',
    '**/*.ppt',
    '**/_.pptx',
  ],
}

const config: FileConfig = {
  name: 'source-files',
  path: './project',
  include: commonPatterns.sourceCode,
  exclude: commonPatterns.development,
}
```

### Advanced Pattern Matching

```ts
class AdvancedFilter {
  private includePatterns: RegExp[] = []
  private excludePatterns: RegExp[] = []

  constructor(config: FilterConfig) {
    this.compilePatterns(config)
  }

  private compilePatterns(config: FilterConfig): void {
    // Compile include patterns
    if (config.include) {
      this.includePatterns = config.include.map(pattern =>
        this.globToRegex(pattern, config.caseSensitive)
      )
    }

    // Compile exclude patterns
    if (config.exclude) {
      this.excludePatterns = config.exclude.map(pattern =>
        this.globToRegex(pattern, config.caseSensitive)
      )
    }
  }

  private globToRegex(pattern: string, caseSensitive = true): RegExp {
    // Convert glob pattern to regex
    let regexPattern = pattern
      .replace(/\./g, '\\.') // Escape dots
      .replace(/\_\_/g, '§DOUBLESTAR§') // Temporary placeholder
      .replace(/\_/g, '[^/]_') // Single _ matches anything except /
      .replace(/§DOUBLESTAR§/g, '.*') // ** matches anything including /
      .replace(/\?/g, '[^/]') // ? matches single character except /
      .replace(/\//g, '[\\/\\\\]') // Handle both / and \ path separators

    // Add anchors
    regexPattern = `^${regexPattern}$`

    const flags = caseSensitive ? 'g' : 'gi'
    return new RegExp(regexPattern, flags)
  }

  shouldInclude(filePath: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/')

    // If include patterns exist, file must match at least one
    if (this.includePatterns.length > 0) {
      const included = this.includePatterns.some(pattern =>
        pattern.test(normalizedPath)
      )
      if (!included)
        return false
    }

    // File must not match any exclude pattern
    const excluded = this.excludePatterns.some(pattern =>
      pattern.test(normalizedPath)
    )

    return !excluded
  }

  // Test multiple patterns efficiently
  filterPaths(paths: string[]): string[] {
    return paths.filter(path => this.shouldInclude(path))
  }
}

// Usage
const filter = new AdvancedFilter({
  include: ['src/**/*.ts', 'docs/**/*.md'],
  exclude: ['**/*.test.ts', '**/node_modules/**'],
  caseSensitive: false,
})

const filteredFiles = filter.filterPaths([
  'src/index.ts',
  'src/utils.test.ts', // Excluded
  'docs/README.md',
  'node_modules/lib/index.js', // Excluded
])
```

## Dynamic Filtering

### Content-Based Filtering

```ts
import { readFile, stat } from 'node:fs/promises'

interface ContentFilter {
  maxSize?: number
  minSize?: number
  contentPatterns?: {
    include?: RegExp[]
    exclude?: RegExp[]
  }
  mimeTypes?: {
    include?: string[]
    exclude?: string[]
  }
}

class ContentBasedFilter {
  constructor(private config: ContentFilter) {}

  async shouldIncludeFile(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath)

      // Size filtering
      if (this.config.maxSize && stats.size > this.config.maxSize) {
        return false
      }

      if (this.config.minSize && stats.size < this.config.minSize) {
        return false
      }

      // MIME type filtering (basic implementation)
      if (this.config.mimeTypes) {
        const mimeType = this.guessMimeType(filePath)

        if (this.config.mimeTypes.exclude?.includes(mimeType)) {
          return false
        }

        if (this.config.mimeTypes.include
          && !this.config.mimeTypes.include.includes(mimeType)) {
          return false
        }
      }

      // Content pattern filtering (for text files)
      if (this.config.contentPatterns && this.isTextFile(filePath)) {
        const content = await readFile(filePath, 'utf-8')

        // Must match include patterns if specified
        if (this.config.contentPatterns.include) {
          const matches = this.config.contentPatterns.include.some(pattern =>
            pattern.test(content)
          )
          if (!matches)
            return false
        }

        // Must not match exclude patterns
        if (this.config.contentPatterns.exclude) {
          const matches = this.config.contentPatterns.exclude.some(pattern =>
            pattern.test(content)
          )
          if (matches)
            return false
        }
      }

      return true
    }
    catch (error) {
      // If we can't read the file, exclude it
      return false
    }
  }

  private guessMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || ''

    const mimeMap: Record<string, string> = {
      js: 'text/javascript',
      ts: 'text/typescript',
      json: 'application/json',
      md: 'text/markdown',
      txt: 'text/plain',
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
    }

    return mimeMap[ext] || 'application/octet-stream'
  }

  private isTextFile(filePath: string): boolean {
    const textExtensions = [
      'txt',
      'md',
      'js',
      'ts',
      'json',
      'xml',
      'html',
      'css',
      'sql',
      'py',
      'java',
      'c',
      'cpp',
      'h',
      'yml',
      'yaml',
    ]

    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    return textExtensions.includes(ext)
  }
}

// Example: Filter large images and files with secrets
const contentFilter = new ContentBasedFilter({
  maxSize: 10 _ 1024 _ 1024, // 10MB max
  mimeTypes: {
    exclude: ['image/jpeg', 'image/png'], // No images
  },
  contentPatterns: {
    exclude: [
      /password\s_=\s_["']._["']/i,
      /api[_-]?key\s_=\s_["']._["']/i,
      /secret\s_=\s_["']._["']/i,
    ],
  },
})
```

### Time-Based Filtering

```ts
interface TimeFilter {
  modifiedAfter?: Date
  modifiedBefore?: Date
  createdAfter?: Date
  createdBefore?: Date
  accessedAfter?: Date
  accessedBefore?: Date
}

class TimeBasedFilter {
  constructor(private config: TimeFilter) {}

  async shouldIncludeFile(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath)

      // Modified time checks
      if (this.config.modifiedAfter && stats.mtime < this.config.modifiedAfter) {
        return false
      }

      if (this.config.modifiedBefore && stats.mtime > this.config.modifiedBefore) {
        return false
      }

      // Birth time checks (creation time)
      if (this.config.createdAfter && stats.birthtime < this.config.createdAfter) {
        return false
      }

      if (this.config.createdBefore && stats.birthtime > this.config.createdBefore) {
        return false
      }

      // Access time checks
      if (this.config.accessedAfter && stats.atime < this.config.accessedAfter) {
        return false
      }

      if (this.config.accessedBefore && stats.atime > this.config.accessedBefore) {
        return false
      }

      return true
    }
    catch (error) {
      return false
    }
  }
}

// Example: Only files modified in the last week
const recentFilter = new TimeBasedFilter({
  modifiedAfter: new Date(Date.now() - 7 _ 24 _ 60 _ 60 * 1000),
})
```

## Composite Filtering

### Combining Multiple Filters

```ts
interface CompositeFilterConfig {
  pathFilter?: FilterConfig
  contentFilter?: ContentFilter
  timeFilter?: TimeFilter
  customFilters?: Array<(filePath: string) => Promise<boolean>>
}

class CompositeFilter {
  private pathFilter?: AdvancedFilter
  private contentFilter?: ContentBasedFilter
  private timeFilter?: TimeBasedFilter
  private customFilters: Array<(filePath: string) => Promise<boolean>> = []

  constructor(config: CompositeFilterConfig) {
    if (config.pathFilter) {
      this.pathFilter = new AdvancedFilter(config.pathFilter)
    }

    if (config.contentFilter) {
      this.contentFilter = new ContentBasedFilter(config.contentFilter)
    }

    if (config.timeFilter) {
      this.timeFilter = new TimeBasedFilter(config.timeFilter)
    }

    if (config.customFilters) {
      this.customFilters = config.customFilters
    }
  }

  async shouldIncludeFile(filePath: string): Promise<boolean> {
    // Path-based filtering (fastest, check first)
    if (this.pathFilter && !this.pathFilter.shouldInclude(filePath)) {
      return false
    }

    // Time-based filtering (fast, requires stat)
    if (this.timeFilter && !(await this.timeFilter.shouldIncludeFile(filePath))) {
      return false
    }

    // Content-based filtering (slower, requires file read)
    if (this.contentFilter && !(await this.contentFilter.shouldIncludeFile(filePath))) {
      return false
    }

    // Custom filters
    for (const customFilter of this.customFilters) {
      if (!(await customFilter(filePath))) {
        return false
      }
    }

    return true
  }

  async filterFiles(filePaths: string[]): Promise<string[]> {
    const results = await Promise.allSettled(
      filePaths.map(async (path) => {
        const include = await this.shouldIncludeFile(path)
        return include ? path : null
      }),
    )

    return results
      .filter((result): result is PromiseFulfilledResult<string> =>
        result.status === 'fulfilled' && result.value !== null
      )
      .map(result => result.value)
  }
}

// Example: Comprehensive filtering for source code backup
const sourceCodeFilter = new CompositeFilter({
  pathFilter: {
    include: [
      'src/**/*.ts',
      'src/**/_.js',
      '_.md',
      'package.json',
      'tsconfig.json',
    ],
    exclude: [
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/node_modules/**',
      'dist/**',
      'build/**',
    ],
  },

  contentFilter: {
    maxSize: 1024 _ 1024, // 1MB max per file
    contentPatterns: {
      exclude: [
        /console\.log\(/g, // Exclude files with console.log
        /debugger;/g, // Exclude files with debugger statements
      ],
    },
  },

  timeFilter: {
    modifiedAfter: new Date(Date.now() - 30 _ 24 _ 60 _ 60 * 1000), // Last 30 days
  },

  customFilters: [
    // Custom filter: exclude empty files
    async (filePath: string) => {
      try {
        const stats = await stat(filePath)
        return stats.size > 0
      }
      catch {
        return false
      }
    },

    // Custom filter: only TypeScript files with exports
    async (filePath: string) => {
      if (!filePath.endsWith('.ts'))
        return true

      try {
        const content = await readFile(filePath, 'utf-8')
        return /^export /m.test(content) // Has export statements
      }
      catch {
        return false
      }
    },
  ],
})
```

## Database Filtering

### Table and Schema Filtering

```ts
interface DatabaseFilter {
  includeTables?: string[]
  excludeTables?: string[]
  includeSchemas?: string[]
  excludeSchemas?: string[]
  tablePatterns?: {
    include?: RegExp[]
    exclude?: RegExp[]
  }
}

class DatabaseTableFilter {
  constructor(private config: DatabaseFilter) {}

  shouldIncludeTable(tableName: string, schemaName?: string): boolean {
    // Schema filtering
    if (schemaName) {
      if (this.config.includeSchemas
        && !this.config.includeSchemas.includes(schemaName)) {
        return false
      }

      if (this.config.excludeSchemas?.includes(schemaName)) {
        return false
      }
    }

    // Explicit table lists
    if (this.config.includeTables
      && !this.config.includeTables.includes(tableName)) {
      return false
    }

    if (this.config.excludeTables?.includes(tableName)) {
      return false
    }

    // Pattern matching
    if (this.config.tablePatterns?.include) {
      const matches = this.config.tablePatterns.include.some(pattern =>
        pattern.test(tableName)
      )
      if (!matches)
        return false
    }

    if (this.config.tablePatterns?.exclude) {
      const matches = this.config.tablePatterns.exclude.some(pattern =>
        pattern.test(tableName)
      )
      if (matches)
        return false
    }

    return true
  }

  filterTables(tables: Array<{ name: string, schema?: string }>): string[] {
    return tables
      .filter(table => this.shouldIncludeTable(table.name, table.schema))
      .map(table => table.name)
  }
}

// Example: Skip temporary and log tables
const dbFilter = new DatabaseTableFilter({
  excludeTables: ['sessions', 'cache', 'logs'],
  tablePatterns: {
    exclude: [
      /^temp_/i, // Tables starting with "temp_"
      /_backup$/i, // Tables ending with "_backup"
      /^_/, // Tables starting with underscore
    ],
  },
})

// Usage in database config
const dbConfig: PostgreSQLConfig = {
  type: BackupType.POSTGRESQL,
  name: 'main-db',
  connection: 'postgres://user:pass@localhost/db',
  // Apply filtering
  tables: dbFilter.filterTables([
    { name: 'users' },
    { name: 'orders' },
    { name: 'temp_processing' }, // Will be excluded
    { name: 'logs' }, // Will be excluded
  ]),
}
```

This guide provides comprehensive filtering strategies for creating precise, efficient backup operations that only include the data you actually need.
