## Code Style Guidelines

**Scope:**All files matching `**/*.{ts,tsx}`

**Purpose:** Code Style & Structure specifics

### Code Style

- Write concise, functional code with proper types

  ```ts
  // Good
  function mergeConfigs<T>(base: T, override: Partial<T>): T {
    return { ...base, ...override }
  }

  // Avoid
  class ConfigMerger {
    merge(base: any, override: any) {
      return Object.assign({}, base, override)
    }
  }
  ```

- Use Bun native modules when available

  ```ts
  // Good
  import { file } from 'bun'

  // Avoid
  import { readFile } from 'node:fs/promises'
  const config = await file('config.json').json()
  const config = JSON.parse(await readFile('config.json', 'utf-8'))
  ```

- Use descriptive variable names with proper prefixes

  ```ts
  // Good
  const isConfigValid = validateConfig(config)
  const hasCustomOptions = Boolean(options.custom)
  const shouldUseDefaults = !configExists || isConfigEmpty

  // Avoid
  const valid = check(cfg)
  const custom = !!options.custom
  const defaults = !exists || empty
  ```

- Write proper JSDoc comments for public APIs

  ```ts
  /**

   * Loads configuration from a file or remote endpoint
   * @param options - Configuration options
   * @param options.name - Name of the config file
   * @param options.cwd - Working directory (default: process.cwd())
   * @returns Resolved configuration object
   * @throws {ConfigError} When config loading fails
   * @example
   * ```ts
   * const config = await loadConfig({
   * name: 'myapp',
   * defaultConfig: { port: 3000 }
   * })
   * ```

   */
  async function loadConfig<T>(options: Config<T>): Promise<T>
  ```

- Use proper module organization

  ```ts
  export { ConfigError } from './errors'
  // config.ts
  export { loadConfig } from './loader'
  export type { Config, ConfigOptions } from './types'
  ```

- Follow consistent error handling patterns

  ```ts
  // Good
  const result = await loadConfig(options).catch((error) => {
    console.error('Config loading failed:', error)
    return options.defaultConfig
  })

  // Avoid
  try {
    const result = await loadConfig(options)
  }
  catch (e) {
    console.log('Error:', e)
  }
  ```

- Use proper type assertions

  ```ts
  // Good
  const config = result as Config
  if (!isValidConfig(config))
    throw new Error('Invalid config')

  // Avoid
  const config = result as any
  ```

## Documentation Guidelines

**Scope:**All files matching `**/*.{ts,tsx,md}`

**Purpose:** Documentation specific rules

### API Documentation

- Document all public APIs thoroughly
- Include TypeScript type information
- Provide clear function signatures
- Document config options and defaults
- Include return type information
- Document async behavior

### Configuration Examples

- Provide basic usage examples
- Include complex configuration examples
- Document all supported config formats
- Show browser usage examples
- Include TypeScript configuration examples
- Document config merging behavior

### Type Documentation

- Document generic type parameters
- Explain type constraints
- Document interface properties
- Include type union explanations
- Document type generation features
- Provide type utility examples

### Error Documentation

- Document common error scenarios
- Include error handling examples
- Document error recovery options
- Explain validation errors
- Document browser-specific errors
- Include troubleshooting guides

### Code Examples

- Include runnable code examples
- Provide TypeScript examples
- Show error handling patterns
- Include browser environment examples
- Document testing approaches
- Include CLI usage examples

### Best Practices

- Keep documentation up to date
- Use consistent formatting
- Include inline code comments
- Document breaking changes
- Maintain a changelog
- Include version information

### File Structure

- Maintain clear docs organization
- Use proper markdown formatting
- Include table of contents
- Organize by topic
- Keep related docs together
- Use proper headings

### Documentation Standards

- Use clear and concise language
- Include proper code blocks
- Document all parameters
- Provide return value descriptions
- Include usage notes
- Document dependencies
- Keep examples current

## Error Handling Guidelines

**Scope:**All files matching `**/*.{ts,tsx}`

**Purpose:** Error Handling and Validation specifics

### Error Handling

- Use early returns and guard clauses for validation

  ```ts
  function loadConfig<T>(options: Config<T>) {
    if (!options.name)
      throw new Error('Config name is required')

    if (!isObject(options.defaultConfig))
      throw new Error('Default config must be an object')

    // Continue with valid input
  }
  ```

- Implement proper error types

  ```ts
  class ConfigError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly details?: unknown
    ) {
      super(message)
      this.name = 'ConfigError'
    }
  }
  ```

- Use descriptive error messages

  ```ts
  throw new ConfigError(
    `Failed to load config file: ${filePath}`,
    'CONFIG*LOAD*ERROR',
    { cause: error }
  )
  ```

- Handle async errors properly

  ```ts
  async function loadConfigFile(path: string) {
    try {
      const content = await Bun.file(path).text()
      return JSON.parse(content)
    }
    catch (error) {
      if (error instanceof SyntaxError)
        throw new ConfigError('Invalid JSON in config file', 'PARSE*ERROR')
      throw new ConfigError('Failed to read config file', 'READ*ERROR')
    }
  }
  ```

- Implement proper error logging

  ```ts
  function handleError(error: unknown) {
    if (error instanceof ConfigError) {
      console.error(`[${error.code}] ${error.message}`)
      if (error.details)
        console.debug('Error details:', error.details)
    }
    else {
      console.error('Unexpected error:', error)
    }
  }
  ```

- Use error boundaries for unexpected errors

  ```ts
  try {
    await loadConfig(options)
  }
  catch (error) {
    handleError(error)
    return options.defaultConfig ?? {}
  }
  ```

- Ensure errors are typed when using Result types

  ```ts
  import { err, ok, Result } from 'neverthrow'

  function validateConfig(config: unknown): Result<Config, ConfigError> {
    if (!isValidConfig(config))
      return err(new ConfigError('Invalid config format', 'VALIDATION*ERROR'))
    return ok(config)
  }
  ```

## Key Conventions

**Scope:**All files matching `**/*.{ts,tsx}`

**Purpose:** Key Conventions specifics

### Conventions

- Prefer browser-compatible implementations when possible

  ```ts
  // Good - Browser compatible
  const config = await fetch('/api/config').then(r => r.json())

  // Avoid - Node.js specific
  const config = require('./config')
  ```

- Aim for comprehensive test coverage

  ```ts
  // Test both success and failure cases
  describe('loadConfig', () => {
    it('success case - load config', async () => {})
    it('failure case - handle errors', async () => {})
    it('edge case - malformed config', async () => {})
  })
  ```

- Use proper TypeScript types instead of `any`

  ```ts
  // Good
  function loadConfig<T extends Record<string, unknown>>(options: Config<T>): Promise<T>

  // Avoid
  function loadConfig(options: any): Promise<any>
  ```

- Use consistent error handling and logging

  ```ts
  // Good
  console.error('Failed to load config:', error)
  return options.defaultConfig

  // Avoid
  console.log('Error:', e)
  throw e
  ```

- Follow file naming conventions

  ```text
  config.ts           // Core functionality
  config.test.ts      // Test files
  config.types.ts     // Type definitions
  .{name}.config.ts   // Config files
  ```

- Use proper exports and imports

  ```ts
  // Good
  export { loadConfig } from './loader'
  export type { Config } from './types'

  // Avoid
  export default {
    loadConfig,
    Config,
  }
  ```

- Maintain consistent directory structure

  ```text
  src/           // Source code
  ├─ index.ts    // Main exports
  ├─ types.ts    // Type definitions
  ├─ config.ts   // Configuration
  ├─ merge.ts    // Deep merge
  └─ utils/      // Utilities
  ```

- Follow ESLint rules and maintain consistent style

  ```ts
  // Good - Follow ESLint config
  const config = {
    name: 'app',
    port: 3000,
  }

  // Avoid - Inconsistent style
  const config = { name: 'app', port: 3000 }
  ```

### Project Structure

**Scope:**All files matching `**/*`

**Purpose:** Project Structure specifics

### Root Directory

```text
├─ package.json        # Package configuration
├─ tsconfig.json       # TypeScript configuration
├─ eslint.config.ts    # ESLint configuration
├─ bunfig.toml        # Bun configuration
├─ README.md          # Project documentation
├─ CHANGELOG.md       # Version history
└─ LICENSE.md         # License information
```

### Source Code

```text
src/
├─ index.ts           # Main entry point
├─ types.ts           # Type definitions
├─ config.ts          # Configuration loading
├─ merge.ts           # Deep merge implementation
├─ utils/             # Utility functions
└─ generated/         # Generated type files
```

### Test Files

```text
test/
├─ bunfig.test.ts     # Main test suite
├─ cli.test.ts        # CLI tests
├─ tmp/               # Temporary test files
│  ├─ config/         # Test config files
│  └─ generated/      # Test generated files
└─ fixtures/          # Test fixtures
```

### Documentation

```text
docs/
├─ intro.md           # Introduction guide
├─ usage.md           # Usage documentation
├─ api/               # API documentation
├─ .vitepress/        # VitePress configuration
└─ public/            # Static assets
```

### Development

```text
.vscode/             # VS Code configuration
.github/             # GitHub configuration
├─ workflows/        # CI/CD workflows
└─ FUNDING.yml       # Funding information
.cursor/             # Cursor IDE configuration
└─ rules/           # Project rules
```

### Build Output

```text
dist/
├─ index.js          # Main bundle
├─ index.d.ts        # Type definitions
└─ cli.js           # CLI bundle
```

### Structure Conventions

- Keep related files together
- Use consistent file naming
- Follow module organization patterns
- Maintain clear separation of concerns
- Document directory purposes
- Keep directory structure flat when possible

## Syntax & Formatting Guidelines

- Use consistent indentation (2 spaces)

  ```ts
  // Good
  function loadConfig<T>(options: Config<T>) {
    if (!options.name)
      throw new Error('Config name is required')

    return options.defaultConfig
  }

  // Avoid
  function loadConfig<T>(options: Config<T>) {
    if (!options.name)
      throw new Error('Config name is required')

    return options.defaultConfig
  }
  ```

- Use concise syntax for simple conditionals

  ```ts
  // Good
  if (!options.name)
    throw new Error('Config name is required')

  // Avoid
  if (!options.name) {
    throw new Error('Config name is required')
  }
  ```

- Format function declarations consistently

  ```ts
  // Good
  async function loadConfig<T>(
    options: Config<T>,
    context?: Context
  ): Promise<T> {
    // Implementation
  }

  // Avoid
  async function loadConfig<T>(options: Config<T>, context?: Context): Promise<T> {
    // Implementation
  }
  ```

- Format type definitions clearly

  ```ts
  // Good
  interface Config<T = Record<string, any>> {
    name: string
    cwd?: string
    defaultConfig?: T
    endpoint?: string
  }

  // Avoid
  interface Config<T = Record<string, any>> { name: string, cwd?: string, defaultConfig?: T, endpoint?: string }
  ```

- Use proper spacing in object literals

  ```ts
  // Good
  const config = {
    name: 'app',
    options: {
      port: 3000,
      host: 'localhost',
    },
  }

  // Avoid
  const config = { name: 'app', options: { port: 3000, host: 'localhost' } }
  ```

- Format imports consistently

  ```text
  // Good
  import { describe, expect, it } from 'bun:test'
  // Avoid
  import { describe, expect, it } from 'bun:test'
  import { existsSync, readFileSync } from 'node:fs'

  import { resolve } from 'node:path'
  ```

- Use proper JSDoc formatting

  ```ts
  // Good
  /**

   * Loads configuration from a file
   * @param options - Configuration options
   * @returns Resolved configuration

   */
  function loadConfig(options: Config): Promise<unknown>

  // Avoid
  /**

   * Loads configuration from a file
   * @param options Configuration options
   * @returns Resolved configuration

   */
  function loadConfig(options: Config): Promise<unknown>
  ```

- Format test cases consistently

  ```ts
  // Good
  describe('loadConfig', () => {
    it('should load default config', async () => {
      const result = await loadConfig(options)
      expect(result).toEqual(expected)
    })
  })

  // Avoid
  describe('loadConfig', () => {
    it('should load default config', async () => {
      const result = await loadConfig(options)
      expect(result).toEqual(expected)
    })
  })
  ```

## Testing Guidelines

- Write tests for all public APIs and utilities

  ```ts
  describe('loadConfig', () => {
    it('should load default config when no file exists', async () => {
      const result = await loadConfig({
        name: 'test',
        defaultConfig: { port: 3000 }
      })
      expect(result).toEqual({ port: 3000 })
    })
  })
  ```

- Use proper test organization with describe blocks

  ```ts
  describe('bunfig', () => {
    describe('loadConfig', () => {
      // Config loading tests
    })

    describe('deepMerge', () => {
      // Merge function tests
    })
  })
  ```

- Test edge cases and error scenarios

  ```ts
  it('should handle malformed config files', async () => {
    const result = await loadConfig({
      name: 'invalid',
      defaultConfig: { fallback: true }
    })
    expect(result).toEqual({ fallback: true })
  })
  ```

- Use proper cleanup in tests

  ```ts
  beforeEach(() => {
    // Setup test environment
    if (existsSync(testConfigDir))
      rmSync(testConfigDir, { recursive: true })
    mkdirSync(testConfigDir, { recursive: true })
  })

  afterEach(() => {
    // Cleanup test files
    if (existsSync(testConfigDir))
      rmSync(testConfigDir, { recursive: true })
  })
  ```

- Use Bun's native test modules

  ```ts
  import { describe, expect, it, mock } from 'bun:test'
  ```

- Mock external dependencies properly

  ```ts
  const mockFetch = mock(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ config: 'value' })
    })
  )
  globalThis.fetch = mockFetch
  ```

- Test both success and failure paths

  ```ts
  it('should handle network errors', async () => {
    mockFetch.mockImplementation(() =>
      Promise.reject(new Error('Network error'))
    )
    // Test error handling
  })
  ```

## TypeScript Usage

- Use interfaces for configuration objects and public APIs

  ```ts
  // Good
  interface Config<T = Record<string, any>> {
    name: string
    cwd?: string
    defaultConfig?: T
    endpoint?: string
  }

  // Avoid
  interface Config {
    name: string
    // ...
  }
  ```

- Use `as const` for fixed values instead of enums

  ```ts
  // Good
  const CONFIG*EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs', '.json'] as const

  // Avoid
  enum ConfigExtensions {
    TS = '.ts',
    JS = '.js'
  }
  ```

- Use proper generic constraints for type safety

  ```ts
  // Good
  function loadConfig<T extends Record<string, unknown>>(options: Config<T>): Promise<T>

  // Avoid
  function loadConfig<T>(options: Config<T>): Promise<T>
  ```

- Implement strict type checking for config merging

  ```ts
  // Good
  function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T

  // Avoid
  function deepMerge(target: any, source: any): any
  ```

- Use type guards for runtime type checking

  ```ts
  // Good
  function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }
  ```

- Export types explicitly for public APIs

  ```ts
  // Good
  export type { Config, ConfigOptions }
  export interface DeepMergeOptions {
    // ...
  }
  ```

## backupx Documentation

**Scope:** General information based on the latest ./README.md content

**Purpose:** Documentation for the backupx package

> A comprehensive TypeScript backup library for databases, files, and directories.

## Features

- 🗄️ **Multi-Database Support** - SQLite, PostgreSQL, and MySQL (via Bun's native drivers)
- 📁 **File & Directory Backups** - Backup individual files or entire directories with filtering
- 🗜️ **Compression Support** - Optional gzip compression for all backup types
- 🎯 **Advanced Filtering** - Include/exclude patterns with glob support for directory backups
- 🔄 **Retention Policies** - Configure backup retention by count or age
- 📁 **Flexible Output** - Customizable backup file naming and output directories
- ⚡ **Performance** - Built with Bun for fast execution
- 🧪 **Thoroughly Tested** - Comprehensive test suite with 95%+ coverage
- 🔧 **TypeScript First** - Fully typed APIs for better developer experience
- 📦 **CLI & Programmatic** - Use as a library or command-line tool

## Installation

```bash
# Using Bun (recommended)
bun add backupx
```

## Quick Start

### Programmatic Usage

```ts
import { createBackup } from 'backupx'

const config = {
  verbose: true,
  outputPath: './backups',
  databases: [
    {
      type: 'sqlite',
      name: 'my-app-db',
      path: './data/app.sqlite'
    },
    {
      type: 'postgresql',
      name: 'users-db',
      connection: 'postgres://user:pass@localhost:5432/myapp'
    }
  ],
  files: [
    {
      name: 'uploads',
      path: './public/uploads', // Automatically detected as directory
      compress: true,
      include: ['*.jpg', '*.png', '*.pdf'],
      exclude: ['temp/*']
    },
    {
      name: 'config',
      path: './config/app.json', // Automatically detected as file
      compress: false
    }
  ],
  retention: {
    count: 5, // Keep 5 most recent backups
    maxAge: 30 // Delete backups older than 30 days
  }
}

const summary = await createBackup(config)
console.log(`✅ ${summary.successCount} backups completed`)
console.log(`📊 Database backups: ${summary.databaseBackups.length}`)
console.log(`📁 File backups: ${summary.fileBackups.length}`)
```

### CLI Usage

```bash
# Create backups.config.ts file first
./backups start --verbose
```

## Testing

The library includes a comprehensive test suite covering:

- ✅ **Type Safety** - TypeScript configuration validation
- ✅ **SQLite Backups** - Schema extraction, data export, special characters
- ✅ **File Backups** - Individual file backup with compression and metadata preservation
- ✅ **Directory Backups** - Full directory backup with glob filtering and size limits
- ✅ **Backup Manager** - Multi-database and file coordination, error handling
- ✅ **Retention Policies** - Count-based and age-based cleanup for all backup types
- ✅ **Error Scenarios** - Database connection failures, permission issues, missing files
- ✅ **CLI Integration** - Command-line interface functionality

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch

# Run with coverage
bun run test:coverage

# Run specific test files
bun test test/sqlite.test.ts
bun test test/backup-manager.test.ts
```

### Test Structure

```
test/
├── types.test.ts          # Type definitions and configurations
├── config.test.ts         # Default configuration validation
├── sqlite.test.ts         # SQLite backup functionality
├── file.test.ts           # Individual file backup functionality
├── directory.test.ts      # Directory backup with filtering
├── backup-manager.test.ts # Multi-database and file coordination
└── index.test.ts          # Integration tests and exports
```

## Configuration

Create a `backups.config.ts` file:

```ts
import { BackupConfig } from 'backupx'

export const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',
  retention: {
    count: 10, // Keep 10 most recent backups
    maxAge: 90 // Delete backups older than 90 days
  },
  databases: [
    // SQLite
    {
      type: 'sqlite',
      name: 'app-database',
      path: './data/app.sqlite',
      compress: true
    },

    // PostgreSQL
    {
      type: 'postgresql',
      name: 'user-data',
      connection: {
        hostname: 'localhost',
        port: 5432,
        database: 'myapp',
        username: 'postgres',
        password: 'secret'
      },
      tables: ['users', 'orders'], // Specific tables only
      includeSchema: true,
      includeData: true
    },

    // MySQL (when Bun adds support)
    {
      type: 'mysql',
      name: 'analytics',
      connection: 'mysql://user:pass@localhost:3306/analytics',
      excludeTables: ['temp_logs', 'cache']
    }
  ],

  files: [
    // Directory backups (automatically detected from path)
    {
      name: 'app-uploads',
      path: './public/uploads',
      compress: true,
      include: ['*.jpg', '*.png', '*.pdf', '*.doc*'],
      exclude: ['temp/*', '*.tmp'],
      maxFileSize: 50 * 1024 * 1024, // 50MB max file size
      preserveMetadata: true,
      followSymlinks: false
    },

    {
      name: 'user-data',
      path: './data/users',
      compress: false,
      exclude: ['*.cache', 'temp/*', '*.log'],
      preserveMetadata: true
    },

    // Individual file backups (automatically detected from path)
    {
      name: 'app-config',
      path: './config/app.json',
      compress: false,
      preserveMetadata: true
    },

    {
      name: 'env-file',
      path: './.env.production',
      compress: true,
      filename: 'production-env' // Custom filename
    }
  ]
}
```

## Backup Support

### Database Backups

#### SQLite ✅ Fully Supported

- Native `bun:sqlite` driver
- Complete schema export (tables, indexes, triggers, views)
- Efficient data export with proper escaping
- Binary data support (BLOB fields)

#### PostgreSQL ✅ Fully Supported

- Native Bun SQL class
- Connection strings or configuration objects
- Schema extraction and data export
- Batch processing for large datasets

#### MySQL ⏳ Coming Soon

- Waiting for Bun's native MySQL driver
- Placeholder implementation ready

### File & Directory Backups

#### Directory Backups ✅ Fully Supported

- Recursive directory scanning with configurable depth
- Advanced glob pattern filtering (include/exclude)
- File size limits and symbolic link handling
- Metadata preservation (timestamps, permissions)
- Custom archive format with compression support

#### Individual File Backups ✅ Fully Supported

- Single file backup with original extension preservation
- Optional gzip compression for any file type
- Metadata preservation in separate `.meta` files
- Binary and text file support
- Custom filename and output path configuration

## API Reference

### `createBackup(config: BackupConfig): Promise<BackupSummary>`

Creates backups for all configured databases.

### `BackupManager`

```ts
const manager = new BackupManager(config)
const summary = await manager.createBackup()
```

### Database-Specific Functions

```ts
import { backupPostgreSQL, backupSQLite } from 'backupx'

const result = await backupSQLite(sqliteConfig, './output')
const result = await backupPostgreSQL(pgConfig, './output')
```

---

## Linting

- Use **pickier** for linting — never use eslint directly
- Run `bunx --bun pickier .` to lint, `bunx --bun pickier . --fix` to auto-fix
- When fixing unused variable warnings, prefer `// eslint-disable-next-line` comments over prefixing with `_`

## Frontend

- Use **stx** for templating — never write vanilla JS (`var`, `document.*`, `window.*`) in stx templates
- Use **crosswind** as the default CSS framework which enables standard Tailwind-like utility classes
- stx `<script>` tags should only contain stx-compatible code (signals, composables, directives)

## Dependencies

- **buddy-bot** handles dependency updates — not renovatebot
- **better-dx** provides shared dev tooling as peer dependencies — do not install its peers (e.g., `typescript`, `pickier`, `bun-plugin-dtsx`) separately if `better-dx` is already in `package.json`
- If `better-dx` is in `package.json`, ensure `bunfig.toml` includes `linker = "hoisted"`
