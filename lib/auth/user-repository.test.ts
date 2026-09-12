import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from '@/lib/db'
import { seedNotebook } from '@/lib/repository'
import { authenticateCredentials, setUserPassword } from './user-repository'

let database: Database

beforeEach(async () => {
  database = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await migrateDatabase(database)
  await seedNotebook(database)
})

afterEach(async () => database.close())

describe('authentication user repository', () => {
  it('authenticates a provisioned Auth.js password and rejects other credentials', async () => {
    expect(await setUserPassword(database, 'sakura@example.com', 'a secure nursery password')).toBe(
      true,
    )
    await expect(
      authenticateCredentials(database, 'SAKURA@example.com', 'a secure nursery password'),
    ).resolves.toMatchObject({ id: 'u1', role: 'parent' })
    await expect(
      authenticateCredentials(database, 'sakura@example.com', 'wrong password'),
    ).resolves.toBeNull()
    await expect(
      authenticateCredentials(database, 'nobody@example.com', 'a secure nursery password'),
    ).resolves.toBeNull()
  })

  it('temporarily locks a password after five failed attempts', async () => {
    await setUserPassword(database, 'sakura@example.com', 'a secure nursery password')
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authenticateCredentials(database, 'sakura@example.com', 'wrong password')
    }

    await expect(
      authenticateCredentials(database, 'sakura@example.com', 'a secure nursery password'),
    ).resolves.toBeNull()
    expect(
      (
        await database.query<{ locked: boolean }>(
          'SELECT locked_until > now() AS locked FROM user_password WHERE user_id = $1',
          ['u1'],
        )
      ).rows,
    ).toEqual([{ locked: true }])
  })
})
