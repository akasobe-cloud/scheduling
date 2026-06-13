-- 不足しているカラムを追加（既存テーブルがある場合用）

ALTER TABLE advisors ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE advisors ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE advisors ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;
ALTER TABLE advisors ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- google_calendar_id が NULL の場合は email をコピー
UPDATE advisors SET google_calendar_id = email WHERE google_calendar_id IS NULL;

ALTER TABLE advisors ALTER COLUMN google_calendar_id SET NOT NULL;

-- round_robin_state テーブル
CREATE TABLE IF NOT EXISTS round_robin_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_advisor_index INTEGER NOT NULL DEFAULT -1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO round_robin_state (id, last_advisor_index) VALUES (1, -1)
ON CONFLICT (id) DO NOTHING;

-- bookings テーブル
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advisor_id UUID NOT NULL REFERENCES advisors(id),
  seeker_name TEXT NOT NULL,
  seeker_email TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  zoom_meeting_id TEXT,
  zoom_join_url TEXT,
  zoom_start_url TEXT,
  google_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  reminder_day_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_hour_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
