export const attendanceMigrationSql = `
CREATE TABLE staff_attendance_session (
 id text PRIMARY KEY,
 facility_id text NOT NULL REFERENCES facility(id),
 user_id text NOT NULL REFERENCES app_user(id),
 clock_in timestamptz NOT NULL,
 clock_out timestamptz,
 break_started_at timestamptz,
 break_minutes double precision NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
 version integer NOT NULL DEFAULT 1,
 CHECK (clock_out IS NULL OR clock_out >= clock_in),
 CHECK (clock_out IS NULL OR break_started_at IS NULL)
);
CREATE UNIQUE INDEX staff_attendance_open ON staff_attendance_session (facility_id,user_id) WHERE clock_out IS NULL;
CREATE INDEX staff_attendance_history ON staff_attendance_session (facility_id,clock_in);
CREATE TABLE staff_attendance_correction (
 id text PRIMARY KEY,
 session_id text NOT NULL REFERENCES staff_attendance_session(id),
 actor_id text NOT NULL REFERENCES app_user(id),
 reason text NOT NULL,
 previous_data jsonb NOT NULL,
 corrected_data jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
`
