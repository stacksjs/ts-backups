# Installation

Installing backupx is straightforward. Choose your preferred installation method below.

## Package Managers

Install backupx using your favorite package manager:

::: code-group

```sh [bun]
# Install as dependency
bun add backupx

# Install globally for CLI usage
bun add -g backupx
```

```sh [npm]
# Install as dependency
npm install backupx

# Install globally for CLI usage
npm install -g backupx
```

```sh [pnpm]
# Install as dependency
pnpm add backupx

# Install globally for CLI usage
pnpm add -g backupx
```

```sh [yarn]
# Install as dependency
yarn add backupx

# Install globally for CLI usage
yarn global add backupx
```

:::

## Precompiled Binaries

For environments where you can't install Node.js/Bun packages, use our precompiled binaries:

::: code-group

```sh [macOS (Apple Silicon)]
# Download and install
curl -L https://github.com/stacksjs/backupx/releases/latest/download/backups-darwin-arm64 -o backups
chmod +x backups
sudo mv backups /usr/local/bin/
```

```sh [macOS (Intel)]
# Download and install
curl -L https://github.com/stacksjs/backupx/releases/latest/download/backups-darwin-x64 -o backups
chmod +x backups
sudo mv backups /usr/local/bin/
```

```sh [Linux (ARM64)]
# Download and install
curl -L https://github.com/stacksjs/backupx/releases/latest/download/backups-linux-arm64 -o backups
chmod +x backups
sudo mv backups /usr/local/bin/
```

```sh [Linux (x64)]
# Download and install
curl -L https://github.com/stacksjs/backupx/releases/latest/download/backups-linux-x64 -o backups
chmod +x backups
sudo mv backups /usr/local/bin/
```

```sh [Windows (x64)]
# Download the binary
curl -L https://github.com/stacksjs/backupx/releases/latest/download/backups-windows-x64.exe -o backups.exe

# Move to your PATH (adjust path as needed)
move backups.exe C:\Windows\System32\backups.exe
```

:::

## Requirements

### Runtime Requirements

- **Bun**: v1.0.0 or later (recommended)
- **Node.js**: v18.0.0 or later (alternative runtime)

### Database Requirements

The following databases are supported with their respective requirements:

#### SQLite
- No additional requirements (built into Bun)
- Database file must be accessible

#### PostgreSQL
- PostgreSQL server running (any supported version)
- Network access to the database
- Valid credentials

#### MySQL
- MySQL/MariaDB server running
- Network access to the database
- Valid credentials

## Verification

After installation, verify backupx is working correctly:

### Check Version

```sh
# If installed globally
backups --version

# If using npx/bunx
bunx backupx --version
```

### Test Basic Functionality

```sh
# Display help
backups --help

# Test with a minimal configuration
echo 'export default { verbose: false, databases: [], files: [] }' > test-config.ts
backups start --verbose
```

## Configuration Setup

After installation, you'll need to create a configuration file. backupx looks for configuration in the following locations (in order of precedence):

1. `backups.config.ts` (TypeScript configuration)
2. `backups.config.js` (JavaScript configuration)
3. `backups.config.json` (JSON configuration)

### Create Your First Configuration

Create a `backups.config.ts` file in your project root:

```ts
// backups.config.ts
import { BackupConfig, BackupType } from 'backupx'

const config: BackupConfig = {
  verbose: true,
  outputPath: './backups',

  // Database backups
  databases: [
    {
      type: BackupType.SQLITE,
      name: 'my-app',
      path: './database.sqlite',
      compress: true,
    }
  ],

  // File backups
  files: [
    {
      name: 'uploads',
      path: './public/uploads',
      compress: true,
      exclude: ['*.tmp', '*.log']
    }
  ],

  // Retention policy
  retention: {
    count: 7, // Keep 7 backups
    maxAge: 30 // Delete backups older than 30 days
  }
}

export default config
```

### Test Your Configuration

```sh
# Run backup with your configuration
backups start --verbose
```

## Development Installation

If you want to contribute to backupx or run from source:

```sh
# Clone the repository
git clone https://github.com/stacksjs/backupx.git
cd backupx

# Install dependencies
bun install

# Build the project
bun run build

# Run tests
bun test

# Start development
bun run dev
```

## Docker Usage

You can also use backupx in a Docker container:

```dockerfile
FROM oven/bun:1

WORKDIR /app

# Install backupx
RUN bun add -g backupx

# Copy your configuration
COPY backups.config.ts .

# Run backups
CMD ["backups", "start", "--verbose"]
```

## Troubleshooting

### Common Issues

#### Permission Errors

If you encounter permission errors:

```sh
# On macOS/Linux
sudo chown -R $(whoami) /usr/local/bin/backupx

# Or install to user directory
npm config set prefix ~/.local
# Then add ~/.local/bin to your PATH
```

#### Bun Not Found

If Bun is not found:

```sh
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Restart your terminal or source profile
source ~/.bashrc  # or ~/.zshrc
```

#### Database Connection Issues

For database connectivity problems:

1. Verify database server is running
2. Check connection credentials
3. Ensure network access
4. Test connection manually first

### Getting Help

If you encounter issues:

1. Check our [GitHub Issues](https://github.com/stacksjs/backupx/issues)
2. Join our [Discord Community](https://discord.gg/stacksjs)
3. Review the [Configuration Reference](/config) guide

## Next Steps

Now that backupx is installed, check out:

- [Quick Start Guide](/usage) - Get backing up immediately
- [Configuration Reference](/config) - Detailed configuration options
- [Features Overview](/features/database-backups) - Explore all features
