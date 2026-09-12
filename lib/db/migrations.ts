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
  {
    version: 5,
    sql: `
      CREATE TABLE notebook_entry (
        id text PRIMARY KEY,
        facility_id text NOT NULL,
        child_id text NOT NULL,
        business_date date NOT NULL,
        author_user_id text REFERENCES app_user(id) ON DELETE RESTRICT,
        author_role text NOT NULL CHECK (author_role IN ('parent', 'teacher')),
        author_name text NOT NULL,
        mood text NOT NULL CHECK (mood IN ('genki', 'normal', 'tired', 'sick')),
        temperature numeric(3,1) NOT NULL CHECK (temperature BETWEEN 34 AND 42),
        meals text NOT NULL,
        nap text NOT NULL,
        toilet text NOT NULL,
        note text NOT NULL DEFAULT '',
        photo text,
        status text NOT NULL CHECK (status IN ('draft', 'published', 'withdrawn')),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        published_at timestamptz,
        withdrawn_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (facility_id, child_id) REFERENCES child(facility_id, id) ON DELETE RESTRICT
      );
      CREATE UNIQUE INDEX notebook_entry_active_day
        ON notebook_entry(child_id, business_date, author_role)
        WHERE status IN ('draft', 'published');
      CREATE INDEX notebook_entry_feed
        ON notebook_entry(facility_id, child_id, business_date DESC, status);

      CREATE TABLE notice (
        id text PRIMARY KEY,
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        title text NOT NULL,
        body text NOT NULL,
        category text NOT NULL CHECK (category IN ('重要', 'イベント', '保健', '給食', 'お願い')),
        pinned boolean NOT NULL DEFAULT false,
        requires_confirmation boolean NOT NULL DEFAULT false,
        target_type text NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'class')),
        target_class_id text,
        status text NOT NULL CHECK (status IN ('draft', 'published', 'withdrawn')),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        created_by_user_id text REFERENCES app_user(id) ON DELETE RESTRICT,
        updated_by_user_id text REFERENCES app_user(id) ON DELETE RESTRICT,
        published_on date,
        published_at timestamptz,
        withdrawn_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (facility_id, target_class_id) REFERENCES nursery_class(facility_id, id) ON DELETE RESTRICT,
        CHECK ((target_type = 'all' AND target_class_id IS NULL) OR
               (target_type = 'class' AND target_class_id IS NOT NULL))
      );
      CREATE INDEX notice_feed ON notice(facility_id, published_on DESC, status);

      CREATE TABLE notice_recipient (
        notice_id text NOT NULL REFERENCES notice(id) ON DELETE CASCADE,
        recipient_user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
        read_at timestamptz,
        confirmed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (notice_id, recipient_user_id)
      );

      CREATE TABLE calendar_event (
        id text PRIMARY KEY,
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        event_date date NOT NULL,
        title text NOT NULL,
        event_type text NOT NULL CHECK (event_type IN ('行事', '面談', '健診', '休園', '持ち物')),
        event_time time,
        memo text,
        target_type text NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'class')),
        target_class_id text,
        status text NOT NULL CHECK (status IN ('draft', 'published', 'cancelled')),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        created_by_user_id text REFERENCES app_user(id) ON DELETE RESTRICT,
        updated_by_user_id text REFERENCES app_user(id) ON DELETE RESTRICT,
        published_at timestamptz,
        cancelled_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (facility_id, target_class_id) REFERENCES nursery_class(facility_id, id) ON DELETE RESTRICT,
        CHECK ((target_type = 'all' AND target_class_id IS NULL) OR
               (target_type = 'class' AND target_class_id IS NOT NULL))
      );
      CREATE INDEX calendar_event_feed ON calendar_event(facility_id, event_date, status);

      CREATE TABLE notification_preference (
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
        category text NOT NULL CHECK (category IN ('notice', 'message', 'notebook')),
        enabled boolean NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (facility_id, user_id, category)
      );

      CREATE TABLE app_notification (
        id text PRIMARY KEY,
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        recipient_user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
        category text NOT NULL CHECK (category IN ('notice', 'message', 'notebook')),
        source_type text NOT NULL,
        source_id text NOT NULL,
        title text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        read_at timestamptz,
        UNIQUE (recipient_user_id, category, source_type, source_id)
      );
      CREATE INDEX app_notification_inbox
        ON app_notification(recipient_user_id, created_at DESC, read_at);

      CREATE TABLE notification_outbox (
        id text PRIMARY KEY,
        notification_id text NOT NULL UNIQUE REFERENCES app_notification(id) ON DELETE CASCADE,
        channel text NOT NULL DEFAULT 'in_app' CHECK (channel = 'in_app'),
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
        attempt_count integer NOT NULL DEFAULT 0,
        available_at timestamptz NOT NULL DEFAULT now(),
        processed_at timestamptz,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE audit_log (
        id text PRIMARY KEY,
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        actor_user_id text REFERENCES app_user(id) ON DELETE RESTRICT,
        actor_role text NOT NULL CHECK (actor_role IN ('parent', 'teacher', 'system')),
        action text NOT NULL,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        command_id text,
        before_data jsonb,
        after_data jsonb,
        occurred_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX audit_command_once
        ON audit_log(actor_user_id, command_id) WHERE command_id IS NOT NULL;
      CREATE INDEX audit_entity_history ON audit_log(facility_id, entity_type, entity_id, occurred_at);

      CREATE TABLE file_object (
        id text PRIMARY KEY,
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        storage_key text NOT NULL UNIQUE,
        original_name text NOT NULL,
        display_name text NOT NULL,
        content_type text NOT NULL,
        byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
        kind text NOT NULL CHECK (kind IN ('PDF', '画像', '文書')),
        purpose text NOT NULL DEFAULT 'shared' CHECK (purpose IN ('shared', 'notebook')),
        uploader_user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
        audience_type text NOT NULL CHECK (audience_type IN ('all', 'class', 'child')),
        target_class_id text,
        target_child_id text,
        command_id text NOT NULL,
        status text NOT NULL CHECK (status IN ('uploading', 'available', 'failed', 'deleted')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        FOREIGN KEY (facility_id, target_class_id) REFERENCES nursery_class(facility_id, id) ON DELETE RESTRICT,
        FOREIGN KEY (facility_id, target_child_id) REFERENCES child(facility_id, id) ON DELETE RESTRICT,
        UNIQUE (uploader_user_id, command_id),
        CHECK ((audience_type = 'all' AND target_class_id IS NULL AND target_child_id IS NULL) OR
               (audience_type = 'class' AND target_class_id IS NOT NULL AND target_child_id IS NULL) OR
               (audience_type = 'child' AND target_class_id IS NULL AND target_child_id IS NOT NULL))
      );
      CREATE INDEX file_object_listing ON file_object(facility_id, status, created_at DESC);

      INSERT INTO notebook_entry
        (id, facility_id, child_id, business_date, author_role, author_name, mood,
         temperature, meals, nap, toilet, note, photo, status, published_at)
      SELECT data->>'id', child.facility_id, data->>'childId', (data->>'date')::date,
        data->>'author', data->>'authorName', data->>'mood', (data->>'temperature')::numeric,
        data->>'meals', data->>'nap', data->>'toilet', COALESCE(data->>'note', ''),
        data->>'photo', 'published', now()
      FROM app_record JOIN child ON child.id = app_record.data->>'childId'
      WHERE kind = 'notebookEntries'
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO notice
        (id, facility_id, title, body, category, pinned, status, published_on, published_at)
      SELECT data->>'id', data->>'facilityId', data->>'title', data->>'body', data->>'category',
        COALESCE((data->>'pinned')::boolean, false), 'published', (data->>'date')::date, now()
      FROM app_record WHERE kind = 'notices'
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO calendar_event
        (id, facility_id, event_date, title, event_type, event_time, memo, status, published_at)
      SELECT data->>'id', data->>'facilityId', (data->>'date')::date, data->>'title', data->>'type',
        NULLIF(data->>'time', '')::time, data->>'memo', 'published', now()
      FROM app_record WHERE kind = 'calendarEvents'
      ON CONFLICT (id) DO NOTHING;
    `,
  },
  {
    version: 6,
    sql: `
      CREATE TABLE message (
        id text PRIMARY KEY,
        facility_id text NOT NULL,
        child_id text NOT NULL,
        sender_user_id text REFERENCES app_user(id) ON DELETE RESTRICT,
        sender_role text NOT NULL CHECK (sender_role IN ('parent', 'teacher')),
        sender_name text NOT NULL,
        body text NOT NULL CHECK (length(body) > 0),
        sent_at timestamptz NOT NULL,
        command_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (facility_id, child_id) REFERENCES child(facility_id, id) ON DELETE RESTRICT,
        UNIQUE (sender_user_id, command_id)
      );
      CREATE INDEX message_thread ON message(facility_id, child_id, sent_at DESC);

      INSERT INTO message
        (id, facility_id, child_id, sender_user_id, sender_role, sender_name, body, sent_at)
      SELECT data->>'id', child.facility_id, data->>'childId',
        COALESCE(data->>'senderId', (
          SELECT member.id FROM app_user member
          JOIN facility_membership membership ON membership.user_id = member.id
          WHERE membership.facility_id = child.facility_id
            AND membership.role = data->>'sender' AND member.name = data->>'senderName'
          LIMIT 1
        )),
        data->>'sender', data->>'senderName', data->>'text', (data->>'time')::timestamptz
      FROM app_record JOIN child ON child.id = app_record.data->>'childId'
      WHERE kind = 'messages'
      ON CONFLICT (id) DO NOTHING;
    `,
  },
  {
    version: 7,
    sql: `
      ALTER TABLE facility ADD COLUMN slug text;
      UPDATE facility SET slug = CASE id
        WHEN 'f1' THEN 'nijiiro'
        WHEN 'f2' THEN 'himawari'
        WHEN 'sample-facility' THEN 'sample-nursery'
        ELSE 'nursery-' || substr(md5(id), 1, 12)
      END;
      ALTER TABLE facility ALTER COLUMN slug SET NOT NULL;
      ALTER TABLE facility ADD CONSTRAINT facility_slug_format
        CHECK (slug ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$');
      ALTER TABLE facility ADD CONSTRAINT facility_slug_unique UNIQUE (slug);
    `,
  },
  {
    version: 8,
    sql: `
      ALTER TABLE notebook_entry ADD COLUMN evening_meal text;
      ALTER TABLE notebook_entry ADD COLUMN bedtime time;
      ALTER TABLE notebook_entry ADD COLUMN evening_stool text
        CHECK (evening_stool IN ('none', 'normal', 'soft', 'hard', 'diarrhea'));
      ALTER TABLE notebook_entry ADD COLUMN evening_stool_count integer
        CHECK (evening_stool_count BETWEEN 0 AND 10);
      ALTER TABLE notebook_entry ADD COLUMN wake_time time;
      ALTER TABLE notebook_entry ADD COLUMN morning_stool text
        CHECK (morning_stool IN ('none', 'normal', 'soft', 'hard', 'diarrhea'));
      ALTER TABLE notebook_entry ADD COLUMN morning_stool_count integer
        CHECK (morning_stool_count BETWEEN 0 AND 10);
      ALTER TABLE notebook_entry ADD COLUMN breakfast text;
      ALTER TABLE notebook_entry ADD COLUMN breakfast_amount text
        CHECK (breakfast_amount IN ('all', 'most', 'half', 'little', 'none'));
      ALTER TABLE notebook_entry ADD COLUMN condition text;
      ALTER TABLE notebook_entry ADD COLUMN pickup_person text
        CHECK (pickup_person IN ('mother', 'father', 'grandparent', 'other'));
      ALTER TABLE notebook_entry ADD COLUMN pickup_person_name text;
      ALTER TABLE notebook_entry ADD COLUMN pickup_time time;
    `,
  },
  {
    version: 9,
    sql: `
      ALTER TABLE notebook_entry ADD COLUMN temperature_measured_at time;
      ALTER TABLE notebook_entry DROP COLUMN breakfast_amount;
    `,
  },
  {
    version: 10,
    sql: `
      ALTER TABLE notebook_entry DROP CONSTRAINT notebook_entry_mood_check;
      UPDATE notebook_entry SET mood = CASE
        WHEN mood = 'genki' THEN 'good'
        WHEN mood IN ('tired', 'sick') THEN 'bad'
        ELSE mood
      END;
      ALTER TABLE notebook_entry ADD CONSTRAINT notebook_entry_mood_check
        CHECK (mood IN ('good', 'normal', 'bad'));
    `,
  },
  {
    version: 11,
    sql: `
      ALTER TABLE notebook_entry ADD COLUMN confirmed_at timestamptz;
      ALTER TABLE notebook_entry ADD COLUMN confirmed_by_user_id text
        REFERENCES app_user(id) ON DELETE RESTRICT;
      ALTER TABLE notebook_entry ADD CONSTRAINT notebook_entry_confirmation_owner
        CHECK (confirmed_at IS NULL OR (author_role = 'parent' AND confirmed_by_user_id IS NOT NULL));
      CREATE INDEX notebook_entry_confirmation
        ON notebook_entry(facility_id, confirmed_at) WHERE author_role = 'parent' AND status = 'published';
    `,
  },
  {
    version: 12,
    sql: `
      ALTER TABLE message ADD COLUMN kind text NOT NULL DEFAULT 'general'
        CHECK (kind IN ('general', 'absence', 'late', 'pickup'));
      ALTER TABLE message ADD COLUMN scheduled_date date;
      ALTER TABLE message ADD COLUMN scheduled_time time;
      ALTER TABLE message ADD CONSTRAINT message_schedule_required
        CHECK ((kind = 'general' AND scheduled_date IS NULL AND scheduled_time IS NULL)
          OR (kind = 'absence' AND scheduled_date IS NOT NULL AND scheduled_time IS NULL)
          OR (kind IN ('late', 'pickup') AND scheduled_date IS NOT NULL AND scheduled_time IS NOT NULL));
      CREATE INDEX message_schedule
        ON message(facility_id, scheduled_date, kind) WHERE kind <> 'general';
    `,
  },
  {
    version: 13,
    sql: `DROP TABLE notification_outbox;`,
  },
  {
    version: 14,
    sql: `
      ALTER TABLE facility_membership ADD COLUMN can_manage_facility boolean NOT NULL DEFAULT false;
      UPDATE facility_membership membership
      SET can_manage_facility = true
      WHERE membership.role = 'teacher' AND membership.ended_on IS NULL
        AND membership.user_id = (
          SELECT candidate.user_id FROM facility_membership candidate
          WHERE candidate.facility_id = membership.facility_id
            AND candidate.role = 'teacher' AND candidate.ended_on IS NULL
          ORDER BY candidate.created_at, candidate.user_id LIMIT 1
        );
    `,
  },
  {
    version: 15,
    sql: `
      UPDATE app_user SET email = lower(email);
      CREATE UNIQUE INDEX app_user_email_canonical ON app_user(lower(email));

      CREATE TABLE user_password (
        user_id text PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
        password_hash text NOT NULL,
        failed_attempt_count integer NOT NULL DEFAULT 0 CHECK (failed_attempt_count >= 0),
        locked_until timestamptz,
        password_changed_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
  {
    version: 16,
    sql: `
      CREATE TABLE message_template (
        id text PRIMARY KEY,
        facility_id text NOT NULL REFERENCES facility(id) ON DELETE RESTRICT,
        name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
        body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
        created_by_user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
        display_order integer NOT NULL DEFAULT 1000,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (facility_id, id),
        UNIQUE (facility_id, name)
      );
      CREATE INDEX message_template_facility
        ON message_template(facility_id, created_at, id);
    `,
  },
  {
    version: 17,
    sql: `
      CREATE TABLE message_draft (
        facility_id text NOT NULL,
        child_id text NOT NULL,
        body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
        version integer NOT NULL DEFAULT 1 CHECK (version > 0),
        updated_by_user_id text NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (facility_id, child_id),
        FOREIGN KEY (facility_id, child_id) REFERENCES child(facility_id, id) ON DELETE CASCADE
      );
      CREATE INDEX message_draft_updated ON message_draft(facility_id, updated_at DESC);
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
    'INSERT INTO facility (id, slug, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
    ['sample-facility', 'sample-nursery', 'サンプル保育園'],
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
