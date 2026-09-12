export const riskPlanMigrationSql = `
CREATE TABLE risk_report (
  id text PRIMARY KEY,
  facility_id text NOT NULL REFERENCES facility(id),
  child_id text,
  occurred_at timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('accident', 'near_miss')),
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  detail text NOT NULL,
  response text NOT NULL DEFAULT '',
  prevention text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  author_id text NOT NULL REFERENCES app_user(id),
  updated_by text NOT NULL REFERENCES app_user(id),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (facility_id, child_id) REFERENCES child(facility_id, id),
  CHECK (status <> 'resolved' OR (length(trim(response)) > 0 AND length(trim(prevention)) > 0))
);
CREATE INDEX risk_report_facility_date ON risk_report(facility_id, occurred_at DESC);
CREATE TABLE instruction_plan (
  id text PRIMARY KEY,
  facility_id text NOT NULL REFERENCES facility(id),
  class_id text NOT NULL,
  period text NOT NULL CHECK (period IN ('monthly', 'weekly', 'daily')),
  start_date date NOT NULL,
  end_date date NOT NULL CHECK (end_date >= start_date),
  goals text NOT NULL DEFAULT '',
  activities text NOT NULL DEFAULT '',
  support text NOT NULL DEFAULT '',
  evaluation text NOT NULL DEFAULT '',
  review_comment text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  author_id text NOT NULL REFERENCES app_user(id),
  updated_by text NOT NULL REFERENCES app_user(id),
  approved_by text REFERENCES app_user(id),
  approved_at timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (facility_id, class_id) REFERENCES nursery_class(facility_id, id)
);
CREATE INDEX instruction_plan_facility_date ON instruction_plan(facility_id, start_date DESC);
`
