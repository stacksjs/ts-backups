# Metadata Preservation

backupx can preserve file metadata including timestamps, permissions, ownership, and other file attributes, ensuring complete restoration capabilities.

## Overview

Metadata preservation captures:
- **Timestamps**: Creation, modification, and access times
- **Permissions**: File mode and access rights
- **Ownership**: User and group IDs
- **File Size**: Original file size
- **File Path**: Original location

## Basic Usage

### Enable Metadata Preservation

```ts
const config = {
  name: 'important-document',
  path: './contract.pdf',
  preserveMetadata: true, // Enable metadata preservation
}
```

### Metadata Files

When enabled, backupx creates `.meta` files alongside backups:

```
backups/
├── contract_2023-12-01T10-30-00.pdf      # Backup file
└── contract_2023-12-01T10-30-00.pdf.meta # Metadata file
```

## Metadata Format

### Single File Metadata

For individual files, metadata is stored as JSON:

```ts
const config = {
  originalPath: './contract.pdf',
  mtime: 1703175600000,
  atime: 1703175550000,
  ctime: 1703175600000,
  mode: 33188,
  uid: 1000,
  gid: 1000,
  size: 2048576
}
```

### Directory Metadata

For directories, metadata is embedded in the archive headers:

```ts
const config = {
  path: 'documents/contract.pdf',
  size: 2048576,
  mtime: 1703175600000,
  mode: 33188,
  uid: 1000,
  gid: 1000
}
```

## Metadata Fields

### Timestamps

- **mtime**: Modification time (milliseconds since epoch)
- **atime**: Access time (milliseconds since epoch)
- **ctime**: Creation/status change time (milliseconds since epoch)

```ts
// Example timestamp conversion
const metadata = JSON.parse(metadataContent)
const modificationDate = new Date(metadata.mtime)
console.log(`Last modified: ${modificationDate.toISOString()}`)
```

### Permissions

- **mode**: File permissions as octal number
- **uid**: User ID of file owner
- **gid**: Group ID of file owner

```ts
// Understanding file permissions
const mode = 33188 // Example mode
const permissions = (mode & Number.parseInt('777', 8)).toString(8)
console.log(`Permissions: ${permissions}`) // e.g., "644"

// Check if file is executable
const isExecutable = (mode & 0o111) !== 0
```

### File Type Detection

```ts
const S_IFMT = 0o170000 // File type mask
const S_IFREG = 0o100000 // Regular file
const S_IFDIR = 0o040000 // Directory
const S_IFLNK = 0o120000 // Symbolic link

function getFileType(mode: number): string {
  const fileType = mode & S_IFMT

  switch (fileType) {
    case S_IFREG: return 'regular file'
    case S_IFDIR: return 'directory'
    case S_IFLNK: return 'symbolic link'
    default: return 'unknown'
  }
}
```

## Practical Examples

### Document Backup with Metadata

```ts
const documentBackup = {
  name: 'legal-documents',
  path: './legal',
  compress: true,
  preserveMetadata: true, // Preserve timestamps and permissions
  include: ['**/*.pdf', '**/*.docx'],
}
```

### Source Code with Permissions

```ts
const sourceBackup = {
  name: 'source-code',
  path: './src',
  compress: true,
  preserveMetadata: true, // Important for script permissions
  include: ['**/*.ts', '**/*.js', '**/*.sh'],
}
```

### Configuration Files

```ts
const configBackup = {
  name: 'system-config',
  path: './config',
  preserveMetadata: true, // Preserve ownership and permissions
  include: ['**/*.conf', '**/*.json', '**/*.yaml'],
}
```

## Restoration Considerations

### Using Metadata for Restoration

```ts
import { chmod, chown, readFile, utimes } from 'node:fs/promises'

async function restoreFileWithMetadata(backupPath: string, metadataPath: string) {
  // Read metadata
  const metadataContent = await readFile(metadataPath, 'utf8')
  const metadata = JSON.parse(metadataContent)

  // Restore timestamps
  const atime = new Date(metadata.atime)
  const mtime = new Date(metadata.mtime)
  await utimes(backupPath, atime, mtime)

  // Restore permissions
  await chmod(backupPath, metadata.mode & 0o777)

  // Restore ownership (requires appropriate privileges)
  try {
    await chown(backupPath, metadata.uid, metadata.gid)
  }
  catch (error) {
    console.warn('Could not restore ownership (insufficient privileges)')
  }

  console.log(`Restored ${backupPath} with original metadata`)
}
```

### Cross-Platform Considerations

```ts
// Handle platform differences
function normalizeMetadata(metadata: any) {
  // Windows doesn't use Unix permissions
  if (process.platform === 'win32') {
    return {
      ...metadata,
      mode: undefined,
      uid: undefined,
      gid: undefined,
    }
  }

  return metadata
}
```

## Security Considerations

### Sensitive Information

Be cautious with metadata that might reveal sensitive information:

```ts
// Example of filtering sensitive metadata
function sanitizeMetadata(metadata: any) {
  return {
    ...metadata,
    // Remove potentially sensitive ownership info
    uid: undefined,
    gid: undefined,
    // Keep only essential timestamps
    mtime: metadata.mtime,
    size: metadata.size,
  }
}

const secureBackup = {
  name: 'public-files',
  path: './public',
  preserveMetadata: true,
  // Custom metadata processing would go here
}
```

### Permission Preservation

Consider security implications of preserving permissions:

```ts
// Backup executable files
const executableBackup = {
  name: 'scripts',
  path: './scripts',
  preserveMetadata: true, // Preserves execute permissions
  include: ['**/*.sh', '**/*.py', '**/*.exe'],
}

// Non-executable backup (safer for sharing)
const dataBackup = {
  name: 'data-files',
  path: './data',
  preserveMetadata: false, // Don't preserve execute permissions
  include: ['**/*.json', '**/*.csv'],
}
```

## Advanced Metadata Scenarios

### Selective Metadata Preservation

```ts
// Different preservation strategies for different file types
const mixedBackup = [
  // Preserve metadata for configuration files
  {
    name: 'config-files',
    path: './config',
    preserveMetadata: true,
    include: ['**/*.conf', '**/*.json'],
  },

  // Skip metadata for temporary files
  {
    name: 'temp-data',
    path: './temp',
    preserveMetadata: false,
    include: ['**/*.tmp', '**/*.cache'],
  },

  // Preserve metadata for executables
  {
    name: 'executables',
    path: './bin',
    preserveMetadata: true,
    include: ['**/*.sh', '**/*.exe'],
  },
]
```

### Metadata Analysis

```ts
async function analyzeMetadata(metadataPath: string) {
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))

  console.log('File Analysis:')
  console.log(`  Original path: ${metadata.originalPath}`)
  console.log(`  Size: ${formatBytes(metadata.size)}`)
  console.log(`  Modified: ${new Date(metadata.mtime).toISOString()}`)
  console.log(`  Permissions: ${(metadata.mode & 0o777).toString(8)}`)
  console.log(`  Owner: ${metadata.uid}:${metadata.gid}`)

  // Check for potential issues
  if (metadata.mode & 0o002) {
    console.warn('⚠️  File is world-writable')
  }

  if (metadata.mode & 0o111) {
    console.log('🔧 File is executable')
  }
}

function formatBytes(bytes: number): string {
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  if (bytes === 0)
    return '0 Bytes'
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${Math.round(bytes / 1024 ** i * 100) / 100} ${sizes[i]}`
}
```

### Metadata Validation

```ts
function validateMetadata(metadata: any): boolean {
  const required = ['originalPath', 'mtime', 'size']

  for (const field of required) {
    if (!(field in metadata)) {
      console.error(`Missing required metadata field: ${field}`)
      return false
    }
  }

  // Validate timestamp
  if (typeof metadata.mtime !== 'number' || metadata.mtime <= 0) {
    console.error('Invalid modification time')
    return false
  }

  // Validate size
  if (typeof metadata.size !== 'number' || metadata.size < 0) {
    console.error('Invalid file size')
    return false
  }

  return true
}
```

## Performance Impact

### Metadata Collection Overhead

Metadata preservation adds minimal overhead:

```ts
// Performance comparison
async function benchmarkMetadata(filePath: string) {
  // Without metadata
  const start1 = Date.now()
  await backupFile({ name: 'test', path: filePath, preserveMetadata: false })
  const withoutMetadata = Date.now() - start1

  // With metadata
  const start2 = Date.now()
  await backupFile({ name: 'test', path: filePath, preserveMetadata: true })
  const withMetadata = Date.now() - start2

  console.log(`Without metadata: ${withoutMetadata}ms`)
  console.log(`With metadata: ${withMetadata}ms`)
  console.log(`Overhead: ${withMetadata - withoutMetadata}ms`)
}
```

### Storage Impact

Metadata files are typically very small:

```ts
// Typical metadata file sizes
const metadataSizes = {
  singleFile: '< 1 KB', // Individual file metadata
  directory: '< 100 bytes', // Per-file in directory archive
  impact: '< 1%', // Of total backup size
}
```

## Best Practices

### 1. Enable for Important Files

```ts
// Enable metadata preservation for files where it matters
const importantFiles = [
  'configuration files',
  'executable scripts',
  'legal documents',
  'system files',
]

// Skip for files where metadata isn't important
const skipMetadataFor = [
  'temporary files',
  'cache files',
  'generated content',
  'logs',
]
```

### 2. Consider Restoration Environment

```ts
// Development environment (more permissive)
const devConfig = {
  preserveMetadata: false, // Simpler restoration
}

// Production environment (exact restoration)
const prodConfig = {
  preserveMetadata: true, // Preserve all attributes
}
```

### 3. Document Metadata Requirements

```ts
// Document what metadata is preserved
const backupConfig = {
  name: 'app-config',
  path: './config',
  preserveMetadata: true,
  // Note: Preserves timestamps, permissions, and ownership
  // Required for proper application startup
}
```

## Troubleshooting

### Metadata File Missing

```ts
// Handle missing metadata gracefully
async function restoreWithFallback(backupPath: string, metadataPath: string) {
  try {
    await restoreFileWithMetadata(backupPath, metadataPath)
  }
  catch (error) {
    console.warn('Metadata file missing, using default attributes')

    // Set reasonable defaults
    const now = new Date()
    await utimes(backupPath, now, now)
    await chmod(backupPath, 0o644) // Default permissions
  }
}
```

### Permission Errors

```ts
// Handle permission restoration errors
async function safeRestorePermissions(filePath: string, mode: number) {
  try {
    await chmod(filePath, mode)
  }
  catch (error) {
    console.warn(`Could not restore permissions for ${filePath}:`, error)

    // Try safe default permissions
    try {
      await chmod(filePath, 0o644)
    }
    catch {
      console.error('Could not set any permissions')
    }
  }
}
```

### Platform Compatibility

```ts
// Handle platform differences
function adaptMetadataForPlatform(metadata: any) {
  if (process.platform === 'win32') {
    // Windows doesn't use Unix-style permissions
    return {
      originalPath: metadata.originalPath,
      mtime: metadata.mtime,
      size: metadata.size,
      // Omit Unix-specific fields
    }
  }

  return metadata // Use all metadata on Unix-like systems
}
```

## Next Steps

- Learn about [CLI Interface](/features/cli) for metadata management
- Explore [Advanced Filtering](/advanced/filtering) with metadata considerations
- Review [Integration Patterns](/advanced/integration) for automated metadata handling
- Check out [Performance Tuning](/advanced/performance) for metadata optimization

Enable metadata preservation for any file backup:

```ts
const metadataConfig = {
  name: 'important-docs',
  path: './documents',
  preserveMetadata: true,
}
```
