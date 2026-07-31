-- Echo of Photons 第一阶段数据库 schema

CREATE TABLE IF NOT EXISTS celestial_objects (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  name_zh VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  object_type VARCHAR(50) NOT NULL,
  ra_hours NUMERIC(8, 5),
  dec_deg NUMERIC(8, 5),
  magnitude NUMERIC(6, 3),
  visual_size NUMERIC(8, 3),
  display_color VARCHAR(20),
  search_aliases TEXT[] NOT NULL DEFAULT '{}',
  is_detail_ready BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE celestial_objects
  ADD COLUMN IF NOT EXISTS ra_hours NUMERIC(8, 5),
  ADD COLUMN IF NOT EXISTS dec_deg NUMERIC(8, 5),
  ADD COLUMN IF NOT EXISTS magnitude NUMERIC(6, 3),
  ADD COLUMN IF NOT EXISTS visual_size NUMERIC(8, 3),
  ADD COLUMN IF NOT EXISTS display_color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS search_aliases TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_detail_ready BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS object_cards (
  id SERIAL PRIMARY KEY,
  object_id INTEGER NOT NULL UNIQUE REFERENCES celestial_objects(id),
  what_is_it TEXT NOT NULL,
  why_watch_it TEXT NOT NULL,
  what_next TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS object_relations (
  id BIGSERIAL PRIMARY KEY,
  source_object_id INTEGER NOT NULL REFERENCES celestial_objects(id) ON DELETE CASCADE,
  target_object_id INTEGER NOT NULL REFERENCES celestial_objects(id) ON DELETE CASCADE,
  relation_type VARCHAR(40) NOT NULL DEFAULT 'next_explore',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT object_relations_distinct_check CHECK (source_object_id <> target_object_id),
  UNIQUE (source_object_id, target_object_id, relation_type)
);

CREATE INDEX IF NOT EXISTS object_relations_source_idx
  ON object_relations (source_object_id, relation_type, sort_order);

CREATE INDEX IF NOT EXISTS object_relations_target_idx
  ON object_relations (target_object_id, relation_type);

CREATE TABLE IF NOT EXISTS constellations (
  id SERIAL PRIMARY KEY,
  object_id INTEGER NOT NULL UNIQUE REFERENCES celestial_objects(id) ON DELETE CASCADE,
  abbreviation VARCHAR(10) NOT NULL,
  description TEXT NOT NULL,
  anchor_slug VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS constellation_members (
  constellation_id INTEGER NOT NULL REFERENCES constellations(id) ON DELETE CASCADE,
  object_id INTEGER NOT NULL REFERENCES celestial_objects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (constellation_id, object_id)
);

CREATE INDEX IF NOT EXISTS constellation_members_object_idx
  ON constellation_members (object_id, sort_order);

CREATE TABLE IF NOT EXISTS constellation_lines (
  constellation_id INTEGER NOT NULL REFERENCES constellations(id) ON DELETE CASCADE,
  from_object_id INTEGER NOT NULL REFERENCES celestial_objects(id) ON DELETE CASCADE,
  to_object_id INTEGER NOT NULL REFERENCES celestial_objects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (constellation_id, from_object_id, to_object_id)
);

CREATE INDEX IF NOT EXISTS constellation_lines_constellation_idx
  ON constellation_lines (constellation_id, sort_order);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_lowercase_check CHECK (email = LOWER(email))
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_sessions_user_idx
  ON user_sessions (user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx
  ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS observation_records (
  id BIGSERIAL PRIMARY KEY,
  observer_id UUID NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  target_slug VARCHAR(255),
  target_name VARCHAR(255) NOT NULL,
  object_type VARCHAR(50) NOT NULL DEFAULT 'unknown',
  observed_at TIMESTAMPTZ NOT NULL,
  latitude NUMERIC(9, 6),
  longitude NUMERIC(9, 6),
  location_name VARCHAR(255),
  equipment VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS observation_records_observer_time_idx
  ON observation_records (observer_id, observed_at DESC);

ALTER TABLE observation_records
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS observation_records_confirmed_idx
  ON observation_records (observer_id, confirmed_at DESC)
  WHERE confirmed_at IS NOT NULL;

ALTER TABLE observation_records
  ADD COLUMN IF NOT EXISTS user_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'observation_records_user_id_fkey'
      AND conrelid = 'observation_records'::regclass
  ) THEN
    ALTER TABLE observation_records
      ADD CONSTRAINT observation_records_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS observation_records_user_time_idx
  ON observation_records (user_id, observed_at DESC)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS achievement_series (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_zh VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  badge_key VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS achievement_series_members (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES achievement_series(id) ON DELETE CASCADE,
  target_slug VARCHAR(255) NOT NULL,
  target_name VARCHAR(255) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (series_id, target_slug)
);

CREATE INDEX IF NOT EXISTS achievement_series_members_target_idx
  ON achievement_series_members (target_slug, series_id);

CREATE TABLE IF NOT EXISTS user_achievement_unlocks (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  series_id BIGINT NOT NULL REFERENCES achievement_series(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, series_id)
);

CREATE INDEX IF NOT EXISTS user_achievement_unlocks_user_idx
  ON user_achievement_unlocks (user_id, unlocked_at DESC);

INSERT INTO achievement_series (slug, name_zh, description, badge_key, sort_order)
VALUES
  ('summer-triangle', '夏季大三角', '确认织女星、牛郎星与天津四，完成横跨夏季银河的三角坐标。', 'summer_triangle', 10),
  ('northern-dipper', '北斗七星', '从天枢到摇光依次确认北斗七星，建立寻找北极星的基础方向感。', 'northern_dipper', 20),
  ('orion', '猎户座', '确认猎户的双肩、腰带三星与双足，拼出冬夜最醒目的星座轮廓。', 'orion', 30),
  ('scorpius', '天蝎座', '沿房宿、心宿与尾宿完成天蝎弯曲的躯干和尾部。', 'scorpius', 40),
  ('cassiopeia', '仙后座', '确认组成 W 形主轮廓的五颗亮星，获得仙后王冠徽章。', 'cassiopeia', 50),
  ('winter-hexagon', '冬季六边形', '连接五车二、毕宿五、参宿七、天狼星、南河三与北河三，完成冬季亮星环。', 'winter_hexagon', 60)
ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  description = EXCLUDED.description,
  badge_key = EXCLUDED.badge_key,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = NOW();

INSERT INTO achievement_series_members (series_id, target_slug, target_name, sort_order)
SELECT series.id, member.target_slug, member.target_name, member.sort_order
FROM achievement_series AS series
JOIN (VALUES
  ('summer-triangle', 'vega', '织女星', 10),
  ('summer-triangle', 'altair', '牛郎星', 20),
  ('summer-triangle', 'deneb', '天津四', 30),
  ('northern-dipper', 'dubhe', '天枢', 10),
  ('northern-dipper', 'merak', '天璇', 20),
  ('northern-dipper', 'phecda', '天玑', 30),
  ('northern-dipper', 'megrez', '天权', 40),
  ('northern-dipper', 'alioth', '玉衡', 50),
  ('northern-dipper', 'mizar', '开阳', 60),
  ('northern-dipper', 'alkaid', '摇光', 70),
  ('orion', 'betelgeuse', '参宿四', 10),
  ('orion', 'bellatrix', '参宿五', 20),
  ('orion', 'alnitak', '参宿一', 30),
  ('orion', 'alnilam', '参宿二', 40),
  ('orion', 'mintaka', '参宿三', 50),
  ('orion', 'rigel', '参宿七', 60),
  ('orion', 'saiph', '参宿六', 70),
  ('scorpius', 'acrab', '房宿四', 10),
  ('scorpius', 'dschubba', '房宿三', 20),
  ('scorpius', 'fang', '心宿一', 30),
  ('scorpius', 'antares', '心宿二', 40),
  ('scorpius', 'sargas', '尾宿五', 50),
  ('scorpius', 'girtab', '尾宿六', 60),
  ('scorpius', 'lesath', '尾宿七', 70),
  ('scorpius', 'shaula', '尾宿八', 80),
  ('cassiopeia', 'caph', '王良五', 10),
  ('cassiopeia', 'schedar', '王良四', 20),
  ('cassiopeia', 'navi', '王良三', 30),
  ('cassiopeia', 'ruchbah', '王良二', 40),
  ('cassiopeia', 'segin', '仙后座ε', 50),
  ('winter-hexagon', 'capella', '五车二', 10),
  ('winter-hexagon', 'aldebaran', '毕宿五', 20),
  ('winter-hexagon', 'rigel', '参宿七', 30),
  ('winter-hexagon', 'sirius', '天狼星', 40),
  ('winter-hexagon', 'procyon', '南河三', 50),
  ('winter-hexagon', 'pollux', '北河三', 60)
) AS member(series_slug, target_slug, target_name, sort_order)
  ON series.slug = member.series_slug
ON CONFLICT (series_id, target_slug) DO UPDATE SET
  target_name = EXCLUDED.target_name,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

INSERT INTO user_achievement_unlocks (user_id, series_id, unlocked_at)
SELECT records.user_id, members.series_id, MAX(records.confirmed_at)
FROM observation_records AS records
JOIN achievement_series_members AS members
  ON members.target_slug = records.target_slug
WHERE records.user_id IS NOT NULL
  AND records.confirmed_at IS NOT NULL
GROUP BY records.user_id, members.series_id
HAVING COUNT(DISTINCT members.target_slug) = (
  SELECT COUNT(*)
  FROM achievement_series_members AS required_members
  WHERE required_members.series_id = members.series_id
)
ON CONFLICT (user_id, series_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS observation_photos (
  id BIGSERIAL PRIMARY KEY,
  observation_id BIGINT NOT NULL REFERENCES observation_records(id) ON DELETE CASCADE,
  observer_id UUID NOT NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS observation_photos_observation_idx
  ON observation_photos (observation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS observation_photos_user_idx
  ON observation_photos (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS astronomy_events (
  id BIGSERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  event_type VARCHAR(50) NOT NULL,
  name_zh VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  active_start_date DATE NOT NULL,
  active_end_date DATE NOT NULL,
  peak_date DATE NOT NULL,
  zhr INTEGER NOT NULL CHECK (zhr >= 0),
  intensity_level VARCHAR(20) NOT NULL,
  summary TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT astronomy_events_date_check CHECK (active_end_date >= active_start_date)
);

CREATE INDEX IF NOT EXISTS astronomy_events_upcoming_idx
  ON astronomy_events (event_type, peak_date)
  WHERE is_active = true;

CREATE TABLE IF NOT EXISTS event_observation_notes (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL UNIQUE REFERENCES astronomy_events(id) ON DELETE CASCADE,
  recommended_time_window TEXT NOT NULL,
  observation_tip TEXT NOT NULL,
  ideal_location_type TEXT NOT NULL,
  better_region_summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_observation_notes_event_idx
  ON event_observation_notes (event_id);

CREATE TABLE IF NOT EXISTS media_assets (
  id BIGSERIAL PRIMARY KEY,
  asset_key VARCHAR(255) NOT NULL UNIQUE,
  media_type VARCHAR(40) NOT NULL,
  gallery_category VARCHAR(80),
  object_id INTEGER REFERENCES celestial_objects(id) ON DELETE CASCADE,
  event_id BIGINT REFERENCES astronomy_events(id) ON DELETE CASCADE,
  event_slug VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  alt_text VARCHAR(255) NOT NULL,
  storage_bucket VARCHAR(100),
  storage_path TEXT,
  external_url TEXT,
  source_url TEXT NOT NULL,
  credit TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  captured_at VARCHAR(100) NOT NULL,
  equipment VARCHAR(255) NOT NULL,
  license TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT media_assets_type_check CHECK (
    media_type IN ('gallery', 'object_reference', 'event_reference')
  ),
  CONSTRAINT media_assets_source_check CHECK (
    storage_path IS NOT NULL OR external_url IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS media_assets_gallery_idx
  ON media_assets (media_type, gallery_category, sort_order)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS media_assets_object_idx
  ON media_assets (object_id, media_type, sort_order)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS media_assets_event_idx
  ON media_assets (event_slug, media_type, sort_order)
  WHERE is_active = true;

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS event_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'media_assets_event_id_fkey'
      AND conrelid = 'media_assets'::regclass
  ) THEN
    ALTER TABLE media_assets
      ADD CONSTRAINT media_assets_event_id_fkey
      FOREIGN KEY (event_id) REFERENCES astronomy_events(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS media_assets_event_id_idx
  ON media_assets (event_id, media_type, sort_order)
  WHERE is_active = true;
