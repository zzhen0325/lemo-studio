-- Business fields and statistics shared by local and deployed environments.
ALTER TABLE preset_categories ALTER COLUMN key SET DEFAULT 'default';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE image_assets ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE dataset_entries ADD COLUMN IF NOT EXISTS prompt_zh TEXT;
ALTER TABLE dataset_entries ADD COLUMN IF NOT EXISTS prompt_en TEXT;
ALTER TABLE dataset_entries ADD COLUMN IF NOT EXISTS order_idx INTEGER DEFAULT 0;
ALTER TABLE dataset_collections ADD COLUMN IF NOT EXISTS order_arr JSONB DEFAULT '[]';
ALTER TABLE dataset_collections ADD COLUMN IF NOT EXISTS system_prompt TEXT;
CREATE TABLE IF NOT EXISTS site_stats (
  key TEXT PRIMARY KEY,
  count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION increment_site_stat(p_key TEXT, p_delta INTEGER DEFAULT 1)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO site_stats(key, count) VALUES(p_key, p_delta)
  ON CONFLICT(key) DO UPDATE SET count = site_stats.count + EXCLUDED.count, updated_at = NOW();
$$;
DROP FUNCTION IF EXISTS increment_like_count(TEXT);
CREATE OR REPLACE FUNCTION increment_like_count(p_generation_id TEXT, p_now TIMESTAMPTZ)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE generations SET like_count = COALESCE(like_count, 0) + 1, last_liked_at = p_now
  WHERE id = p_generation_id;
$$;
