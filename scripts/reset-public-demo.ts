import { loadEnvConfig } from '@next/env'
import { createDatabase } from '../lib/db'
import { resetPublicDemoDatabase } from '../lib/demo-reset'

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required')

  const database = await createDatabase({
    databaseProvider: 'postgres',
    databaseUrl,
    pgliteDataDir: 'memory://',
  })
  try {
    await resetPublicDemoDatabase(database, process.env.DEMO_RESET_CONFIRM ?? '')
  } finally {
    await database.close()
  }
  console.log('Public demo database reset completed.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Public demo database reset failed')
  process.exitCode = 1
})
