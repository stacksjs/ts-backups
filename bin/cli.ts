import process from 'node:process'
import { CLI as CAC } from '@stacksjs/clapp'
import { version } from '../package.json'
import { BackupManager } from '../src/backups'
import { config } from '../src/config'
import { RestoreManager } from '../src/restore'

const cli = new CAC('backups')

interface CliOption {
  verbose: boolean
}

interface RestoreCliOption {
  verbose?: boolean
  only?: string | string[]
  snapshot?: string
  target?: string
  overwrite?: boolean
}

function toArray(value?: string | string[]): string[] | undefined {
  if (value === undefined)
    return undefined
  return Array.isArray(value) ? value : [value]
}

cli
  .command('start', 'Start the Backup Process')
  .option('--verbose', 'Enable verbose logging')
  .example('backups start --verbose')
  .action(async (options?: CliOption) => {
    try {
      // Override config verbosity if CLI option is provided
      const backupConfig = {
        ...config,
        verbose: options?.verbose ?? config.verbose,
      }

      if (backupConfig.databases.length === 0 && backupConfig.files.length === 0) {
        console.error('❌ No databases or files configured for backup.')
        console.error('💡 Please configure databases and/or files in your backup configuration file.')
        console.error('   Example: databases for SQLite/PostgreSQL/MySQL or files for directory/file backups.')
        process.exit(1)
      }

      const manager = new BackupManager(backupConfig)
      const summary = await manager.createBackup()

      // Exit with error code if any backups failed
      if (summary.failureCount > 0) {
        process.exit(1)
      }
    }
    catch (error) {
      console.error('❌ Backup process failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

cli
  .command('restore', 'Restore files and directories from a snapshot')
  .option('--verbose', 'Enable verbose logging')
  .option('--only <name>', 'Restore only the named backup(s); repeatable')
  .option('--snapshot <file>', 'Restore from a specific snapshot filename (default: latest)')
  .option('--target <path>', 'Restore to this base path instead of the original location')
  .option('--overwrite', 'Overwrite files that already exist at the destination')
  .example('backups restore --verbose')
  .example('backups restore --only vscode-settings --overwrite')
  .example('backups restore --snapshot gitconfig_2026-05-30T17-30-00-000Z')
  .action(async (options?: RestoreCliOption) => {
    try {
      const restoreConfig = {
        ...config,
        verbose: options?.verbose ?? config.verbose,
      }

      if (restoreConfig.databases.length === 0 && restoreConfig.files.length === 0) {
        console.error('❌ Nothing to restore: no databases or files configured.')
        console.error('💡 Configure files/databases in your backup configuration file.')
        process.exit(1)
      }

      const manager = new RestoreManager(restoreConfig, {
        only: toArray(options?.only),
        snapshot: options?.snapshot,
        targetPath: options?.target,
        overwrite: options?.overwrite,
        verbose: options?.verbose,
      })
      const summary = await manager.restore()

      if (summary.failureCount > 0)
        process.exit(1)
    }
    catch (error) {
      console.error('❌ Restore process failed:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

cli.command('version', 'Show the version of the CLI').action(() => {
  console.log(version)
})

cli.version(version)
cli.help()
cli.parse()
