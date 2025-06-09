import type { BackupConfig } from './src/types'

const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',
  retention: {
    count: 5,
    maxAge: 30,
  },
  databases: [
    // SQLite example
    {
      type: 'sqlite',
      name: 'app-database',
      path: './database.sqlite',
      compress: false,
    },

    // PostgreSQL examples
    {
      type: 'postgresql',
      name: 'main-postgres',
      connection: 'postgres://user:password@localhost:5432/myapp',
      includeSchema: true,
      includeData: true,
      // tables: ['users', 'orders'], // Optional: backup specific tables
      // excludeTables: ['logs', 'temp'], // Optional: exclude tables
    },
    {
      type: 'postgresql',
      name: 'analytics-postgres',
      connection: {
        hostname: 'localhost',
        port: 5432,
        database: 'analytics',
        username: 'analytics_user',
        password: 'secret',
        ssl: 'prefer',
      },
      includeSchema: true,
      includeData: true,
    },

    // MySQL example (placeholder - coming soon to Bun!)
    {
      type: 'mysql',
      name: 'legacy-mysql',
      connection: {
        hostname: 'localhost',
        port: 3306,
        database: 'legacy_app',
        username: 'mysql_user',
        password: 'secret',
        ssl: false,
      },
      includeSchema: true,
      includeData: true,
      excludeTables: ['sessions', 'cache'],
    },
  ],
}

export default config
