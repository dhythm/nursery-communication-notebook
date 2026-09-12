export const napMigrationSql = `
  CREATE TABLE nap_session (
    id text PRIMARY KEY,
    facility_id text NOT NULL REFERENCES facility(id),
    child_id text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    started_by text NOT NULL REFERENCES app_user(id),
    ended_at timestamptz,
    ended_by text REFERENCES app_user(id),
    interval_minutes integer NOT NULL CHECK (interval_minutes BETWEEN 1 AND 120),
    due_at timestamptz NOT NULL,
    last_observed_at timestamptz,
    needs_response boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    FOREIGN KEY (facility_id, child_id) REFERENCES child(facility_id,id),
    UNIQUE(facility_id,id),
    CHECK (ended_at IS NULL OR ended_at >= started_at)
  );
  CREATE UNIQUE INDEX nap_session_active ON nap_session(child_id) WHERE ended_at IS NULL;
  CREATE INDEX nap_session_facility ON nap_session(facility_id,started_at DESC);
  CREATE TABLE nap_observation (
    id text PRIMARY KEY,
    facility_id text NOT NULL,
    session_id text NOT NULL,
    observed_at timestamptz NOT NULL DEFAULT now(),
    observer_id text NOT NULL REFERENCES app_user(id),
    posture text NOT NULL CHECK (posture IN ('back','side','front')),
    breathing text NOT NULL CHECK (breathing IN ('normal','concern')),
    note text NOT NULL DEFAULT '',
    response text,
    responded_at timestamptz,
    responder_id text REFERENCES app_user(id),
    FOREIGN KEY (facility_id,session_id) REFERENCES nap_session(facility_id,id),
    CHECK (breathing != 'concern' OR length(trim(note)) > 0)
  );
  CREATE INDEX nap_observation_session ON nap_observation(facility_id,session_id,observed_at DESC);
`
