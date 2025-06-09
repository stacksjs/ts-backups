/**
 * Utility functions for the backup system
 */

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0)
    return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`
}

/**
 * Sanitize filename to remove invalid characters
 */
export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9.-]/gi, '_').substring(0, 255)
}

/**
 * Create timestamp string for filenames
 */
export function createTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

/**
 * Validate that required fields are present in config
 */
export function validateRequiredFields<T>(obj: T, fields: (keyof T)[]): string[] {
  const errors: string[] = []

  for (const field of fields) {
    if (!obj[field]) {
      errors.push(`Missing required field: ${String(field)}`)
    }
  }

  return errors
}

/**
 * Check if names in array are unique
 */
export function findDuplicateNames(items: { name: string }[]): string[] {
  const names = items.map(item => item.name)
  return names.filter((name, index) => names.indexOf(name) !== index)
}
