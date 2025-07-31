CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  input_markdown TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES sow_runs(id) ON DELETE CASCADE,
  title TEXT,
  original_markdown TEXT,
  current_html TEXT,
  model_source TEXT,
  version_number INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(run_id, id)
);

CREATE TABLE IF NOT EXISTS slide_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID REFERENCES slides(id) ON DELETE CASCADE,
  html TEXT,
  source TEXT,
  instruction TEXT,
  version_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slide_edit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slide_id UUID REFERENCES slides(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT,
  instruction TEXT,
  from_version INTEGER,
  to_version INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slide_locks (
  slide_id UUID PRIMARY KEY REFERENCES slides(id) ON DELETE CASCADE,
  locked_by UUID,
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
