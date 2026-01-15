import { Pool } from 'pg';
import type { Generation, Preset, Style } from '@/types/database';

let pool: Pool | null = null;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

function getPool(): Pool {
  if (!pool) {
    const connectionString = getDatabaseUrl();
    try {
      const url = new URL(connectionString);
      console.log(`[DB] Connecting to host: ${url.hostname}, user: ${url.username}, database: ${url.pathname.slice(1)}`);
    } catch (e) {
      console.error('[DB] Invalid DATABASE_URL format');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
}

export interface InsertImageParams {
  id?: string;
  url: string;
  sourceType?: string;
  projectId?: string | null;
  createdAt?: string | Date;
  metadata?: unknown;
}

export async function insertImage(params: InsertImageParams): Promise<string> {
  const pool = getPool();
  const id = params.id ?? (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const createdAt = params.createdAt
    ? (params.createdAt instanceof Date ? params.createdAt.toISOString() : params.createdAt)
    : new Date().toISOString();

  const sourceType = params.sourceType ?? 'outputs';

  await pool.query(
    `INSERT INTO images (id, url, source_type, project_id, created_at, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       url = EXCLUDED.url,
       source_type = EXCLUDED.source_type,
       project_id = EXCLUDED.project_id,
       created_at = EXCLUDED.created_at,
       metadata = COALESCE(EXCLUDED.metadata, images.metadata)`,
    [id, params.url, sourceType, params.projectId ?? null, createdAt, params.metadata ?? null],
  );

  return id;
}

export async function insertGeneration(gen: Generation): Promise<string> {
  const pool = getPool();
  const id = gen.id || (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const createdAt = gen.createdAt || new Date().toISOString();

  await pool.query(
    `INSERT INTO generations (id, user_id, project_id, output_url, config, status, source_image_url, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       project_id = EXCLUDED.project_id,
       output_url = EXCLUDED.output_url,
       config = EXCLUDED.config,
       status = EXCLUDED.status,
       source_image_url = EXCLUDED.source_image_url,
       created_at = EXCLUDED.created_at`,
    [
      id,
      gen.userId ?? null,
      gen.projectId ?? null,
      gen.outputUrl,
      gen.config || {},
      gen.status || 'completed',
      gen.sourceImageUrl ?? null,
      createdAt,
    ],
  );

  return id;
}

export type InsertPresetParams = Preset;

export async function insertPreset(preset: InsertPresetParams): Promise<string> {
  const pool = getPool();
  const id = preset.id || (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const createdAt = preset.createdAt || new Date().toISOString();

  await pool.query(
    `INSERT INTO presets (id, name, cover_url, config, edit_config, category, project_id, created_at, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       cover_url = EXCLUDED.cover_url,
       config = EXCLUDED.config,
       edit_config = EXCLUDED.edit_config,
       category = EXCLUDED.category,
       project_id = EXCLUDED.project_id,
       created_at = EXCLUDED.created_at,
       type = EXCLUDED.type`,
    [
      id,
      preset.name,
      preset.coverUrl ?? null,
      preset.config,
      preset.editConfig ?? null,
      preset.category ?? null,
      preset.projectId ?? null,
      createdAt,
      preset.type ?? null,
    ],
  );

  return id;
}

export type InsertStyleParams = Style;

export async function insertStyle(style: InsertStyleParams): Promise<string> {
  const pool = getPool();
  const id = style.id || (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const updatedAt = style.updatedAt || new Date().toISOString();

  await pool.query(
    `INSERT INTO styles (id, name, prompt, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       prompt = EXCLUDED.prompt,
       updated_at = EXCLUDED.updated_at`,
    [id, style.name, style.prompt, updatedAt],
  );

  return id;
}

export interface InsertStyleImageParams {
  id?: string;
  styleId: string;
  imageUrl: string;
  kind?: string | null;
  createdAt?: string | Date;
}

export async function insertStyleImage(params: InsertStyleImageParams): Promise<string> {
  const pool = getPool();
  const id = params.id ?? (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const createdAt = params.createdAt
    ? (params.createdAt instanceof Date ? params.createdAt.toISOString() : params.createdAt)
    : new Date().toISOString();

  await pool.query(
    `INSERT INTO style_images (id, style_id, image_url, kind, created_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       style_id = EXCLUDED.style_id,
       image_url = EXCLUDED.image_url,
       kind = EXCLUDED.kind,
       created_at = EXCLUDED.created_at`,
    [id, params.styleId, params.imageUrl, params.kind ?? null, createdAt],
  );

  return id;
}

export interface InsertDatasetItemParams {
  id?: string;
  collection: string;
  imageUrl: string;
  promptText?: string | null;
  systemKeywords?: string | null;
  createdAt?: string | Date;
}

export async function insertDatasetItem(params: InsertDatasetItemParams): Promise<string> {
  const pool = getPool();
  const id = params.id ?? (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
  const createdAt = params.createdAt
    ? (params.createdAt instanceof Date ? params.createdAt.toISOString() : params.createdAt)
    : new Date().toISOString();

  await pool.query(
    `INSERT INTO dataset_items (id, collection, image_url, prompt_text, system_keywords, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       collection = EXCLUDED.collection,
       image_url = EXCLUDED.image_url,
       prompt_text = EXCLUDED.prompt_text,
       system_keywords = EXCLUDED.system_keywords,
       created_at = EXCLUDED.created_at`,
    [id, params.collection, params.imageUrl, params.promptText ?? null, params.systemKeywords ?? null, createdAt],
  );

  return id;
}

export interface QueryGenerationsParams {
  page: number;
  limit: number;
  projectId?: string | null;
  userId?: string | null;
}

export interface QueryGenerationsResult {
  items: Generation[];
  total: number;
}

export async function queryGenerations(params: QueryGenerationsParams): Promise<QueryGenerationsResult> {
  const pool = getPool();
  const page = Math.max(1, Math.floor(params.page || 1));
  const limit = Math.max(1, Math.floor(params.limit || 20));

  const conditions: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (params.projectId) {
    conditions.push(`project_id = $${idx}`);
    values.push(params.projectId);
    idx += 1;
  }

  if (params.userId) {
    if (params.userId === 'user-1') {
      // 兼容旧逻辑：user-1 视为本地匿名用户
      conditions.push(`(user_id = $${idx} OR user_id IS NULL OR user_id = 'anonymous')`);
      values.push(params.userId);
      idx += 1;
    } else {
      conditions.push(`user_id = $${idx}`);
      values.push(params.userId);
      idx += 1;
    }
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const offset = (page - 1) * limit;

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM generations ${whereClause}`,
    values,
  );

  const total = Number(countResult.rows[0]?.count ?? 0);

  const itemsResult = await pool.query<{
    id: string;
    user_id: string | null;
    project_id: string | null;
    output_url: string;
    config: unknown;
    status: string;
    source_image_url: string | null;
    created_at: string | Date;
  }>(
    `SELECT id, user_id, project_id, output_url, config, status, source_image_url, created_at
     FROM generations
     ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, limit, offset],
  );

  const items: Generation[] = itemsResult.rows.map((row) => ({
    id: row.id,
    userId: row.user_id ?? 'anonymous',
    projectId: row.project_id ?? 'default',
    outputUrl: row.output_url,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: row.config as any,
    status: row.status as Generation['status'],
    sourceImageUrl: row.source_image_url ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));

  return { items, total };
}

export async function queryPresets(): Promise<Preset[]> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    name: string;
    cover_url: string | null;
    config: unknown;
    edit_config: unknown | null;
    category: string | null;
    project_id: string | null;
    created_at: string | Date;
    type: string | null;
  }>(
    `SELECT id, name, cover_url, config, edit_config, category, project_id, created_at, type
     FROM presets
     ORDER BY created_at DESC`,
  );

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    coverUrl: row.cover_url ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: row.config as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editConfig: (row.edit_config as any) ?? undefined,
    category: row.category ?? undefined,
    projectId: row.project_id ?? undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    type: (row.type as Preset['type']) ?? undefined,
  }));
}

export interface DatasetCollectionSummary {
  id: string;
  name: string;
  imageCount: number;
  previews: string[];
}

export async function queryDatasetCollections(): Promise<DatasetCollectionSummary[]> {
  const pool = getPool();
  const result = await pool.query<{
    collection: string;
    image_url: string;
    created_at: string | Date;
  }>(
    `SELECT collection, image_url, created_at
     FROM dataset_items
     ORDER BY collection ASC, created_at DESC`,
  );

  const map = new Map<string, DatasetCollectionSummary>();

  for (const row of result.rows) {
    const collection = row.collection;
    let summary = map.get(collection);
    if (!summary) {
      summary = {
        id: collection,
        name: collection,
        imageCount: 0,
        previews: [],
      };
      map.set(collection, summary);
    }

    summary.imageCount += 1;
    if (summary.previews.length < 4) {
      summary.previews.push(row.image_url);
    }
  }

  return Array.from(map.values());
}

export interface DatasetItemDTO {
  id: string;
  filename: string;
  url: string;
  prompt: string;
}

export async function queryDatasetItems(collection: string): Promise<DatasetItemDTO[]> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    image_url: string;
    prompt_text: string | null;
    created_at: string | Date;
  }>(
    `SELECT id, image_url, prompt_text, created_at
     FROM dataset_items
     WHERE collection = $1
     ORDER BY created_at DESC`,
    [collection],
  );

  return result.rows.map((row) => {
    const url = row.image_url;
    const lastSlash = url.lastIndexOf('/');
    const filename = lastSlash >= 0 ? url.slice(lastSlash + 1) : url;

    return {
      id: row.id,
      filename,
      url,
      prompt: row.prompt_text ?? '',
    };
  });
}
