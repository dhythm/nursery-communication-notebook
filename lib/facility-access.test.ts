import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from './db'
import { canAccessFacility } from './facility-access'
import { users } from './mock-data'
import { seedNotebook } from './repository'

let database: Database
const parent = users.find((user) => user.role === 'parent')!

beforeAll(async () => {
  database = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await migrateDatabase(database)
  await seedNotebook(database)
})

afterAll(async () => database.close())

describe('facility URL authorization', () => {
  it('accepts only the slug and role in the active membership', async () => {
    await expect(canAccessFacility(database, parent, 'nijiiro', 'parent')).resolves.toBe(true)
    await expect(canAccessFacility(database, parent, 'himawari', 'parent')).resolves.toBe(false)
    await expect(canAccessFacility(database, parent, 'nijiiro', 'teacher')).resolves.toBe(false)
  })

  it('does not trust a facility id supplied by the identity alone', async () => {
    await expect(
      canAccessFacility(
        database,
        { ...parent, facilityId: 'f2', facilitySlug: 'himawari' },
        'himawari',
        'parent',
      ),
    ).resolves.toBe(false)
  })
})
