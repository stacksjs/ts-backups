import type { BackupConfig } from './types'
import { loadConfig } from 'bunfig'
import { DEFAULT_CONFIG } from './constants'

export const defaultConfig: BackupConfig = {
  verbose: DEFAULT_CONFIG.VERBOSE,
  databases: [],
  files: [],
  outputPath: DEFAULT_CONFIG.BACKUP_PATH,
  retention: {
    count: DEFAULT_CONFIG.RETENTION_COUNT,
    maxAge: DEFAULT_CONFIG.RETENTION_MAX_AGE,
  },
}

// Lazy-loaded config to avoid top-level await (enables bun --compile)
let _config: BackupConfig | null = null

export async function getConfig(): Promise<BackupConfig> {
  if (!_config) {
    _config = await loadConfig({
  name: 'backup',
  defaultConfig,
})
  }
  return _config
}

// For backwards compatibility - synchronous access with default fallback
export const config: BackupConfig = defaultConfig
