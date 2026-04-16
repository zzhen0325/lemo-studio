/**
 * 管理员接口：清理 generations 中无法访问的裸文件名图片地址
 *
 * 背景：
 * 部分历史数据可能把 output_url 存成类似 `generate_image_xxx.jpeg` 的裸文件名，
 * 前端会将其当成相对路径请求，造成大量 404。
 *
 * 使用方式：
 * 1. GET /api/admin/cleanup-bare-image-urls
 *    - 扫描并返回命中统计与样本（dry-run）
 * 2. POST /api/admin/cleanup-bare-image-urls
 *    - body: { "confirm": true, "scanLimit": 5000, "applyLimit": 5000 }
 *    - 执行修复：将命中记录的 output_url 置空，并清理 config 中同类脏字段
 */

import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/src/storage/database/supabase-client';

type GenerationRow = {
  id: string;
  output_url: string | null;
  config?: unknown;
  created_at?: string | null;
};

type ScanResult = {
  scanned: number;
  truncated: boolean;
  matched: GenerationRow[];
};

const DEFAULT_SCAN_LIMIT = 5000;
const MAX_SCAN_LIMIT = 20000;
const DEFAULT_APPLY_LIMIT = 5000;
const PAGE_SIZE = 500;

function clampPositiveInt(value: unknown, fallbackValue: number, maxValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackValue;
  return Math.min(Math.floor(parsed), maxValue);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBareImageFileName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') || trimmed.includes('/') || trimmed.includes('\\')) return false;
  if (/^(https?:|data:|blob:|local:)/i.test(trimmed)) return false;
  return /\.(?:png|jpe?g|gif|webp|bmp|svg)(?:\?.*)?$/i.test(trimmed);
}

function sanitizeConfig(config: unknown): { nextConfig: unknown; changed: boolean } {
  if (!isPlainObject(config)) {
    return { nextConfig: config, changed: false };
  }

  const nextConfig: Record<string, unknown> = { ...config };
  let changed = false;

  const outputUrl = nextConfig.outputUrl;
  if (typeof outputUrl === 'string' && isBareImageFileName(outputUrl)) {
    delete nextConfig.outputUrl;
    changed = true;
  }

  const sourceImageUrl = nextConfig.sourceImageUrl;
  if (typeof sourceImageUrl === 'string' && isBareImageFileName(sourceImageUrl)) {
    delete nextConfig.sourceImageUrl;
    changed = true;
  }

  const sourceImageUrls = nextConfig.sourceImageUrls;
  if (Array.isArray(sourceImageUrls)) {
    const filtered = sourceImageUrls.filter((value) => !(typeof value === 'string' && isBareImageFileName(value)));
    if (filtered.length !== sourceImageUrls.length) {
      if (filtered.length === 0) {
        delete nextConfig.sourceImageUrls;
      } else {
        nextConfig.sourceImageUrls = filtered;
      }
      changed = true;
    }
  }

  return { nextConfig, changed };
}

async function scanMalformedRows(
  supabase: ReturnType<typeof getSupabaseClient>,
  scanLimit: number,
): Promise<ScanResult> {
  const matched: GenerationRow[] = [];
  let scanned = 0;
  let truncated = false;

  for (let offset = 0; offset < scanLimit; offset += PAGE_SIZE) {
    const upperBound = Math.min(offset + PAGE_SIZE - 1, scanLimit - 1);
    const { data, error } = await supabase
      .from('generations')
      .select('id,output_url,config,created_at')
      .not('output_url', 'is', null)
      .neq('output_url', '')
      .not('output_url', 'like', 'http%')
      .not('output_url', 'like', 'data:%')
      .not('output_url', 'like', 'blob:%')
      .not('output_url', 'like', 'local:%')
      .range(offset, upperBound)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const rows = (data || []) as GenerationRow[];
    if (rows.length === 0) {
      break;
    }

    scanned += rows.length;

    for (const row of rows) {
      if (typeof row.output_url === 'string' && isBareImageFileName(row.output_url)) {
        matched.push(row);
      }
    }

    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  if (scanned >= scanLimit) {
    truncated = true;
  }

  return { scanned, truncated, matched };
}

function formatSample(rows: GenerationRow[], limit = 20) {
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    outputUrl: row.output_url,
    createdAt: row.created_at || null,
  }));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scanLimit = clampPositiveInt(url.searchParams.get('scanLimit'), DEFAULT_SCAN_LIMIT, MAX_SCAN_LIMIT);
    const supabase = getSupabaseClient();
    const scan = await scanMalformedRows(supabase, scanLimit);

    return NextResponse.json({
      success: true,
      dryRun: true,
      scanLimit,
      scanned: scan.scanned,
      truncated: scan.truncated,
      matchedCount: scan.matched.length,
      sample: formatSample(scan.matched),
      hint: 'POST {"confirm": true} to apply cleanup',
    });
  } catch (error) {
    console.error('[cleanup-bare-image-urls] GET failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const confirm = body?.confirm === true;
    const scanLimit = clampPositiveInt(body?.scanLimit, DEFAULT_SCAN_LIMIT, MAX_SCAN_LIMIT);
    const applyLimit = clampPositiveInt(body?.applyLimit, DEFAULT_APPLY_LIMIT, scanLimit);

    if (!confirm) {
      return NextResponse.json({
        success: false,
        dryRun: true,
        message: 'Set confirm=true to apply cleanup.',
        scanLimit,
        applyLimit,
      }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const scan = await scanMalformedRows(supabase, scanLimit);
    const targets = scan.matched.slice(0, applyLimit);

    let updated = 0;
    let failed = 0;
    let configUpdated = 0;
    const failures: Array<{ id: string; error: string }> = [];

    for (const row of targets) {
      const patch: Record<string, unknown> = { output_url: null };
      const sanitized = sanitizeConfig(row.config);
      if (sanitized.changed) {
        patch.config = sanitized.nextConfig;
      }

      const { error } = await supabase
        .from('generations')
        .update(patch)
        .eq('id', row.id);

      if (error) {
        failed += 1;
        failures.push({ id: row.id, error: error.message });
        continue;
      }

      updated += 1;
      if (sanitized.changed) {
        configUpdated += 1;
      }
    }

    return NextResponse.json({
      success: true,
      applied: true,
      scanLimit,
      applyLimit,
      scanned: scan.scanned,
      truncated: scan.truncated,
      matchedCount: scan.matched.length,
      attempted: targets.length,
      updated,
      configUpdated,
      failed,
      failureSample: failures.slice(0, 20),
      sample: formatSample(targets),
    });
  } catch (error) {
    console.error('[cleanup-bare-image-urls] POST failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

