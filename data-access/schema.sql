-- Echo of Photons 第一阶段数据库 schema

CREATE TABLE IF NOT EXISTS celestial_objects (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  name_zh VARCHAR(255) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  object_type VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS object_cards (
  id SERIAL PRIMARY KEY,
  object_id INTEGER NOT NULL UNIQUE REFERENCES celestial_objects(id),
  what_is_it TEXT NOT NULL,
  why_watch_it TEXT NOT NULL,
  what_next TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
