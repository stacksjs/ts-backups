import type { BackupConfig } from './types'
// @ts-expect-error - bunfig is not typed
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

// eslint-disable-next-line antfu/no-top-level-await
export const config: BackupConfig = await loadConfig({
  name: 'backup',
  defaultConfig,
})
