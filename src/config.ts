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

/**
 * The backup configuration, either discovered or from a named file.
 *
 * Resolution is bunfig's job, including the part that matters here: a file
 * named explicitly must fail loudly when it cannot be loaded, rather than
 * falling back to defaults and backing up something other than what was asked
 * for. That rule lives in bunfig's `configFile` handling so every tool gets it,
 * not just this one.
 */
export async function getConfig(configPath?: string): Promise<BackupConfig> {
  // Not cached: two different configs in one process must not resolve to
  // whichever was asked for first. bunfig keys its own cache by the path.
  if (configPath)
    return loadConfig({ name: 'backups', configFile: configPath, defaultConfig })

  if (!_config) {
    _config = await loadConfig({
      // Resolves `backups.config.ts` (and .js/.json/etc.) from the cwd. Keep
      // this in sync with the CLI name (`backups`) and the documented config
      // filename.
      name: 'backups',
      defaultConfig,
    })
  }
  return _config
}

// For backwards compatibility - synchronous access with default fallback
export const config: BackupConfig = defaultConfig
