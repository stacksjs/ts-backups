import type { BackupConfig } from './types'
// @ts-expect-error - bunfig is not typed
import { loadConfig } from 'bunfig'

export const defaultConfig: BackupConfig = {
  verbose: true,
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: BackupConfig = await loadConfig({
  name: 'backup',
  defaultConfig,
})
