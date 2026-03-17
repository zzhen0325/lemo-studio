-- Lemon8 AI Studio 数据库表结构
-- 请在 Supabase 控制台的 SQL Editor 中执行此脚本

-- ==========================================
-- 1. 用户表
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 2. 图片资源表
-- ==========================================
CREATE TABLE IF NOT EXISTS image_assets (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  dir VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  region VARCHAR(64) NOT NULL,
  type VARCHAR(32) NOT NULL, -- generation, reference, dataset, upload
  project_id VARCHAR(36),
  generation_id VARCHAR(36),
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS image_assets_type_idx ON image_assets(type);
CREATE INDEX IF NOT EXISTS image_assets_project_id_idx ON image_assets(project_id);
CREATE INDEX IF NOT EXISTS image_assets_generation_id_idx ON image_assets(generation_id);

-- ==========================================
-- 3. 生成记录表
-- ==========================================
CREATE TABLE IF NOT EXISTS generations (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(32) DEFAULT 'pending', -- pending, completed, failed
  progress INTEGER,
  progress_stage VARCHAR(64),
  user_id VARCHAR(36),
  project_id VARCHAR(36),
  llm_response TEXT,
  output_image_id VARCHAR(36),
  source_image_id VARCHAR(36),
  output_url TEXT,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS generations_user_id_idx ON generations(user_id);
CREATE INDEX IF NOT EXISTS generations_project_id_idx ON generations(project_id);
CREATE INDEX IF NOT EXISTS generations_created_at_idx ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS generations_status_idx ON generations(status);

-- ==========================================
-- 4. 预设表
-- ==========================================
CREATE TABLE IF NOT EXISTS presets (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  cover_url TEXT,
  cover_data TEXT,
  config JSONB,
  edit_config JSONB,
  category VARCHAR(64),
  project_id VARCHAR(36),
  type VARCHAR(32), -- generation, edit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS presets_category_idx ON presets(category);
CREATE INDEX IF NOT EXISTS presets_type_idx ON presets(type);

-- ==========================================
-- 5. 预设分类表
-- ==========================================
CREATE TABLE IF NOT EXISTS preset_categories (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE,
  categories JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 6. 风格堆栈表
-- ==========================================
CREATE TABLE IF NOT EXISTS style_stacks (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  prompt TEXT NOT NULL,
  image_paths JSONB DEFAULT '[]',
  preview_urls JSONB DEFAULT '[]',
  collage_image_url TEXT,
  collage_config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 7. 工具预设表
-- ==========================================
CREATE TABLE IF NOT EXISTS tool_presets (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  values JSONB,
  thumbnail TEXT,
  timestamp INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tool_presets_tool_id_idx ON tool_presets(tool_id);

-- ==========================================
-- 8. 数据集条目表
-- ==========================================
CREATE TABLE IF NOT EXISTS dataset_entries (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_name VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  prompt TEXT,
  width INTEGER,
  height INTEGER,
  format VARCHAR(32),
  size INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dataset_entries_collection_name_idx ON dataset_entries(collection_name);

-- ==========================================
-- 9. 数据集集合表
-- ==========================================
CREATE TABLE IF NOT EXISTS dataset_collections (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 10. API 配置表
-- ==========================================
DROP TABLE IF EXISTS api_configs;
CREATE TABLE IF NOT EXISTS api_configs (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(64),
  api_key TEXT,
  base_url TEXT,
  models JSONB DEFAULT '[]',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_configs_name_idx ON api_configs(name);

-- ==========================================
-- 10.1 API 设置表
-- ==========================================
CREATE TABLE IF NOT EXISTS api_settings (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(64) NOT NULL UNIQUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 11. 无限画布项目表
-- ==========================================
CREATE TABLE IF NOT EXISTS infinite_canvas_projects (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  user_id VARCHAR(36),
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS infinite_canvas_projects_user_id_idx ON infinite_canvas_projects(user_id);

-- ==========================================
-- 12. 启用 Row Level Security (RLS)
-- ==========================================
-- 注意：根据你的安全需求配置 RLS 策略
-- 以下是最基本的允许所有操作的策略（生产环境请根据需要调整）

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_stacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tool_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE infinite_canvas_projects ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问（根据需要调整）
CREATE POLICY "Allow anonymous access" ON users FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON image_assets FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON generations FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON presets FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON preset_categories FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON style_stacks FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON tool_presets FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON dataset_entries FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON dataset_collections FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON api_configs FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON api_settings FOR ALL USING (true);
CREATE POLICY "Allow anonymous access" ON infinite_canvas_projects FOR ALL USING (true);

-- ==========================================
-- 完成
-- ==========================================
-- 执行完成后，你的 Supabase 数据库就准备就绪了！
