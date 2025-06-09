import process from 'node:process'
import { CAC } from 'cac'
import { version } from '../package.json'
import { BackupManager } from '../src/backups'
import { config } from '../src/config'

const cli = new CAC('backups')

interface CliOption {
  verbose: boolean
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

      if (backupConfig.databases.length === 0) {
        console.error('❌ No databases configured for backup.')
        console.error('💡 Please configure databases in your backup configuration file.')
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

cli.command('version', 'Show the version of the CLI').action(() => {
  console.log(version)
})

cli.version(version)
cli.help()
cli.parse()
