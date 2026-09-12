import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  checkDatabase,
  createDatabase,
  migrateDatabase,
  seedDatabase,
  type Database,
} from './index'

const databases: Database[] = []
const directories: string[] = []

async function openDatabase(pgliteDataDir = 'memory://') {
  const database = await createDatabase({
    databaseProvider: 'pglite',
    pgliteDataDir,
  })
  databases.push(database)
  return database
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.close()))
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe('PGlite database', () => {
  it('applies migrations and seed repeatedly without duplicating data', async () => {
    const database = await openDatabase()
    await migrateDatabase(database)
    await migrateDatabase(database)
    expect(await checkDatabase(database)).toEqual({ migrationVersion: 3, seeded: false })
    await seedDatabase(database)
    await seedDatabase(database)
    expect(await checkDatabase(database)).toEqual({ migrationVersion: 3, seeded: true })
    expect((await database.query('SELECT * FROM facility')).rows).toEqual([
      { id: 'sample-facility', name: 'サンプル保育園' },
    ])
  }, 20_000)

  it('stores JSON records for the development demo', async () => {
    const database = await openDatabase()
    await migrateDatabase(database)
    await database.query('INSERT INTO app_record (id, kind, data) VALUES ($1, $2, $3)', [
      'record-1',
      'child',
      JSON.stringify({ name: 'Sample', active: true }),
    ])
    expect(
      (await database.query('SELECT data FROM app_record WHERE id = $1', ['record-1'])).rows,
    ).toEqual([{ data: { name: 'Sample', active: true } }])
  }, 20_000)

  it('rolls back failed transactions and permits subsequent writes', async () => {
    const database = await openDatabase()
    await migrateDatabase(database)
    await expect(
      database.transaction(async (transaction) => {
        await transaction.query('INSERT INTO facility (id, name) VALUES ($1, $2)', [
          'failed',
          '失敗',
        ])
        throw new Error('Abort')
      }),
    ).rejects.toThrow('Abort')
    expect((await database.query('SELECT * FROM facility')).rows).toEqual([])
    await seedDatabase(database)
    expect((await checkDatabase(database)).seeded).toBe(true)
  }, 20_000)

  it('binds input as data, including SQL-looking text', async () => {
    const database = await openDatabase()
    await migrateDatabase(database)
    const name = "'); DROP TABLE facility; --"
    await database.query('INSERT INTO facility (id, name) VALUES ($1, $2)', ['input', name])
    expect(
      (await database.query('SELECT name FROM facility WHERE id = $1', ['input'])).rows,
    ).toEqual([{ name }])
  }, 20_000)

  it('serializes concurrent migrations', async () => {
    const database = await openDatabase()
    await Promise.all([migrateDatabase(database), migrateDatabase(database)])
    expect((await database.query('SELECT version FROM schema_migration')).rows).toEqual([
      { version: 1 },
      { version: 2 },
      { version: 3 },
    ])
  }, 20_000)

  it('persists records across closing and reopening the database', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nursery-pglite-'))
    directories.push(directory)
    const database = await openDatabase(directory)
    await migrateDatabase(database)
    await seedDatabase(database)
    await database.close()
    const reopened = await openDatabase(directory)
    expect(await checkDatabase(reopened)).toEqual({ migrationVersion: 3, seeded: true })
  }, 20_000)

  it('creates missing parent directories for a persistent database', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nursery-pglite-parent-'))
    directories.push(directory)
    const database = await openDatabase(join(directory, 'missing-parent', 'pglite'))
    await migrateDatabase(database)
    await seedDatabase(database)
    expect(await checkDatabase(database)).toEqual({ migrationVersion: 3, seeded: true })
  }, 20_000)

  it('fails readiness checks before migrations have run', async () => {
    const database = await openDatabase()
    await expect(checkDatabase(database)).rejects.toThrow()
  }, 20_000)
})
