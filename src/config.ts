import type { BackupConfig } from './types'
// @ts-expect-error - bunfig is not typed
import { loadConfig } from 'bunfig'

export const defaultConfig: BackupConfig = {
  verbose: true,
  databases: [],
  outputPath: './backups',
  retention: {
    count: 5,
    maxAge: 30,
  },
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: BackupConfig = await loadConfig({
  name: 'backup',
  defaultConfig,
})
