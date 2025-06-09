# File & Directory Backups

ts-backups provides powerful file and directory backup capabilities with advanced filtering, compression, and metadata preservation features.

## Overview

The file backup system automatically detects whether a path is a file or directory and applies the appropriate backup strategy:

- **Files**: Individual file backup with metadata preservation
- **Directories**: Recursive backup with custom archive format and filtering

## Basic Usage

### Single File Backup

```ts
const fileConfig = {
  name: 'config-file',
  path: './config.json',
  compress: true,
  preserveMetadata: true,
}
```

### Directory Backup

```ts
const dirConfig = {
  name: 'source-code',
  path: './src',
  compress: true,
  exclude: ['node_modules/**', '*.log'],
  include: ['**/*.ts', '**/*.js'],
}
```

## File Backup Features

### Compression

Intelligent compression with efficiency reporting:

```ts
const compressedConfig = {
  name: 'large-file',
  path: './data.json',
  compress: true, // Uses gzip compression
}
```

**Benefits:**
- ✅ Automatic compression ratio reporting
- ✅ Size comparison (before/after)
- ✅ Preserves original file extensions
- ✅ Streaming compression for large files

### Metadata Preservation

Preserve file timestamps, permissions, and ownership:

```ts
const metadataConfig = {
  name: 'important-file',
  path: './document.pdf',
  preserveMetadata: true,
}
```

Creates a `.meta` file alongside the backup with:
```ts
const config = {
  originalPath: './document.pdf',
  mtime: 1703175600000,
  atime: 1703175600000,
  mode: 33188,
  uid: 1000,
  gid: 1000,
  size: 2048576
}
```

### File Type Support

ts-backups handles all file types:

```ts
const fileBackups = [
  // Text files
  { name: 'readme', path: './README.md' },
  { name: 'config', path: './package.json' },

  // Binary files
  { name: 'image', path: './logo.png', compress: false },
  { name: 'video', path: './demo.mp4', compress: false },

  // Large files
  { name: 'database', path: './backup.sql', compress: true },
  { name: 'archive', path: './export.zip', compress: false },
]
```

## Directory Backup Features

### Advanced Filtering

Use glob patterns for precise file selection:

```ts
const webAssetsConfig = {
  name: 'web-assets',
  path: './public',
  compress: true,

  // Include only specific types
  include: [
    '**/*.css',
    '**/*.js',
    '**/*.html',
    '**/*.png',
    '**/*.jpg',
    '**/*.svg',
  ],

  // Exclude temporary and cache files
  exclude: [
    '*.tmp',
    '*.log',
    'cache/**',
    'thumbnails/**',
    'node_modules/**',
  ],
}
```

### File Size Limits

Control which files are included based on size:

```ts
const sizeLimitConfig = {
  name: 'user-uploads',
  path: './uploads',
  compress: true,
  maxFileSize: 50 * 1024 * 1024, // 50MB limit
  exclude: ['*.tmp'],
}
```

### Symbolic Link Handling

Choose whether to follow symbolic links:

```ts
const withSymlinksConfig = {
  name: 'with-symlinks',
  path: './project',
  followSymlinks: true, // Follow symbolic links
  exclude: ['node_modules/**'],
}

const noSymlinksConfig = {
  name: 'no-symlinks',
  path: './project',
  followSymlinks: false, // Skip symbolic links (default)
}
```

### Custom Archive Format

ts-backups uses a custom archive format that includes:

- **JSON Headers**: File metadata for each file
- **Streaming Data**: Actual file content
- **Compression**: Optional gzip compression
- **Metadata**: Timestamps, permissions, ownership

## Production Examples

### Web Application Files

Comprehensive backup for a web application:

```ts
const webAppFiles: FileConfig[] = [
  // Application source code
  {
    name: 'source-code',
    path: './src',
    compress: true,
    include: [
      '**/*.ts',
      '**/*.js',
      '**/*.tsx',
      '**/*.jsx',
      '**/*.css',
      '**/*.scss',
      '**/*.html',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.log',
      '*.tmp',
      'coverage/**',
    ],
  },

  // User uploads
  {
    name: 'uploads',
    path: './storage/uploads',
    compress: true,
    maxFileSize: 100 * 1024 * 1024, // 100MB limit
    exclude: ['*.tmp', '*.processing'],
  },

  // Configuration files
  {
    name: 'config',
    path: './config',
    preserveMetadata: true,
    include: ['*.json', '*.yaml', '*.env*'],
    exclude: ['*.example*', '*.template*'],
  },

  // Documentation
  {
    name: 'docs',
    path: './docs',
    compress: true,
    include: ['*.md', '*.txt', 'images/**'],
  },
]
```

### Development Environment

Backup development files:

```ts
const devFiles: FileConfig[] = [
  {
    name: 'dev-source',
    path: './src',
    compress: false, // Faster for frequent backups
    exclude: ['node_modules/**', 'dist/**', '*.log'],
  },
  {
    name: 'dev-config',
    path: './config',
    preserveMetadata: true,
  },
]
```

### Large Project with Exclusions

Handle large projects efficiently:

```ts
const config = {
  name: 'large-project',
  path: './monorepo',
  compress: true,

  // Include only source files
  include: [
    'packages/**/src/**/*.ts',
    'packages/**/src/**/*.tsx',
    'packages/**/package.json',
    'packages/**/README.md',
    'apps/**/src/**/*.ts',
    'apps/**/src/**/*.tsx',
    'apps/**/package.json',
    'lerna.json',
    'package.json',
    'tsconfig.json',
  ],

  // Exclude heavy directories
  exclude: [
    'node_modules/**',
    '**/node_modules/**',
    'packages/**/dist/**',
    'packages/**/build/**',
    'apps/**/dist/**',
    'apps/**/build/**',
    '**/*.log',
    '**/coverage/**',
    '**/.nyc_output/**',
  ],

  maxFileSize: 10 * 1024 * 1024, // 10MB limit
}
```

## Performance Optimization

### Compression Strategy

Choose compression based on file types:

```ts
const mediaFiles = {
  name: 'media',
  path: './media',
  compress: false, // Already compressed formats
  include: ['**/*.jpg', '**/*.png', '**/*.mp4', '**/*.zip'],
}

const textFiles = {
  name: 'text-files',
  path: './documents',
  compress: true, // Good compression for text
  include: ['**/*.txt', '**/*.md', '**/*.json', '**/*.csv'],
}
```

### Large Directory Handling

For very large directories:

```ts
const config = {
  name: 'large-data',
  path: './data',
  compress: true,

  // Limit file size to prevent memory issues
  maxFileSize: 500 * 1024 * 1024, // 500MB limit

  // Use specific includes to avoid scanning everything
  include: [
    'important/**/*.json',
    'exports/**/*.csv',
    'backups/**/*.sql',
  ],

  // Exclude known large directories
  exclude: [
    'temp/**',
    'cache/**',
    'logs/**',
    'raw-data/**',
  ],
}
```

## Error Handling

File backup errors and how to handle them:

```ts
const manager = new BackupManager(config)
const summary = await manager.createBackup()

// Check for file backup failures
const fileFailures = summary.fileBackups.filter(r => !r.success)

for (const failure of fileFailures) {
  console.error(`File backup failed: ${failure.name}`)
  console.error(`Error: ${failure.error}`)

  // Handle common file errors
  if (failure.error?.includes('ENOENT')) {
    console.log('💡 File or directory not found')
  }
  else if (failure.error?.includes('EACCES')) {
    console.log('💡 Permission denied - check file permissions')
  }
  else if (failure.error?.includes('ENOSPC')) {
    console.log('💡 No space left on device')
  }
}
```

### Common Issues

**Permission Problems:**
```bash
# Fix file permissions
chmod -R 755 ./directory-to-backup

# Check file ownership
ls -la ./file-to-backup
```

**Path Issues:**
```ts
// ❌ Bad: Relative paths might not resolve correctly
path: '../../../some-file.txt'

// ✅ Good: Use absolute paths or project-relative paths
path: './relative-to-project.txt'
path: path.resolve(__dirname, '../config.json')
```

**Large File Handling:**
```ts
// For very large files, disable compression to save memory
const config = {
  name: 'huge-file',
  path: './huge-database.sql',
  compress: false, // Skip compression for very large files
  preserveMetadata: true,
}
```

## Archive Format Details

ts-backups creates custom archive files with this structure:

```
Archive File Structure:
┌─────────────────────────┐
│ File 1 Header (JSON)    │ ← 4 bytes header size + JSON metadata
├─────────────────────────┤
│ File 1 Content          │ ← Raw file content
├─────────────────────────┤
│ File 2 Header (JSON)    │
├─────────────────────────┤
│ File 2 Content          │
├─────────────────────────┤
│ ...                     │
└─────────────────────────┘
```

### Header Format

Each file header contains:

```ts
const config = {
  path: 'relative/path/to/file.txt',
  size: 1024,
  mtime: 1703175600000,
  mode: 33188,
  uid: 1000,
  gid: 1000
}
```

## Backup Verification

Verify file backups are complete:

```ts
for (const result of summary.fileBackups) {
  if (result.success) {
    console.log(`✅ ${result.name}:`)
    console.log(`   File: ${result.filename}`)
    console.log(`   Size: ${formatBytes(result.size)}`)
    console.log(`   Files: ${result.fileCount || 1}`)

    // Check if archive is compressed
    if (result.filename.endsWith('.gz')) {
      console.log(`   Compressed: Yes`)
    }
  }
}
```

## Next Steps

- Explore [Compression Options](/features/compression) in detail
- Set up [Retention Policies](/features/retention) for file cleanup
- Learn about [Metadata Preservation](/features/metadata)
- Review [Advanced Filtering Patterns](/advanced/filtering)
