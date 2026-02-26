import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { EditPresetConfig, Generation, GenerationConfig } from '@/types/database';
import { normalizeGeneration } from '@/lib/adapters/data-mapping';
import { connectMongo, GenerationModel } from '@/server/db';
import { sanitizeMongoKeys, restoreMongoKeys } from '@/server/utils/mongo';

const OUTPUTS_DIR = path.join(process.cwd(), 'public', 'outputs');
const HISTORY_FILE = path.join(OUTPUTS_DIR, 'history.json');
const BACKUP_FILE = path.join(OUTPUTS_DIR, 'history.bak.json');
const OLD_FILE = path.join(OUTPUTS_DIR, 'history.old.json');

const MAX_HISTORY_ITEMS = 1000;

let mongoSeeded = false;
let historyWriteQueue: Promise<void> = Promise.resolve();

function runWithHistoryWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const run = historyWriteQueue.then(task, task);
  historyWriteQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function normalizePage(raw: string | null): number {
  const parsed = Number.parseInt(raw || '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeLimit(raw: string | null): number {
  const parsed = Number.parseInt(raw || '20', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 200);
}

function sanitizeSourceUrls(urls?: string[]): string[] {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }
  return urls.map((url) => {
    if (typeof url !== 'string') return '';
    if (url.length > 5000 && url.startsWith('data:')) {
      return '(large base64 data truncated)';
    }
    return url;
  });
}

function sanitizeMongoPayload(payload: Record<string, unknown>): Record<string, unknown> {
  return sanitizeMongoKeys(payload) as Record<string, unknown>;
}

function buildRecord(item: Generation): Generation {
  const outputUrl = item.outputUrl || (item.id ? `/outputs/${item.id}.png` : '');
  const config = (item.config || {}) as GenerationConfig;

  const record: Generation = {
    id: item.id || path.basename(outputUrl, path.extname(outputUrl)),
    userId: item.userId || 'anonymous',
    projectId: item.projectId || 'default',
    outputUrl,
    config: {
      ...config,
      sourceImageUrls: sanitizeSourceUrls(config.sourceImageUrls),
      isPreset: config.isPreset ?? !!config.presetName,
    },
    status: item.status || 'completed',
    createdAt: item.createdAt || new Date().toISOString(),
    progress: item.progress,
    progressStage: item.progressStage,
    llmResponse: item.llmResponse,
  };

  return normalizeGeneration(record);
}

function buildMongoFilter(item: Generation): Record<string, unknown> | null {
  const normalized = buildRecord(item);

  if (normalized.id && mongoose.isValidObjectId(normalized.id)) {
    return { _id: normalized.id };
  }

  if (normalized.outputUrl) {
    return { outputUrl: normalized.outputUrl };
  }

  const taskId = normalized.config?.taskId;
  if (typeof taskId === 'string' && taskId) {
    return { 'config.taskId': taskId };
  }

  return null;
}

function mapMongoDocToGeneration(doc: Record<string, unknown>): Generation {
  const restored = restoreMongoKeys(doc) as Record<string, unknown>;
  const config = (restored.config || {}) as GenerationConfig;
  const outputUrl = typeof restored.outputUrl === 'string' ? restored.outputUrl : '';

  const generation: Generation = {
    id: String(restored._id || restored.id || path.basename(outputUrl || '', path.extname(outputUrl || ''))),
    userId: (restored.userId as string) || 'anonymous',
    projectId: (restored.projectId as string) || 'default',
    outputUrl,
    config: {
      ...config,
      sourceImageUrls: sanitizeSourceUrls(config.sourceImageUrls),
      localSourceIds: Array.isArray(config.localSourceIds) ? config.localSourceIds : [],
    },
    status: (restored.status as 'pending' | 'completed' | 'failed') || 'completed',
    createdAt: String(restored.createdAt || new Date().toISOString()),
    progress: typeof restored.progress === 'number' ? restored.progress : undefined,
    progressStage: typeof restored.progressStage === 'string' ? restored.progressStage : undefined,
    llmResponse: typeof restored.llmResponse === 'string' ? restored.llmResponse : undefined,
  };

  return normalizeGeneration(generation);
}

function toLightweightHistoryItem(item: Generation): Generation {
  const config = (item.config || {}) as GenerationConfig;
  const nextConfig: GenerationConfig = { ...config };

  // Large snapshots are not needed for gallery list pagination.
  delete nextConfig.tldrawSnapshot;

  if (nextConfig.editConfig) {
    const editConfig = {
      ...(nextConfig.editConfig as EditPresetConfig & {
      canvasJson?: Record<string, unknown>;
      tldrawSnapshot?: Record<string, unknown>;
      }),
    };
    const { canvasJson: _canvasJson, tldrawSnapshot: _tldrawSnapshot, ...restEditConfig } = editConfig;
    void _canvasJson;
    void _tldrawSnapshot;
    nextConfig.editConfig = restEditConfig as EditPresetConfig;
  }

  const lightweightItem: Generation = {
    ...item,
    llmResponse: undefined,
    config: nextConfig,
  };

  return normalizeGeneration(lightweightItem);
}

function sanitizeMinimalSourceUrls(urls?: string[]): string[] {
  if (!Array.isArray(urls) || urls.length === 0) {
    return [];
  }

  return urls
    .filter((url): url is string => typeof url === 'string' && !!url)
    .filter((url) => !url.startsWith('data:') && url.length <= 2048)
    .slice(0, 4);
}

function toMinimalGalleryHistoryItem(item: Generation): Generation {
  const config = (item.config || {}) as GenerationConfig;
  const width = Number(config.width);
  const height = Number(config.height);
  const minimalConfig: GenerationConfig = {
    __minimal: true,
    prompt: typeof config.prompt === 'string' ? config.prompt : '',
    width: Number.isFinite(width) && width > 0 ? width : 1024,
    height: Number.isFinite(height) && height > 0 ? height : 1024,
    model: typeof config.model === 'string' ? config.model : '',
    baseModel: typeof config.baseModel === 'string' ? config.baseModel : undefined,
    loras: Array.isArray(config.loras) ? config.loras : [],
    presetName: typeof config.presetName === 'string' ? config.presetName : undefined,
    isPreset: config.isPreset ?? !!config.presetName,
    sourceImageUrls: sanitizeMinimalSourceUrls(config.sourceImageUrls),
    localSourceIds: Array.isArray(config.localSourceIds)
      ? config.localSourceIds.filter((id): id is string => typeof id === 'string').slice(0, 4)
      : [],
    imageSize: config.imageSize,
    aspectRatio: config.aspectRatio,
    sizeFrom: config.sizeFrom,
    isEdit: Boolean(config.isEdit),
    parentId: typeof config.parentId === 'string' ? config.parentId : undefined,
    workflowName: typeof config.workflowName === 'string' ? config.workflowName : undefined,
    editConfig: config.editConfig?.originalImageUrl
      ? ({
        originalImageUrl: config.editConfig.originalImageUrl,
        canvasJson: {},
        referenceImages: [],
        annotations: [],
        backgroundColor: '#000000',
        canvasSize: { width: 0, height: 0 },
      } as EditPresetConfig)
      : undefined,
    generationMode: config.generationMode === 'banner' ? 'banner' : 'playground',
    bannerTemplateId: typeof config.bannerTemplateId === 'string' ? config.bannerTemplateId : undefined,
    bannerFields: config.bannerFields && typeof config.bannerFields === 'object'
      ? {
        mainTitle: typeof config.bannerFields.mainTitle === 'string' ? config.bannerFields.mainTitle : '',
        subTitle: typeof config.bannerFields.subTitle === 'string' ? config.bannerFields.subTitle : '',
        timeText: typeof config.bannerFields.timeText === 'string' ? config.bannerFields.timeText : '',
        extraDesc: typeof config.bannerFields.extraDesc === 'string' ? config.bannerFields.extraDesc : '',
      }
      : undefined,
    bannerTextPositions: Array.isArray(config.bannerTextPositions)
      ? config.bannerTextPositions
        .filter((item) => Boolean(item) && typeof item === 'object')
        .map((item, index) => ({
          id: typeof item.id === 'string' ? item.id : `banner-text-position-${index + 1}`,
          label: typeof item.label === 'string' ? item.label : '',
          type: item.type === 'mainTitle' || item.type === 'subTitle' || item.type === 'timeText' || item.type === 'custom'
            ? item.type
            : 'custom',
          x: typeof item.x === 'number' ? item.x : undefined,
          y: typeof item.y === 'number' ? item.y : undefined,
          note: typeof item.note === 'string' ? item.note : '',
        }))
      : undefined,
    bannerPromptFinal: typeof config.bannerPromptFinal === 'string' ? config.bannerPromptFinal : undefined,
  };

  return normalizeGeneration({
    id: item.id,
    userId: item.userId || 'anonymous',
    projectId: item.projectId || 'default',
    outputUrl: item.outputUrl || '',
    config: minimalConfig,
    status: item.status || 'completed',
    createdAt: item.createdAt || new Date().toISOString(),
    progress: typeof item.progress === 'number' ? item.progress : undefined,
    progressStage: item.progressStage,
    llmResponse: undefined,
  });
}

async function getHistoryItemFromMongo(params: {
  id?: string | null;
  outputUrl?: string | null;
  projectId?: string | null;
  userId?: string | null;
  lightweight?: boolean;
  minimal?: boolean;
}): Promise<Generation | null> {
  return withMongo(async () => {
    await seedMongoFromLegacyIfNeeded();

    const filter: Record<string, unknown> = {};
    if (params.projectId && params.projectId !== 'null' && params.projectId !== 'undefined') {
      filter.projectId = params.projectId;
    }

    if (params.userId) {
      filter.userId = params.userId;
    }

    const conditions: Array<Record<string, unknown>> = [];
    const normalizedId = (params.id || '').trim();
    const normalizedOutputUrl = (params.outputUrl || '').trim();

    if (normalizedId) {
      if (mongoose.isValidObjectId(normalizedId)) {
        conditions.push({ _id: normalizedId });
      }
      conditions.push({ outputUrl: normalizedId });
      conditions.push({ 'config.taskId': normalizedId });
    }

    if (normalizedOutputUrl) {
      conditions.push({ outputUrl: normalizedOutputUrl });
    }

    if (conditions.length === 0) {
      return null;
    }

    if (conditions.length === 1) {
      Object.assign(filter, conditions[0]);
    } else {
      filter.$or = conditions;
    }

    let query = GenerationModel.findOne(filter);

    if (params.minimal) {
      query = query.select({
        outputUrl: 1,
        status: 1,
        createdAt: 1,
        userId: 1,
        projectId: 1,
        progress: 1,
        progressStage: 1,
        'config.prompt': 1,
        'config.width': 1,
        'config.height': 1,
        'config.model': 1,
        'config.baseModel': 1,
        'config.loras': 1,
        'config.presetName': 1,
        'config.isPreset': 1,
        'config.sourceImageUrls': 1,
        'config.localSourceIds': 1,
        'config.imageSize': 1,
        'config.aspectRatio': 1,
        'config.sizeFrom': 1,
        'config.workflowName': 1,
        'config.isEdit': 1,
        'config.parentId': 1,
        'config.editConfig.originalImageUrl': 1,
        'config.generationMode': 1,
        'config.bannerTemplateId': 1,
        'config.bannerFields': 1,
        'config.bannerPromptFinal': 1,
      });
    } else if (params.lightweight) {
      query = query.select({
        llmResponse: 0,
        'config.tldrawSnapshot': 0,
        'config.editConfig.canvasJson': 0,
        'config.editConfig.tldrawSnapshot': 0,
      });
    }

    const doc = await query.lean();
    if (!doc) {
      return null;
    }

    const item = mapMongoDocToGeneration(doc as unknown as Record<string, unknown>);
    if (params.minimal) {
      return toMinimalGalleryHistoryItem(item);
    }
    if (params.lightweight) {
      return toLightweightHistoryItem(item);
    }
    return item;
  });
}

async function getHistoryItemFromFile(params: {
  id?: string | null;
  outputUrl?: string | null;
  projectId?: string | null;
  userId?: string | null;
  lightweight?: boolean;
  minimal?: boolean;
}): Promise<Generation | null> {
  let history = await readHistoryFileFallback();
  if (!history || history.length === 0) {
    history = await readHistoryFromDisk();
  }

  if (!history || history.length === 0) {
    return null;
  }

  let filtered = history;

  if (params.projectId && params.projectId !== 'null' && params.projectId !== 'undefined') {
    filtered = filtered.filter((item) => item.projectId === params.projectId);
  }

  if (params.userId) {
    filtered = filtered.filter(
      (item) => item.userId === params.userId || (!item.userId && params.userId === 'user-1') || (item.userId === 'anonymous' && params.userId === 'user-1'),
    );
  }

  const normalizedId = (params.id || '').trim();
  const normalizedOutputUrl = (params.outputUrl || '').trim();
  const outputFromId = normalizedId ? `/outputs/${normalizedId}.png` : '';

  const matched = filtered.find((item) => {
    if (normalizedOutputUrl && item.outputUrl === normalizedOutputUrl) {
      return true;
    }
    if (!normalizedId) {
      return false;
    }
    return item.id === normalizedId || item.outputUrl === normalizedId || item.outputUrl === outputFromId;
  });

  if (!matched) {
    return null;
  }

  const normalized = normalizeGeneration(matched);
  if (params.minimal) {
    return toMinimalGalleryHistoryItem(normalized);
  }
  if (params.lightweight) {
    return toLightweightHistoryItem(normalized);
  }
  return normalized;
}

async function ensureOutputsDir() {
  try {
    await fs.access(OUTPUTS_DIR);
  } catch {
    await fs.mkdir(OUTPUTS_DIR, { recursive: true });
  }
}

async function readHistoryFileFallback(): Promise<Generation[] | null> {
  const filesToTry = [HISTORY_FILE, OLD_FILE, BACKUP_FILE];

  for (const file of filesToTry) {
    try {
      await fs.access(file);
      const content = await fs.readFile(file, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        return data.map((item) => normalizeGeneration(item as Generation));
      }
    } catch {
      // Ignore and try next file.
    }
  }

  return null;
}

async function saveHistoryFileFallback(history: Generation[]): Promise<boolean> {
  const tmpFile = `${HISTORY_FILE}.tmp`;
  const itemsToSave = history.slice(0, MAX_HISTORY_ITEMS).map(buildRecord);

  try {
    await fs.writeFile(tmpFile, JSON.stringify(itemsToSave), 'utf-8');

    try {
      await fs.access(HISTORY_FILE);
      await fs.copyFile(HISTORY_FILE, OLD_FILE);
    } catch {
      // Ignore if not exists.
    }

    await fs.rename(tmpFile, HISTORY_FILE);

    if (history.length % 50 === 0) {
      await fs.copyFile(HISTORY_FILE, BACKUP_FILE);
    } else {
      try {
        await fs.access(BACKUP_FILE);
      } catch {
        await fs.copyFile(HISTORY_FILE, BACKUP_FILE);
      }
    }

    return true;
  } catch (error) {
    console.error('[HistoryAPI] Atomic file save failed:', error);
    try {
      await fs.unlink(tmpFile);
    } catch {
      // Ignore cleanup error.
    }
    return false;
  }
}

async function readHistoryFromDisk(): Promise<Generation[]> {
  await ensureOutputsDir();

  const files = await fs.readdir(OUTPUTS_DIR);
  const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

  const items = await Promise.all(
    files
      .filter((fileName) => imageExtensions.has(path.extname(fileName).toLowerCase()))
      .map(async (fileName) => {
        const baseName = fileName.split('.')[0];
        const jsonPath = path.join(OUTPUTS_DIR, `${baseName}.json`);
        const outputUrl = `/outputs/${fileName}`;

        let metadata: Record<string, unknown> | null = null;
        try {
          const jsonContent = await fs.readFile(jsonPath, 'utf-8');
          metadata = JSON.parse(jsonContent) as Record<string, unknown>;
        } catch {
          // Ignore sidecar parse errors.
        }

        let createdAt = metadata?.timestamp as string | undefined;
        if (!createdAt) {
          const parts = baseName.split('_');
          const stampStr = parts[1];
          if (stampStr && !Number.isNaN(Number(stampStr))) {
            createdAt = new Date(Number(stampStr)).toISOString();
          } else {
            const stats = await fs.stat(path.join(OUTPUTS_DIR, fileName));
            createdAt = stats.mtime.toISOString();
          }
        }

        const baseConfig = ((metadata?.config as Record<string, unknown>) || (metadata?.metadata as Record<string, unknown>) || {}) as Record<string, unknown>;
        const generation: Generation = {
          id: baseName,
          userId: 'anonymous',
          projectId: (metadata?.projectId as string) || ((metadata?.metadata as Record<string, unknown>)?.projectId as string) || 'default',
          outputUrl,
          config: {
            ...baseConfig,
            prompt: (baseConfig.prompt as string) || (metadata?.prompt as string) || '',
            width: Number(baseConfig.width || metadata?.img_width || 1024),
            height: Number(baseConfig.height || metadata?.img_height || 1024),
            model: (baseConfig.model as string) || (metadata?.base_model as string) || '',
            baseModel: (baseConfig.baseModel as string) || (baseConfig.model as string) || (metadata?.base_model as string) || '',
            sourceImageUrls: (baseConfig.sourceImageUrls as string[]) || (metadata?.sourceImageUrls as string[]) || [],
          },
          status: 'completed',
          createdAt: String((metadata?.createdAt as string) || createdAt),
        };

        return normalizeGeneration(generation);
      }),
  );

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

async function updateSidecarMetadata(item: Generation): Promise<void> {
  const outputUrl = item.outputUrl;
  if (!outputUrl || !outputUrl.startsWith('/outputs/')) {
    return;
  }

  const baseName = path.basename(outputUrl, path.extname(outputUrl));
  const jsonPath = path.join(OUTPUTS_DIR, `${baseName}.json`);

  try {
    let metadata: Record<string, unknown> = {};
    try {
      const content = await fs.readFile(jsonPath, 'utf-8');
      metadata = JSON.parse(content) as Record<string, unknown>;
    } catch {
      // Ignore if sidecar does not exist.
    }

    const updatedMetadata = {
      ...metadata,
      projectId: item.projectId,
      config: item.config,
      createdAt: item.createdAt,
    };

    await fs.writeFile(jsonPath, JSON.stringify(updatedMetadata, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`[HistoryAPI] Failed to update sidecar metadata for ${baseName}:`, error);
  }
}

async function withMongo<T>(task: () => Promise<T>): Promise<T | null> {
  try {
    await connectMongo();
    return await task();
  } catch (error) {
    console.warn('[HistoryAPI] Mongo unavailable, fallback to file storage:', error);
    return null;
  }
}

async function seedMongoFromLegacyIfNeeded(): Promise<void> {
  if (mongoSeeded) {
    return;
  }

  const seeded = await withMongo(async () => {
    const currentCount = await GenerationModel.estimatedDocumentCount();
    if (currentCount > 0) {
      return true;
    }

    let legacyHistory = await readHistoryFileFallback();
    if (!legacyHistory || legacyHistory.length === 0) {
      legacyHistory = await readHistoryFromDisk();
    }

    if (!legacyHistory || legacyHistory.length === 0) {
      return true;
    }

    const operations = legacyHistory
      .slice(0, MAX_HISTORY_ITEMS)
      .map((item) => {
        const record = buildRecord(item);
        const filter = buildMongoFilter(record);
        if (!filter) {
          return null;
        }
        return {
          updateOne: {
            filter,
                update: {
                  $set: sanitizeMongoPayload({
                    userId: record.userId,
                    projectId: record.projectId,
                    outputUrl: record.outputUrl,
                config: record.config,
                status: record.status,
                progress: record.progress,
                progressStage: record.progressStage,
                llmResponse: record.llmResponse,
                createdAt: record.createdAt,
              }),
            },
            upsert: true,
          },
        };
      })
      .filter(Boolean);

    if (operations.length > 0) {
      await GenerationModel.bulkWrite(operations as mongoose.mongo.AnyBulkWriteOperation[], { ordered: false });
    }

    return true;
  });

  if (seeded) {
    mongoSeeded = true;
  }
}

async function getHistoryFromMongo(params: {
  page: number;
  limit: number;
  projectId?: string | null;
  userId?: string | null;
  lightweight?: boolean;
  minimal?: boolean;
}): Promise<{ history: Generation[]; total: number; hasMore: boolean } | null> {
  return withMongo(async () => {
    await seedMongoFromLegacyIfNeeded();

    const filter: Record<string, unknown> = {};
    if (params.projectId && params.projectId !== 'null' && params.projectId !== 'undefined') {
      filter.projectId = params.projectId;
    }

    if (params.userId) {
      filter.userId = params.userId;
    }

    const total = await GenerationModel.countDocuments(filter);
    let query = GenerationModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((params.page - 1) * params.limit)
      .limit(params.limit);

    if (params.minimal) {
      query = query.select({
        outputUrl: 1,
        status: 1,
        createdAt: 1,
        userId: 1,
        projectId: 1,
        progress: 1,
        progressStage: 1,
        'config.prompt': 1,
        'config.width': 1,
        'config.height': 1,
        'config.model': 1,
        'config.baseModel': 1,
        'config.loras': 1,
        'config.presetName': 1,
        'config.isPreset': 1,
        'config.sourceImageUrls': 1,
        'config.localSourceIds': 1,
        'config.imageSize': 1,
        'config.aspectRatio': 1,
        'config.sizeFrom': 1,
        'config.workflowName': 1,
        'config.isEdit': 1,
        'config.parentId': 1,
        'config.editConfig.originalImageUrl': 1,
        'config.generationMode': 1,
        'config.bannerTemplateId': 1,
        'config.bannerFields': 1,
        'config.bannerPromptFinal': 1,
      });
    } else if (params.lightweight) {
      query = query.select({
        llmResponse: 0,
        'config.tldrawSnapshot': 0,
        'config.editConfig.canvasJson': 0,
        'config.editConfig.tldrawSnapshot': 0,
      });
    }

    const docs = await query.lean();

    const history = docs.map((doc) => mapMongoDocToGeneration(doc as unknown as Record<string, unknown>));
    return {
      history,
      total,
      hasMore: params.page * params.limit < total,
    };
  });
}

async function getHistoryFromFile(params: {
  page: number;
  limit: number;
  projectId?: string | null;
  userId?: string | null;
}): Promise<{ history: Generation[]; total: number; hasMore: boolean }> {
  let history = await readHistoryFileFallback();

  let hasChanges = false;
  if (!history || history.length === 0) {
    history = await readHistoryFromDisk();
    hasChanges = true;
  } else {
    try {
      await ensureOutputsDir();
      const files = await fs.readdir(OUTPUTS_DIR);
      const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
      const existingFiles = new Set(
        history.map((item) => {
          const outputUrl = item.outputUrl || '';
          return path.basename(outputUrl);
        }),
      );

      const newFiles = files.filter((fileName) => {
        const ext = path.extname(fileName).toLowerCase();
        return imageExtensions.has(ext) && !existingFiles.has(fileName);
      });

      if (newFiles.length > 0) {
        const latestFromDisk = await readHistoryFromDisk();
        const byOutputUrl = new Map<string, Generation>();

        for (const item of latestFromDisk) {
          byOutputUrl.set(item.outputUrl, item);
        }
        for (const item of history) {
          byOutputUrl.set(item.outputUrl, item);
        }

        history = Array.from(byOutputUrl.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        hasChanges = true;
      }
    } catch (error) {
      console.error('[HistoryAPI] Incremental disk sync failed:', error);
    }
  }

  if (hasChanges && history && history.length > 0) {
    await saveHistoryFileFallback(history);
  }

  let filtered = history || [];

  if (params.projectId && params.projectId !== 'null' && params.projectId !== 'undefined') {
    filtered = filtered.filter((item) => item.projectId === params.projectId);
  }

  if (params.userId) {
    filtered = filtered.filter(
      (item) => item.userId === params.userId || (!item.userId && params.userId === 'user-1') || (item.userId === 'anonymous' && params.userId === 'user-1'),
    );
  }

  const total = filtered.length;
  const startIndex = (params.page - 1) * params.limit;
  const paged = filtered.slice(startIndex, startIndex + params.limit).map(normalizeGeneration);

  return {
    history: paged,
    total,
    hasMore: startIndex + params.limit < total,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const outputUrl = searchParams.get('outputUrl');
    const page = normalizePage(searchParams.get('page'));
    const limit = normalizeLimit(searchParams.get('limit'));
    const projectId = searchParams.get('projectId');
    const userId = searchParams.get('userId');
    const lightweight = searchParams.get('lightweight') === '1' || searchParams.get('lightweight') === 'true';
    const minimal = searchParams.get('minimal') === '1' || searchParams.get('minimal') === 'true';

    if (id || outputUrl) {
      const mongoItem = await getHistoryItemFromMongo({ id, outputUrl, projectId, userId, lightweight, minimal });
      if (mongoItem) {
        return NextResponse.json({ item: mongoItem });
      }

      const fallbackItem = await getHistoryItemFromFile({ id, outputUrl, projectId, userId, lightweight, minimal });
      if (fallbackItem) {
        return NextResponse.json({ item: fallbackItem });
      }

      return NextResponse.json({ error: 'History item not found' }, { status: 404 });
    }

    const mongoResult = await getHistoryFromMongo({ page, limit, projectId, userId, lightweight, minimal });
    if (mongoResult) {
      if (!lightweight && !minimal) {
        return NextResponse.json(mongoResult);
      }

      if (minimal) {
        return NextResponse.json({
          ...mongoResult,
          history: mongoResult.history.map(toMinimalGalleryHistoryItem),
        });
      }

      return NextResponse.json({
        ...mongoResult,
        history: mongoResult.history.map(toLightweightHistoryItem),
      });
    }

    const fallbackResult = await getHistoryFromFile({ page, limit, projectId, userId });
    if (!lightweight && !minimal) {
      return NextResponse.json(fallbackResult);
    }

    if (minimal) {
      return NextResponse.json({
        ...fallbackResult,
        history: fallbackResult.history.map(toMinimalGalleryHistoryItem),
      });
    }

    return NextResponse.json({
      ...fallbackResult,
      history: fallbackResult.history.map(toLightweightHistoryItem),
    });
  } catch (error) {
    console.error('[HistoryAPI] Failed to load history:', error);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    return runWithHistoryWriteLock(async () => {
      const mongoHandled = await withMongo(async () => {
        await seedMongoFromLegacyIfNeeded();

        if (body.action === 'sync-image' && body.localId && body.path) {
          const localId = String(body.localId);
          const serverPath = String(body.path);

          const docs = await GenerationModel.find({ 'config.localSourceIds': localId }).lean();
          if (docs.length === 0) {
            return NextResponse.json({ success: true, updatedCount: 0 });
          }

          const operations: mongoose.mongo.AnyBulkWriteOperation[] = [];
          let updatedCount = 0;

          for (const doc of docs) {
            const normalized = mapMongoDocToGeneration(doc as unknown as Record<string, unknown>);
            const localSourceIds = normalized.config.localSourceIds || [];
            const sourceImageUrls = normalized.config.sourceImageUrls || [];

            const indexes = localSourceIds
              .map((id, idx) => (id === localId ? idx : -1))
              .filter((idx) => idx >= 0);

            if (indexes.length === 0) continue;

            const newUrls = [...sourceImageUrls];
            for (const idx of indexes) {
              if (idx < newUrls.length) {
                newUrls[idx] = serverPath;
              }
            }

            updatedCount += indexes.length;
            const syncFilter = normalized.outputUrl
              ? { outputUrl: normalized.outputUrl }
              : { _id: String((doc as { _id: unknown })._id || '') };
            operations.push({
              updateOne: {
                filter: syncFilter as Record<string, unknown>,
                update: {
                  $set: sanitizeMongoPayload({
                    config: {
                      ...normalized.config,
                      sourceImageUrls: newUrls,
                    },
                  }),
                },
              },
            });
          }

          if (operations.length > 0) {
            await GenerationModel.bulkWrite(operations, { ordered: false });
          }

          return NextResponse.json({ success: true, updatedCount });
        }

        if (body.action === 'batch-update' && Array.isArray(body.items)) {
          const items = (body.items as Generation[]).map(buildRecord);
          const operations: mongoose.mongo.AnyBulkWriteOperation[] = [];

          for (const item of items) {
            const filter = buildMongoFilter(item);
            if (!filter) continue;

            operations.push({
              updateOne: {
                filter: filter as Record<string, unknown>,
                update: {
                  $set: sanitizeMongoPayload({
                    userId: item.userId,
                    projectId: item.projectId,
                    outputUrl: item.outputUrl,
                    config: item.config,
                    status: item.status,
                    progress: item.progress,
                    progressStage: item.progressStage,
                    llmResponse: item.llmResponse,
                    createdAt: item.createdAt,
                  }),
                },
                upsert: true,
              },
            });
          }

          if (operations.length > 0) {
            await GenerationModel.bulkWrite(operations, { ordered: false });
          }

          await Promise.all(items.map(updateSidecarMetadata));
          return NextResponse.json({ success: true });
        }

        const item = body as Generation;
        if (!item || (!item.outputUrl && !item.id)) {
          return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
        }

        const record = buildRecord(item);
        const filter = buildMongoFilter(record);
        if (!filter) {
          return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
        }

        await GenerationModel.updateOne(
          filter as Record<string, unknown>,
          {
            $set: sanitizeMongoPayload({
              userId: record.userId,
              projectId: record.projectId,
              outputUrl: record.outputUrl,
              config: record.config,
              status: record.status,
              progress: record.progress,
              progressStage: record.progressStage,
              llmResponse: record.llmResponse,
              createdAt: record.createdAt,
            }),
          },
          { upsert: true },
        );

        await updateSidecarMetadata(record);
        return NextResponse.json({ success: true });
      });

      if (mongoHandled) {
        return mongoHandled;
      }

      if (body.action === 'sync-image' && body.localId && body.path) {
        const { localId, path: serverPath } = body as { localId: string; path: string };
        const history = (await readHistoryFileFallback()) || [];

        let updatedCount = 0;
        const updatedHistory = history.map((item) => {
          const current = buildRecord(item);
          const localSourceIds = current.config.localSourceIds || [];
          const sourceImageUrls = current.config.sourceImageUrls || [];

          if (!localSourceIds.includes(localId)) {
            return current;
          }

          const newUrls = [...sourceImageUrls];
          for (let i = 0; i < localSourceIds.length; i += 1) {
            if (localSourceIds[i] === localId && i < newUrls.length) {
              newUrls[i] = serverPath;
              updatedCount += 1;
            }
          }

          return {
            ...current,
            config: {
              ...current.config,
              sourceImageUrls: newUrls,
            },
          };
        });

        if (updatedCount > 0) {
          await saveHistoryFileFallback(updatedHistory);
        }

        return NextResponse.json({ success: true, updatedCount });
      }

      if (body.action === 'batch-update' && Array.isArray(body.items)) {
        const items = (body.items as Generation[]).map(buildRecord);
        const history = ((await readHistoryFileFallback()) || []).map(buildRecord);
        const indexByKey = new Map<string, number>();

        history.forEach((item, idx) => {
          const key = item.outputUrl || item.id;
          indexByKey.set(key, idx);
        });

        for (const item of items) {
          const key = item.outputUrl || item.id;
          const idx = indexByKey.get(key);
          if (typeof idx === 'number') {
            history[idx] = { ...history[idx], ...item };
          } else {
            history.unshift(item);
          }
        }

        await Promise.all(items.map(updateSidecarMetadata));
        const success = await saveHistoryFileFallback(history);
        if (!success) {
          throw new Error('Failed to persist history');
        }

        return NextResponse.json({ success: true });
      }

      const item = body as Generation;
      if (!item || (!item.outputUrl && !item.id)) {
        return NextResponse.json({ error: 'Invalid item' }, { status: 400 });
      }

      const record = buildRecord(item);
      const history = ((await readHistoryFileFallback()) || []).map(buildRecord);
      const existsIndex = history.findIndex((row) => row.outputUrl === record.outputUrl || row.id === record.id);

      if (existsIndex >= 0) {
        history[existsIndex] = record;
      } else {
        history.unshift(record);
      }

      await updateSidecarMetadata(record);
      const success = await saveHistoryFileFallback(history);
      if (!success) {
        throw new Error('Failed to persist history');
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error('[HistoryAPI] Failed to save history item:', error);
    return NextResponse.json({ error: 'Failed to save history item' }, { status: 500 });
  }
}
