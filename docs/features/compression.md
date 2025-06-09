# Compression

ts-backups provides intelligent compression capabilities to reduce backup size while maintaining data integrity and providing detailed efficiency metrics.

## Overview

Compression in ts-backups is:
- **Optional**: Enable per backup or globally
- **Intelligent**: Automatic compression ratio reporting
- **Streaming**: Memory-efficient for large files
- **Transparent**: Preserves original file extensions

## Basic Usage

### Enable Compression

```ts
// Database compression
{
  type: BackupType.SQLITE,
  name: 'app-db',
  path: './database.sqlite',
  compress: true, // Enable gzip compression
}

// File compression
{
  name: 'large-file',
  path: './data.json',
  compress: true,
}

// Directory compression
{
  name: 'source-code',
  path: './src',
  compress: true,
  exclude: ['node_modules/**'],
}
```

### Compression Output

When compression is enabled, you'll see detailed statistics:

```
📄 Starting file backup for: ./data.json
   Output: ./backups/data_2023-12-01T10-30-00.json.gz
   File size: 2.5 MB
✅ File backup completed in 150ms
   Size: 512 KB
   Compression: 79.5% reduction
```

## How Compression Works

### Gzip Algorithm

ts-backups uses gzip compression, which provides:
- **Good compression ratios** for text-based content
- **Fast compression/decompression** speeds
- **Wide compatibility** with standard tools
- **Streaming support** for large files

### File Extension Handling

Original extensions are preserved:

```ts
// Input file: config.json
// Compressed output: config_2023-12-01T10-30-00.json.gz

// Input file: database.sqlite
// Compressed output: database_2023-12-01T10-30-00.sql.gz

// Input directory: ./src
// Compressed output: src_2023-12-01T10-30-00.tar.gz
```

## Compression Strategies

### When to Use Compression

**✅ Good candidates for compression:**

```ts
const goodForCompression = [
  // Text-based files
  { name: 'sql-dump', path: './backup.sql', compress: true },
  { name: 'json-data', path: './data.json', compress: true },
  { name: 'logs', path: './logs', compress: true },

  // Source code
  { name: 'source', path: './src', compress: true },

  // Configuration files
  { name: 'config', path: './config.txt', compress: true },
]
```

**❌ Poor candidates for compression:**

```ts
const poorForCompression = [
  // Already compressed formats
  { name: 'images', path: './photos', compress: false }, // JPG, PNG
  { name: 'videos', path: './videos', compress: false }, // MP4, WebM
  { name: 'archives', path: './zips', compress: false }, // ZIP, RAR

  // Very small files (overhead not worth it)
  { name: 'tiny-config', path: './small.json', compress: false },
]
```

### Smart Compression Logic

Implement smart compression based on file types:

```ts
function shouldCompress(filePath: string): boolean {
  const textExtensions = ['.txt', '.json', '.sql', '.csv', '.log', '.md']
  const compressedExtensions = ['.jpg', '.png', '.mp4', '.zip', '.gz']

  const ext = path.extname(filePath).toLowerCase()

  if (compressedExtensions.includes(ext))
    return false
  if (textExtensions.includes(ext))
    return true

  // Default based on file size
  return fs.statSync(filePath).size > 1024 // Compress files > 1KB
}

const intelligentBackup = {
  name: 'smart-backup',
  path: './mixed-content',
  compress: true, // Will be applied intelligently
}
```

## Performance Considerations

### Memory Usage

Compression uses streaming to minimize memory usage:

```ts
// Large file compression (streaming)
{
  name: 'large-database',
  path: './huge-database.sql', // 2GB file
  compress: true, // Uses streaming compression
}
```

### CPU vs Storage Trade-off

Balance compression time against storage savings:

```ts
// Fast backups (no compression)
const fastBackup = {
  databases: databases.map(db => ({ ...db, compress: false })),
  files: files.map(file => ({ ...file, compress: false })),
}

// Space-efficient backups (with compression)
const compactBackup = {
  databases: databases.map(db => ({ ...db, compress: true })),
  files: files.map(file => ({ ...file, compress: true })),
}
```

## Compression Metrics

### Understanding the Output

When compression is enabled, ts-backups reports:

```
Original Size: 10.5 MB
Compressed Size: 2.1 MB
Compression Ratio: 80.0% reduction
Time: 250ms
```

### Compression Efficiency

Different content types achieve different compression ratios:

| Content Type | Typical Compression |
|--------------|-------------------|
| SQL dumps | 70-90% reduction |
| JSON data | 60-80% reduction |
| Source code | 50-70% reduction |
| Log files | 80-95% reduction |
| Binary files | 0-20% reduction |
| Images/Media | Often increases size |

### Monitoring Compression

Track compression effectiveness:

```ts
const manager = new BackupManager(config)
const summary = await manager.createBackup()

for (const result of summary.results) {
  if (result.success && result.filename.endsWith('.gz')) {
    console.log(`📦 ${result.name}:`)
    console.log(`   Compressed size: ${formatBytes(result.size)}`)

    // You can track compression ratios over time
    logCompressionMetrics(result.name, result.size)
  }
}

function logCompressionMetrics(name: string, compressedSize: number) {
  // Store metrics for analysis
  const metrics = {
    timestamp: new Date().toISOString(),
    backup: name,
    compressedSize,
    // You could also store original size if tracked
  }

  // Save to metrics file or database
  fs.appendFileSync('./compression-metrics.jsonl', `${JSON.stringify(metrics)}\n`)
}
```

## Advanced Compression Scenarios

### Mixed Content Strategy

Handle different content types appropriately:

```ts
const mixedContentConfig: BackupConfig = {
  verbose: true,
  outputPath: './backups',

  databases: [
    // Databases benefit greatly from compression
    {
      type: BackupType.POSTGRESQL,
      name: 'main-db',
      connection: process.env.DATABASE_URL!,
      compress: true, // SQL text compresses very well
    }
  ],

  files: [
    // Text-based source code
    {
      name: 'source-code',
      path: './src',
      compress: true,
      include: ['**/*.ts', '**/*.js', '**/*.css'],
    },

    // Mixed media directory (selective compression)
    {
      name: 'uploads',
      path: './uploads',
      compress: false, // Mostly images/videos
      include: ['**/*.jpg', '**/*.png', '**/*.mp4'],
    },

    // Configuration (small text files)
    {
      name: 'config-files',
      path: './config',
      compress: true,
      include: ['**/*.json', '**/*.yaml', '**/*.env'],
    },

    // Large text files
    {
      name: 'data-exports',
      path: './exports',
      compress: true,
      include: ['**/*.csv', '**/*.tsv', '**/*.json'],
    },
  ]
}
```

### Production Optimization

Optimize for production environments:

```ts
const productionConfig: BackupConfig = {
  verbose: false, // Reduce logging overhead
  outputPath: '/var/backups/app',

  databases: [
    {
      type: BackupType.POSTGRESQL,
      name: 'prod-db',
      connection: process.env.DATABASE_URL!,
      compress: true, // Essential for large databases
      excludeTables: ['logs', 'sessions'], // Exclude non-essential data
    }
  ],

  files: [
    // Only compress large text-based content
    {
      name: 'essential-data',
      path: './data',
      compress: true,
      include: ['**/*.json', '**/*.csv'],
      maxFileSize: 100 * 1024 * 1024, // 100MB limit
    },

    // Skip compression for already optimized content
    {
      name: 'static-assets',
      path: './public',
      compress: false,
      include: ['**/*.jpg', '**/*.png', '**/*.woff2'],
    },
  ],

  retention: {
    count: 30, // Keep more backups since they're smaller
    maxAge: 90,
  }
}
```

## Troubleshooting Compression

### Common Issues

**Compression Makes Files Larger:**

This happens with already-compressed content:

```ts
// ❌ Problem: Compressing compressed files
{
  name: 'images',
  path: './photos',
  compress: true, // JPGs won't compress further
}

// ✅ Solution: Skip compression for media
{
  name: 'images',
  path: './photos',
  compress: false,
}
```

**Memory Issues with Large Files:**

```ts
// ❌ Problem: Very large files might cause memory issues
{
  name: 'huge-file',
  path: './10gb-file.sql',
  compress: true,
}

// ✅ Solution: Use file size limits or disable compression
{
  name: 'huge-file',
  path: './10gb-file.sql',
  compress: false, // Skip compression for very large files
}
```

**Slow Compression:**

```ts
// For time-critical backups, disable compression
const quickBackup = {
  ...config,
  databases: config.databases.map(db => ({ ...db, compress: false })),
  files: config.files.map(file => ({ ...file, compress: false })),
}
```

### Compression Verification

Verify compressed backups are valid:

```bash
# Test gzip file integrity
gzip -t backup_2023-12-01T10-30-00.sql.gz

# View compressed file info
gzip -l backup_2023-12-01T10-30-00.sql.gz

# Decompress for verification
gunzip -c backup_2023-12-01T10-30-00.sql.gz | head -n 10
```

## Best Practices

### 1. Profile Your Content

Test compression on representative data:

```ts
// Test different compression strategies
const testConfigs = [
  { name: 'no-compression', compress: false },
  { name: 'with-compression', compress: true },
]

for (const testConfig of testConfigs) {
  const start = Date.now()
  await createTestBackup(testConfig)
  const duration = Date.now() - start

  console.log(`${testConfig.name}: ${duration}ms`)
}
```

### 2. Environment-Specific Settings

```ts
const compressionSettings = {
  development: {
    compress: false, // Faster backups during development
  },
  staging: {
    compress: true, // Test compression performance
  },
  production: {
    compress: true, // Optimize storage in production
  },
}

const env = process.env.NODE_ENV || 'development'
const settings = compressionSettings[env]
```

### 3. Monitor Storage Savings

Track how much space compression saves:

```ts
async function trackStorageSavings(results: BackupResult[]) {
  let totalCompressed = 0
  let estimatedUncompressed = 0

  for (const result of results) {
    if (result.filename.endsWith('.gz')) {
      totalCompressed += result.size
      // Estimate original size (rough approximation)
      estimatedUncompressed += result.size * 3 // Assume 66% compression
    }
  }

  const savings = estimatedUncompressed - totalCompressed
  console.log(`💾 Storage savings: ${formatBytes(savings)} (estimated)`)
}
```

## Next Steps

- Learn about [Retention Policies](/features/retention) to manage compressed backups
- Explore [Metadata Preservation](/features/metadata) options
- Review [Performance Tuning](/advanced/performance) for large-scale compression
- Check out [CLI Interface](/features/cli) for command-line compression control
