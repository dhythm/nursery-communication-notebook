import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase, migrateDatabase, type Database } from './db'
import {
  publicDemoAccounts,
  publicDemoResetConfirmation,
  resetPublicDemoDatabase,
} from './demo-reset'
import { authenticateCredentials } from './auth/user-repository'
import * as seed from './mock-data'

let database: Database

beforeEach(async () => {
  database = await createDatabase({ databaseProvider: 'pglite', pgliteDataDir: 'memory://' })
  await migrateDatabase(database)
})

afterEach(async () => database.close())

describe('resetPublicDemoDatabase', () => {
  it('refuses to change data without the exact confirmation value', async () => {
    await database.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
      'keep-me',
      'keep-me',
      '削除禁止園',
    ])

    await expect(resetPublicDemoDatabase(database, 'wrong')).rejects.toThrow('confirmation')
    expect((await database.query('SELECT id FROM facility')).rows).toEqual([{ id: 'keep-me' }])
  })

  it('refuses to reset a database containing a facility outside the demo dataset', async () => {
    await database.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
      'real-facility',
      'real-facility',
      '実運用園',
    ])

    await expect(resetPublicDemoDatabase(database, publicDemoResetConfirmation)).rejects.toThrow(
      'non-demo facility',
    )
  })

  it('replaces updates with seed data and restores both public demo logins', async () => {
    await resetPublicDemoDatabase(database, publicDemoResetConfirmation)
    await database.query('UPDATE facility SET name=$2 WHERE id=$1', ['f1', '変更された園名'])
    await database.query(
      `INSERT INTO message
       (id, facility_id, child_id, sender_user_id, sender_role, sender_name, body, sent_at)
       VALUES ($1, $2, $3, $4, 'parent', $5, $6, now())`,
      ['visitor-message', 'f1', 'c1', 'u1', '来訪者', 'リセット対象'],
    )

    await resetPublicDemoDatabase(database, publicDemoResetConfirmation)

    expect((await database.query('SELECT name FROM facility WHERE id=$1', ['f1'])).rows).toEqual([
      { name: 'にじいろ保育園' },
    ])
    expect(
      (await database.query<{ count: number }>('SELECT count(*)::int AS count FROM child')).rows,
    ).toEqual([{ count: 60 }])
    expect(
      (await database.query('SELECT id FROM message WHERE id=$1', ['visitor-message'])).rows,
    ).toEqual([])
    expect(
      (await database.query<{ count: number }>('SELECT count(*)::int AS count FROM message')).rows,
    ).toEqual([{ count: seed.messages.length }])

    for (const account of publicDemoAccounts) {
      await expect(
        authenticateCredentials(database, account.email, account.password),
      ).resolves.toMatchObject({ email: account.email, role: account.role })
    }
  })
})
