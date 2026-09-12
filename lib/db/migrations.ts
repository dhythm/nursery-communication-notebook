import type { Database } from './index'

const migrations = [
  {
    version: 1,
    sql: 'CREATE TABLE facility (id text PRIMARY KEY, name text NOT NULL)',
  },
  {
    version: 2,
    // Temporary domain storage for the development demo; replace with domain tables.
    sql: 'CREATE TABLE app_record (id text PRIMARY KEY, kind text NOT NULL, data jsonb NOT NULL)',
  },
  {
    version: 3,
    sql: `CREATE TABLE mutation_receipt (
      actor_id text NOT NULL,
      command_id text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (actor_id, command_id)
    )`,
  },
]

export async function migrateDatabase(database: Database): Promise<void> {
  await database.transaction(async (transaction) => {
    // Serialize even the initial tracking-table creation across PostgreSQL clients.
    await transaction.query('SELECT pg_advisory_xact_lock(72510431)')
    await transaction.query(`
      CREATE TABLE IF NOT EXISTS schema_migration (
        version integer PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    const { rows } = await transaction.query<{ version: number }>(
      'SELECT version FROM schema_migration ORDER BY version',
    )
    for (const migration of migrations) {
      if (rows.some((row) => row.version === migration.version)) continue
      await transaction.query(migration.sql)
      await transaction.query('INSERT INTO schema_migration (version) VALUES ($1)', [
        migration.version,
      ])
    }
  })
}

export async function seedDatabase(database: Database): Promise<void> {
  await database.query(
    'INSERT INTO facility (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
    ['sample-facility', 'サンプル保育園'],
  )
}

export async function checkDatabase(database: Database) {
  const { rows } = await database.query<{ migration_version: number; seeded: boolean }>(
    `SELECT
      COALESCE((SELECT MAX(version) FROM schema_migration), 0) AS migration_version,
      EXISTS(SELECT 1 FROM facility WHERE id = $1) AS seeded`,
    ['sample-facility'],
  )
  return { migrationVersion: rows[0].migration_version, seeded: rows[0].seeded }
}
