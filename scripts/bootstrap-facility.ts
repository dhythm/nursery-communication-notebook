import { loadEnvConfig } from '@next/env'
import { createDatabase, migrateDatabase } from '../lib/db'
import { provisionFacility } from '../lib/provisioning'
import { getRuntimeConfig } from '../lib/runtime-config'

async function main() {
  loadEnvConfig(process.cwd(), false)
  const database = await createDatabase(getRuntimeConfig())
  try {
    await migrateDatabase(database)
    const result = await provisionFacility(database, {
      facilitySlug: process.env.BOOTSTRAP_FACILITY_SLUG ?? '',
      facilityName: process.env.BOOTSTRAP_FACILITY_NAME ?? '',
      managerName: process.env.BOOTSTRAP_MANAGER_NAME ?? '',
      managerEmail: process.env.BOOTSTRAP_MANAGER_EMAIL ?? '',
    })
    console.log({ ok: true, ...result })
  } finally {
    await database.close()
  }
}

main().catch(() => {
  console.error(
    'Facility provisioning failed. Check the bootstrap values, database connection, and existing slug or email.',
  )
  process.exitCode = 1
})
