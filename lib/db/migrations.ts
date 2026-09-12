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
  {
    version: 4,
    sql: `
      ALTER TABLE facility
        ADD COLUMN logo_color text NOT NULL DEFAULT 'oklch(0.67 0.13 158)',
        ADD COLUMN time_zone text NOT NULL DEFAULT 'Asia/Tokyo',
        ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

      CREATE TABLE app_user (
        id text PRIMARY KEY,
        name text NOT NULL,
        email text NOT NULL UNIQUE,
        external_subject text UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE facility_membership (
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
        role text NOT NULL CHECK (role IN ('parent', 'teacher')),
        job_title text,
        access_scope text NOT NULL CHECK (access_scope IN ('linked_children', 'facility')),
        started_on date,
        ended_on date,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (facility_id, user_id, role),
        CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
      );

      CREATE TABLE nursery_class (
        id text PRIMARY KEY,
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        name text NOT NULL,
        school_year smallint,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (facility_id, id),
        UNIQUE (facility_id, name, school_year)
      );

      CREATE TABLE child (
        id text PRIMARY KEY,
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        name text NOT NULL,
        kana text NOT NULL,
        birthday date NOT NULL,
        avatar_color text NOT NULL,
        allergies text[] NOT NULL DEFAULT ARRAY[]::text[],
        notes text NOT NULL DEFAULT '',
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        admitted_on date,
        withdrawn_on date,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (facility_id, id),
        CHECK (withdrawn_on IS NULL OR admitted_on IS NULL OR withdrawn_on >= admitted_on)
      );

      CREATE TABLE child_enrollment (
        id text PRIMARY KEY,
        facility_id text NOT NULL,
        child_id text NOT NULL,
        class_id text NOT NULL,
        started_on date,
        ended_on date,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (facility_id, child_id) REFERENCES child(facility_id, id) ON DELETE RESTRICT,
        FOREIGN KEY (facility_id, class_id) REFERENCES nursery_class(facility_id, id) ON DELETE RESTRICT,
        CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
      );
      CREATE UNIQUE INDEX child_enrollment_current
        ON child_enrollment(child_id) WHERE ended_on IS NULL;

      CREATE TABLE guardian_child (
        id text PRIMARY KEY,
        facility_id text NOT NULL,
        guardian_user_id text NOT NULL,
        guardian_role text NOT NULL DEFAULT 'parent' CHECK (guardian_role = 'parent'),
        child_id text NOT NULL,
        relationship text,
        started_on date,
        ended_on date,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (facility_id, guardian_user_id, guardian_role)
          REFERENCES facility_membership(facility_id, user_id, role) ON DELETE RESTRICT,
        FOREIGN KEY (facility_id, child_id) REFERENCES child(facility_id, id) ON DELETE RESTRICT,
        CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
      );
      CREATE UNIQUE INDEX guardian_child_current
        ON guardian_child(guardian_user_id, child_id) WHERE ended_on IS NULL;

      CREATE TABLE staff_class_assignment (
        id text PRIMARY KEY,
        facility_id text NOT NULL,
        staff_user_id text NOT NULL,
        staff_role text NOT NULL DEFAULT 'teacher' CHECK (staff_role = 'teacher'),
        class_id text NOT NULL,
        assignment_role text,
        started_on date,
        ended_on date,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (facility_id, staff_user_id, staff_role)
          REFERENCES facility_membership(facility_id, user_id, role) ON DELETE RESTRICT,
        FOREIGN KEY (facility_id, class_id) REFERENCES nursery_class(facility_id, id) ON DELETE RESTRICT,
        CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
      );
      CREATE UNIQUE INDEX staff_class_assignment_current
        ON staff_class_assignment(staff_user_id, class_id) WHERE ended_on IS NULL;

      CREATE INDEX child_facility ON child(facility_id, withdrawn_on);
      CREATE INDEX membership_user ON facility_membership(user_id, ended_on);
      CREATE INDEX enrollment_class ON child_enrollment(facility_id, class_id, ended_on);
      CREATE INDEX guardian_access ON guardian_child(guardian_user_id, ended_on);
      CREATE INDEX staff_assignment_access ON staff_class_assignment(staff_user_id, ended_on);

      INSERT INTO facility (id, name, logo_color)
      SELECT data->>'id', data->>'name', data->>'logoColor'
      FROM app_record WHERE kind = 'facilities'
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO nursery_class (id, facility_id, name)
      SELECT DISTINCT
        'legacy-class-' || md5((data->>'facilityId') || ':' || (data->>'className')),
        data->>'facilityId',
        data->>'className'
      FROM app_record WHERE kind = 'children'
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO child
        (id, facility_id, name, kana, birthday, avatar_color, allergies, notes, version, updated_at)
      SELECT
        data->>'id',
        data->>'facilityId',
        data->>'name',
        data->>'kana',
        (data->>'birthday')::date,
        data->>'avatarColor',
        ARRAY(SELECT jsonb_array_elements_text(data->'allergies')),
        COALESCE(data->>'notes', ''),
        COALESCE((data->>'version')::integer, 1),
        COALESCE((data->>'updatedAt')::timestamptz, now())
      FROM app_record WHERE kind = 'children'
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO child_enrollment (id, facility_id, child_id, class_id)
      SELECT
        'legacy-enrollment-' || (data->>'id'),
        data->>'facilityId',
        data->>'id',
        'legacy-class-' || md5((data->>'facilityId') || ':' || (data->>'className'))
      FROM app_record WHERE kind = 'children'
      ON CONFLICT (id) DO NOTHING;
    `,
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
      for (const statement of migration.sql
        .split(';')
        .map((sql) => sql.trim())
        .filter(Boolean)) {
        await transaction.query(statement)
      }
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
