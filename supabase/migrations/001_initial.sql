-- キャリアアドバイザー（CA）テーブル
CREATE TABLE IF NOT EXISTS advisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  google_calendar_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ラウンドロビン状態（1行のみ）
CREATE TABLE IF NOT EXISTS round_robin_state (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_advisor_index INTEGER NOT NULL DEFAULT -1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO round_robin_state (id, last_advisor_index) VALUES (1, -1)
ON CONFLICT (id) DO NOTHING;

-- 予約テーブル
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
CREATE INDEX IF NOT EXISTS idx_advisors_active ON advisors(is_active, sort_order);

-- 初期CA10人（メール・カレンダーIDは環境に合わせて更新してください）
INSERT INTO advisors (name, email, google_calendar_id, sort_order) VALUES
  ('CA 01', 'ca01@example.com', 'ca01@example.com', 0),
  ('CA 02', 'ca02@example.com', 'ca02@example.com', 1),
  ('CA 03', 'ca03@example.com', 'ca03@example.com', 2),
  ('CA 04', 'ca04@example.com', 'ca04@example.com', 3),
  ('CA 05', 'ca05@example.com', 'ca05@example.com', 4),
  ('CA 06', 'ca06@example.com', 'ca06@example.com', 5),
  ('CA 07', 'ca07@example.com', 'ca07@example.com', 6),
  ('CA 08', 'ca08@example.com', 'ca08@example.com', 7),
  ('CA 09', 'ca09@example.com', 'ca09@example.com', 8),
  ('CA 10', 'ca10@example.com', 'ca10@example.com', 9)
ON CONFLICT (email) DO NOTHING;
