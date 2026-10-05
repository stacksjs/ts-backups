import { chmodSync } from 'node:fs'
import process from 'node:process'
import { dts } from 'bun-plugin-dtsx'

// eslint-disable-next-line ts/no-top-level-await
const library = await Bun.build({
  entrypoints: ['src/index.ts'],
  outdir: './dist',
  target: 'bun',
  plugins: [dts()],
})

// The CLI that package.json's `bin` points at (`backup` and `ts-backups`).
// Bundled on its own, so the installed command needs nothing beyond Bun.
// eslint-disable-next-line ts/no-top-level-await
const cli = await Bun.build({
  entrypoints: ['bin/cli.ts'],
  outdir: './dist/bin',
  target: 'bun',
  banner: '#!/usr/bin/env bun',
})

for (const result of [library, cli]) {
  if (!result.success) {
    for (const log of result.logs)
      console.error(log)
    process.exit(1)
  }
}

chmodSync('./dist/bin/cli.js', 0o755)
