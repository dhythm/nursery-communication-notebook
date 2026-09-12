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
    expect(await checkDatabase(database)).toEqual({ migrationVersion: 12, seeded: false })
    await seedDatabase(database)
    await seedDatabase(database)
    expect(await checkDatabase(database)).toEqual({ migrationVersion: 12, seeded: true })
    expect((await database.query('SELECT id, name, slug FROM facility')).rows).toEqual([
      { id: 'sample-facility', name: 'サンプル保育園', slug: 'sample-nursery' },
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
        await transaction.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
          'failed',
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
    await database.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
      'input',
      'input',
      name,
    ])
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
      { version: 4 },
      { version: 5 },
      { version: 6 },
      { version: 7 },
      { version: 8 },
      { version: 9 },
      { version: 10 },
      { version: 11 },
      { version: 12 },
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
    expect(await checkDatabase(reopened)).toEqual({ migrationVersion: 12, seeded: true })
  }, 20_000)

  it('creates missing parent directories for a persistent database', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'nursery-pglite-parent-'))
    directories.push(directory)
    const database = await openDatabase(join(directory, 'missing-parent', 'pglite'))
    await migrateDatabase(database)
    await seedDatabase(database)
    expect(await checkDatabase(database)).toEqual({ migrationVersion: 12, seeded: true })
  }, 20_000)

  it('fails readiness checks before migrations have run', async () => {
    const database = await openDatabase()
    await expect(checkDatabase(database)).rejects.toThrow()
  }, 20_000)

  it('requires a unique URL-safe facility slug', async () => {
    const database = await openDatabase()
    await migrateDatabase(database)
    await database.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
      'facility-a',
      'safe-nursery',
      'A園',
    ])
    await expect(
      database.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
        'facility-b',
        'safe-nursery',
        'B園',
      ]),
    ).rejects.toThrow()
    await expect(
      database.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
        'facility-c',
        '../unsafe',
        'C園',
      ]),
    ).rejects.toThrow()
  }, 20_000)

  it('enforces normalized child enrollment references and one current class', async () => {
    const database = await openDatabase()
    await migrateDatabase(database)
    await database.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
      'facility-a',
      'facility-a',
      'A園',
    ])
    await database.query('INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3)', [
      'facility-b',
      'facility-b',
      'B園',
    ])
    await database.query('INSERT INTO nursery_class (id, facility_id, name) VALUES ($1, $2, $3)', [
      'class-a',
      'facility-a',
      'A組',
    ])
    await database.query(
      `INSERT INTO child
       (id, facility_id, name, kana, birthday, avatar_color)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      ['child-a', 'facility-a', '園児 A', 'えんじ えー', '2022-01-01', 'red'],
    )
    await expect(
      database.query(
        `INSERT INTO child_enrollment (id, facility_id, child_id, class_id)
         VALUES ($1, $2, $3, $4)`,
        ['wrong-facility', 'facility-b', 'child-a', 'class-a'],
      ),
    ).rejects.toThrow()
    await database.query(
      `INSERT INTO child_enrollment (id, facility_id, child_id, class_id)
       VALUES ($1, $2, $3, $4)`,
      ['current-a', 'facility-a', 'child-a', 'class-a'],
    )
    await expect(
      database.query(
        `INSERT INTO child_enrollment (id, facility_id, child_id, class_id)
         VALUES ($1, $2, $3, $4)`,
        ['current-b', 'facility-a', 'child-a', 'class-a'],
      ),
    ).rejects.toThrow()
  }, 20_000)

  it('backfills facilities, children, classes, and enrollment from a version 3 database', async () => {
    const database = await openDatabase()
    await database.query(
      'CREATE TABLE schema_migration (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    )
    await database.query('CREATE TABLE facility (id text PRIMARY KEY, name text NOT NULL)')
    await database.query(
      'CREATE TABLE app_record (id text PRIMARY KEY, kind text NOT NULL, data jsonb NOT NULL)',
    )
    await database.query(
      `CREATE TABLE mutation_receipt (
        actor_id text NOT NULL,
        command_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (actor_id, command_id)
      )`,
    )
    for (const version of [1, 2, 3]) {
      await database.query('INSERT INTO schema_migration (version) VALUES ($1)', [version])
    }
    await database.query('INSERT INTO app_record (id, kind, data) VALUES ($1, $2, $3)', [
      'facilities:legacy',
      'facilities',
      JSON.stringify({ id: 'legacy', name: '既存園', logoColor: 'green' }),
    ])
    await database.query('INSERT INTO app_record (id, kind, data) VALUES ($1, $2, $3)', [
      'children:legacy-child',
      'children',
      JSON.stringify({
        id: 'legacy-child',
        facilityId: 'legacy',
        name: '既存 園児',
        kana: 'きぞん えんじ',
        className: '既存組',
        birthday: '2022-02-03',
        avatarColor: 'blue',
        allergies: ['卵'],
        notes: '引き継ぐメモ',
      }),
    ])

    await migrateDatabase(database)
    expect(
      (
        await database.query(
          `SELECT child.id, nursery_class.name AS class_name
           FROM child
           JOIN child_enrollment ON child_enrollment.child_id = child.id
           JOIN nursery_class ON nursery_class.id = child_enrollment.class_id`,
        )
      ).rows,
    ).toEqual([{ id: 'legacy-child', class_name: '既存組' }])
    expect(await checkDatabase(database)).toEqual({ migrationVersion: 12, seeded: false })
  }, 20_000)

  it('creates constrained workflow, notification, audit, and file tables', async () => {
    const database = await openDatabase()
    await migrateDatabase(database)
    const tables = await database.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])
       ORDER BY table_name`,
      [
        [
          'app_notification',
          'audit_log',
          'calendar_event',
          'file_object',
          'notebook_entry',
          'notice',
          'notification_outbox',
          'notification_preference',
        ],
      ],
    )
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      'app_notification',
      'audit_log',
      'calendar_event',
      'file_object',
      'notebook_entry',
      'notice',
      'notification_outbox',
      'notification_preference',
    ])
  }, 20_000)
})
