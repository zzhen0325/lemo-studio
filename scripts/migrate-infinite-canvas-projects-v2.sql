-- ==========================================
-- Lemon8 AI Studio - Infinite Canvas Projects v2 Migration
-- ==========================================
-- 执行前请先备份 `infinite_canvas_projects`。
-- 此脚本会把旧结构 `id/name/user_id/data` 升级为展开列模型，
-- 并在回填完成后删除旧列 `name/data`。
-- ==========================================

BEGIN;

ALTER TABLE infinite_canvas_projects
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(36),
  ADD COLUMN IF NOT EXISTS project_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS cover_url TEXT,
  ADD COLUMN IF NOT EXISTS node_count INTEGER,
  ADD COLUMN IF NOT EXISTS canvas_viewport JSONB,
  ADD COLUMN IF NOT EXISTS last_opened_panel VARCHAR(32),
  ADD COLUMN IF NOT EXISTS nodes JSONB,
  ADD COLUMN IF NOT EXISTS edges JSONB,
  ADD COLUMN IF NOT EXISTS assets JSONB,
  ADD COLUMN IF NOT EXISTS history JSONB,
  ADD COLUMN IF NOT EXISTS run_queue JSONB;

UPDATE infinite_canvas_projects AS project_row
SET
  project_id = COALESCE(
    NULLIF(project_row.project_id, ''),
    NULLIF(to_jsonb(project_row)->'data'->>'projectId', ''),
    project_row.id
  ),
  project_name = COALESCE(
    NULLIF(project_row.project_name, ''),
    NULLIF(to_jsonb(project_row)->'data'->>'projectName', ''),
    NULLIF(to_jsonb(project_row)->>'name', ''),
    '未命名项目'
  ),
  cover_url = COALESCE(
    NULLIF(project_row.cover_url, ''),
    NULLIF(to_jsonb(project_row)->'data'->>'coverUrl', '')
  ),
  created_at = COALESCE(
    CASE
      WHEN NULLIF(to_jsonb(project_row)->'data'->>'createdAt', '') ~ '^\d{4}-\d{2}-\d{2}T'
        THEN (to_jsonb(project_row)->'data'->>'createdAt')::timestamptz
      ELSE NULL
    END,
    project_row.created_at,
    NOW()
  ),
  updated_at = COALESCE(
    CASE
      WHEN NULLIF(to_jsonb(project_row)->'data'->>'updatedAt', '') ~ '^\d{4}-\d{2}-\d{2}T'
        THEN (to_jsonb(project_row)->'data'->>'updatedAt')::timestamptz
      ELSE NULL
    END,
    project_row.updated_at,
    NOW()
  ),
  node_count = COALESCE(
    project_row.node_count,
    CASE
      WHEN NULLIF(to_jsonb(project_row)->'data'->>'nodeCount', '') ~ '^\d+$'
        THEN (to_jsonb(project_row)->'data'->>'nodeCount')::integer
      WHEN jsonb_typeof(to_jsonb(project_row)->'data'->'nodes') = 'array'
        THEN jsonb_array_length(to_jsonb(project_row)->'data'->'nodes')
      ELSE 0
    END,
    0
  ),
  canvas_viewport = COALESCE(
    CASE
      WHEN jsonb_typeof(project_row.canvas_viewport) = 'object' THEN project_row.canvas_viewport
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(to_jsonb(project_row)->'data'->'canvasViewport') = 'object'
        THEN to_jsonb(project_row)->'data'->'canvasViewport'
      ELSE NULL
    END,
    '{"x": 0, "y": 0, "scale": 1}'::jsonb
  ),
  last_opened_panel = COALESCE(
    NULLIF(project_row.last_opened_panel, ''),
    NULLIF(to_jsonb(project_row)->'data'->>'lastOpenedPanel', '')
  ),
  nodes = COALESCE(
    CASE
      WHEN jsonb_typeof(project_row.nodes) = 'array' THEN project_row.nodes
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(to_jsonb(project_row)->'data'->'nodes') = 'array'
        THEN to_jsonb(project_row)->'data'->'nodes'
      ELSE NULL
    END,
    '[]'::jsonb
  ),
  edges = COALESCE(
    CASE
      WHEN jsonb_typeof(project_row.edges) = 'array' THEN project_row.edges
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(to_jsonb(project_row)->'data'->'edges') = 'array'
        THEN to_jsonb(project_row)->'data'->'edges'
      ELSE NULL
    END,
    '[]'::jsonb
  ),
  assets = COALESCE(
    CASE
      WHEN jsonb_typeof(project_row.assets) = 'array' THEN project_row.assets
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(to_jsonb(project_row)->'data'->'assets') = 'array'
        THEN to_jsonb(project_row)->'data'->'assets'
      ELSE NULL
    END,
    '[]'::jsonb
  ),
  history = COALESCE(
    CASE
      WHEN jsonb_typeof(project_row.history) = 'array' THEN project_row.history
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(to_jsonb(project_row)->'data'->'history') = 'array'
        THEN to_jsonb(project_row)->'data'->'history'
      ELSE NULL
    END,
    '[]'::jsonb
  ),
  run_queue = COALESCE(
    CASE
      WHEN jsonb_typeof(project_row.run_queue) = 'array' THEN project_row.run_queue
      ELSE NULL
    END,
    CASE
      WHEN jsonb_typeof(to_jsonb(project_row)->'data'->'runQueue') = 'array'
        THEN to_jsonb(project_row)->'data'->'runQueue'
      ELSE NULL
    END,
    '[]'::jsonb
  );

UPDATE infinite_canvas_projects
SET
  project_id = COALESCE(NULLIF(project_id, ''), id),
  project_name = COALESCE(NULLIF(project_name, ''), '未命名项目'),
  node_count = COALESCE(
    node_count,
    CASE
      WHEN jsonb_typeof(nodes) = 'array' THEN jsonb_array_length(nodes)
      ELSE 0
    END,
    0
  ),
  canvas_viewport = CASE
    WHEN jsonb_typeof(canvas_viewport) = 'object' THEN canvas_viewport
    ELSE '{"x": 0, "y": 0, "scale": 1}'::jsonb
  END,
  nodes = CASE
    WHEN jsonb_typeof(nodes) = 'array' THEN nodes
    ELSE '[]'::jsonb
  END,
  edges = CASE
    WHEN jsonb_typeof(edges) = 'array' THEN edges
    ELSE '[]'::jsonb
  END,
  assets = CASE
    WHEN jsonb_typeof(assets) = 'array' THEN assets
    ELSE '[]'::jsonb
  END,
  history = CASE
    WHEN jsonb_typeof(history) = 'array' THEN history
    ELSE '[]'::jsonb
  END,
  run_queue = CASE
    WHEN jsonb_typeof(run_queue) = 'array' THEN run_queue
    ELSE '[]'::jsonb
  END,
  created_at = COALESCE(created_at, NOW()),
  updated_at = COALESCE(updated_at, NOW());

ALTER TABLE infinite_canvas_projects
  ALTER COLUMN project_id SET NOT NULL,
  ALTER COLUMN project_name SET NOT NULL,
  ALTER COLUMN node_count SET DEFAULT 0,
  ALTER COLUMN node_count SET NOT NULL,
  ALTER COLUMN canvas_viewport SET DEFAULT '{"x": 0, "y": 0, "scale": 1}'::jsonb,
  ALTER COLUMN canvas_viewport SET NOT NULL,
  ALTER COLUMN nodes SET DEFAULT '[]'::jsonb,
  ALTER COLUMN nodes SET NOT NULL,
  ALTER COLUMN edges SET DEFAULT '[]'::jsonb,
  ALTER COLUMN edges SET NOT NULL,
  ALTER COLUMN assets SET DEFAULT '[]'::jsonb,
  ALTER COLUMN assets SET NOT NULL,
  ALTER COLUMN history SET DEFAULT '[]'::jsonb,
  ALTER COLUMN history SET NOT NULL,
  ALTER COLUMN run_queue SET DEFAULT '[]'::jsonb,
  ALTER COLUMN run_queue SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS infinite_canvas_projects_project_id_uidx
  ON infinite_canvas_projects(project_id);

CREATE INDEX IF NOT EXISTS infinite_canvas_projects_user_id_idx
  ON infinite_canvas_projects(user_id);

CREATE INDEX IF NOT EXISTS infinite_canvas_projects_updated_at_idx
  ON infinite_canvas_projects(updated_at DESC);

ALTER TABLE infinite_canvas_projects
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS data;

COMMIT;

-- 可选检查：
-- SELECT COUNT(*) FROM infinite_canvas_projects;
-- SELECT COUNT(*) FROM infinite_canvas_projects WHERE project_id IS NULL OR project_name IS NULL;
