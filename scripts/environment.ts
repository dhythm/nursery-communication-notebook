import { spawn } from 'node:child_process'
import { loadEnvConfig } from '@next/env'
import { createDatabase, migrateDatabase, seedDatabase, checkDatabase } from '../lib/db'
import { shouldSeedDemoData } from '../lib/demo-data-policy'
import { getRuntimeConfig } from '../lib/runtime-config'
import { seedNotebook } from '../lib/repository'

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')
  const [profile, command, ...args] = process.argv.slice(2)
  if (profile !== 'agent' && profile !== 'local' && profile !== 'configured') {
    throw new Error('Usage: environment.ts <agent|local|configured> <setup|check|dev|build|start>')
  }
  if (profile !== 'configured') {
    process.env.APP_ENV = 'development'
    process.env.AUTH_MODE = 'skip'
    process.env.DATABASE_PROVIDER = profile === 'agent' ? 'pglite' : 'postgres'
    process.env.FILE_STORAGE_PROVIDER = 'local'
    if (profile === 'local') {
      process.env.DATABASE_URL ||= 'postgresql://nursery:nursery_local@127.0.0.1:54329/nursery'
    }
  }
  const config = getRuntimeConfig()
  if (!['setup', 'check', 'dev', 'build', 'start'].includes(command)) {
    throw new Error('Unknown environment command')
  }
  if (command === 'setup' || command === 'check' || command === 'dev') {
    if (config.databaseProvider === 'pglite' && config.pgliteDataDir === 'memory://') {
      throw new Error(
        'Use a persistent PGLITE_DATA_DIR for CLI/server; memory:// is for isolated tests',
      )
    }
    const database = await createDatabase(config)
    try {
      if (command !== 'check') {
        await migrateDatabase(database)
        if (shouldSeedDemoData(config.appEnv)) {
          await seedDatabase(database)
          await seedNotebook(database)
        }
      }
      console.log({ provider: config.databaseProvider, ...(await checkDatabase(database)) })
    } finally {
      await database.close()
    }
  }
  if (command === 'dev' || command === 'build' || command === 'start') {
    const child = spawn('pnpm', ['exec', 'next', command, ...args], {
      stdio: 'inherit',
      env: process.env,
    })
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.on(signal, () => child.kill(signal))
    }
    child.on('error', () => {
      console.error('Could not start Next.js')
      process.exitCode = 1
    })
    child.on('exit', (code) => {
      process.exitCode = code ?? 1
    })
  }
}

main().catch(() => {
  console.error(
    'Environment setup failed. Check environment values, database availability, and stop other PGlite processes before running setup.',
  )
  process.exitCode = 1
})
