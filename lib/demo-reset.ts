import type { Database } from './db'
import { migrateDatabase, seedDatabase } from './db'
import { setUserPassword } from './auth/user-repository'
import * as seed from './mock-data'
import { publicDemoAccounts } from './public-demo'
import { seedNotebook } from './repository'

export { publicDemoAccounts } from './public-demo'

export const publicDemoResetConfirmation = 'RESET_NURSERY_PUBLIC_DEMO'

const demoFacilityIds = [...seed.facilities.map(({ id }) => id), 'sample-facility']

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`
}

export async function resetPublicDemoDatabase(database: Database, confirmation: string) {
  if (confirmation !== publicDemoResetConfirmation) {
    throw new Error('Public demo reset confirmation is invalid')
  }

  await migrateDatabase(database)
  const unexpectedFacility = await database.query<{ id: string }>(
    'SELECT id FROM facility WHERE NOT (id = ANY($1::text[])) LIMIT 1',
    [demoFacilityIds],
  )
  if (unexpectedFacility.rows.length) {
    throw new Error('Refusing to reset a database containing a non-demo facility')
  }

  await database.transaction(async (transaction) => {
    await transaction.query('SELECT pg_advisory_xact_lock(72510432)')
    const { rows } = await transaction.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
         AND table_name <> 'schema_migration'
       ORDER BY table_name`,
    )
    if (rows.length) {
      await transaction.query(
        `TRUNCATE TABLE ${rows.map(({ table_name }) => quoteIdentifier(table_name)).join(', ')} CASCADE`,
      )
    }

    const transactionalDatabase: Database = {
      query: (sql, params) => transaction.query(sql, params),
      transaction: (callback) => callback(transaction),
      close: async () => {},
    }
    await seedDatabase(transactionalDatabase)
    await seedNotebook(transactionalDatabase)
    for (const account of publicDemoAccounts) {
      if (!(await setUserPassword(transactionalDatabase, account.email, account.password))) {
        throw new Error(`Public demo account is missing: ${account.email}`)
      }
    }
  })
}
