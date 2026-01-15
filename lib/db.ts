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
    pool = new Pool({ connectionString: getDatabaseUrl() });
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
      gen.config,
      gen.status,
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
