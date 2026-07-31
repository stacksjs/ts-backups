import type { BackupConfig } from './types'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
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
 * Load an explicit config file.
 *
 * Discovery from the cwd is the right default for a project with a checked-in
 * `backups.config.ts`, and the wrong one everywhere else. Backing up a remote
 * machine means dropping a config somewhere and pointing at it; without this,
 * the only way to be sure which file was read is to cd into its directory and
 * hope nothing else up the tree matched first.
 *
 * A missing file is an error rather than a fall back to discovery or to
 * defaults. Both of those "succeed" while backing up something other than what
 * was asked for, and a backup that silently covered the wrong things is worse
 * than one that failed loudly - you find out when you restore.
 */
export async function loadConfigFile(configPath: string): Promise<BackupConfig> {
  const resolved = resolve(configPath)

  if (!existsSync(resolved))
    throw new Error(`Backup config not found: ${resolved}`)

  const module = await import(resolved)
  const loaded = (module.default ?? module) as Partial<BackupConfig>

  return {
    ...defaultConfig,
    ...loaded,
    databases: loaded.databases ?? [],
    files: loaded.files ?? [],
  }
}

export async function getConfig(configPath?: string): Promise<BackupConfig> {
  // An explicit path is never served from the discovery cache: two different
  // configs in one process must not resolve to whichever was asked for first.
  if (configPath)
    return loadConfigFile(configPath)

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
