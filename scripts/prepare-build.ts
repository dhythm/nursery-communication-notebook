import { loadEnvConfig } from '@next/env'
import { createDatabase } from '../lib/db'
import { isPublicDemoProductionDeployment } from '../lib/demo-deployment'
import { publicDemoResetConfirmation, resetPublicDemoDatabase } from '../lib/demo-reset'

async function main() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')
  if (!isPublicDemoProductionDeployment(process.env)) return

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the public demo deployment')
  const database = await createDatabase({
    databaseProvider: 'postgres',
    databaseUrl,
    pgliteDataDir: 'memory://',
  })
  try {
    await resetPublicDemoDatabase(database, publicDemoResetConfirmation)
  } finally {
    await database.close()
  }
  console.log('Public demo database reset completed before the production build.')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Public demo build preparation failed')
  process.exitCode = 1
})
