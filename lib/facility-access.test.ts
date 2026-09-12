import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from './db'
import { canAccessChild, canAccessFacility } from './facility-access'
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

  it('allows a parent to open only children linked in the active facility', async () => {
    await expect(canAccessChild(database, parent, 'c1')).resolves.toBe(true)
    await expect(canAccessChild(database, parent, 'c3')).resolves.toBe(false)

    await database.query(
      `INSERT INTO child (id, facility_id, name, kana, birthday, avatar_color, allergies, notes)
       VALUES ('child-other-facility', 'f2', '他園 園児', 'たえん えんじ', '2022-01-01',
               'oklch(0.7 0.1 200)', ARRAY[]::text[], '')`,
    )
    await expect(canAccessChild(database, parent, 'child-other-facility')).resolves.toBe(false)
  })

  it('rejects a child after the guardian link has ended', async () => {
    await database.query(
      `UPDATE guardian_child SET ended_on = '2026-09-12'
       WHERE guardian_user_id = $1 AND child_id = $2`,
      [parent.id, 'c2'],
    )

    await expect(canAccessChild(database, parent, 'c2')).resolves.toBe(false)
  })
})
