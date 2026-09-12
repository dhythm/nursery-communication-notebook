import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from '@/lib/db'
import { seedNotebook } from '@/lib/repository'
import { resolveClerkUser } from './clerk-user'

let database: Database

beforeAll(async () => {
  database = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await migrateDatabase(database)
  await seedNotebook(database)
  await database.query(`UPDATE app_user SET external_subject = NULL WHERE id = 'u1'`)
}, 20_000)

afterAll(async () => database?.close())

describe('Clerk user mapping', () => {
  it('claims a pre-registered account using a verified email address', async () => {
    await expect(
      resolveClerkUser(database, 'clerk-parent', 'SAKURA@example.com'),
    ).resolves.toMatchObject({
      id: 'u1',
      role: 'parent',
      facilityId: 'f1',
      facilitySlug: 'nijiiro',
    })
    expect(
      (await database.query(`SELECT external_subject FROM app_user WHERE id = 'u1'`)).rows,
    ).toEqual([{ external_subject: 'clerk-parent' }])
  })

  it('resolves subsequent requests without another email lookup', async () => {
    await expect(resolveClerkUser(database, 'clerk-parent')).resolves.toMatchObject({ id: 'u1' })
  })

  it('does not claim unknown or unverified accounts', async () => {
    await expect(resolveClerkUser(database, 'unknown')).resolves.toBeNull()
    await expect(resolveClerkUser(database, 'unknown', 'nobody@example.com')).resolves.toBeNull()
  })
})
