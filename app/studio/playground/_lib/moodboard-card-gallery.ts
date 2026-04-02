import { getApiBase } from '@/lib/api-base';
import type { PlaygroundShortcut, ShortcutPromptFieldDefinition } from '@/config/moodboard-cards';

const DEFAULT_SHORTCUT_MODEL = 'coze_seedream4_5';
const DEFAULT_SHORTCUT_ASPECT_RATIO = '1:1';

interface ShortcutLookupResponse {
  id?: string;
  code?: string;
  prompt_config?: Record<string, unknown>;
  promptConfig?: Record<string, unknown>;
}

export interface UpsertMoodboardShortcutOptions {
  name: string;
  prompt: string;
  imagePaths: string[];
  sourceStyleId?: string;
  preferredCode?: string;
  sortOrder?: number;
  modelId?: string;
  moodboardDescription?: string;
  promptFields?: ShortcutPromptFieldDefinition[];
}

function normalizeGalleryOrder(imagePaths: string[]): string[] {
  const deduped = new Set<string>();

  imagePaths.forEach((path) => {
    if (typeof path !== 'string') {
      return;
    }

    const normalized = path.trim();
    if (!normalized) {
      return;
    }

    deduped.add(normalized);
  });

  return Array.from(deduped);
}

function normalizeShortcutCodeSegment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'moodboard';
}

function buildBaseShortcutCode(options: {
  preferredCode?: string;
  sourceStyleId?: string;
  name: string;
}) {
  if (options.preferredCode?.trim()) {
    return normalizeShortcutCodeSegment(options.preferredCode.trim());
  }

  if (options.sourceStyleId?.trim()) {
    return normalizeShortcutCodeSegment(`mb-${options.sourceStyleId.trim()}`);
  }

  return normalizeShortcutCodeSegment(`mb-${options.name || 'moodboard'}`);
}

async function fetchShortcutByCode(code: string): Promise<ShortcutLookupResponse | null> {
  const response = await fetch(`${getApiBase()}/moodboard-cards/code/${encodeURIComponent(code)}`, {
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load shortcut by code: ${response.status}`);
  }

  return await response.json() as ShortcutLookupResponse;
}

function getSourceStyleIdFromShortcut(shortcut: ShortcutLookupResponse | null): string | null {
  if (!shortcut) {
    return null;
  }

  const promptConfig = shortcut.promptConfig || shortcut.prompt_config;
  if (!promptConfig || typeof promptConfig !== 'object') {
    return null;
  }

  const sourceStyleId = (promptConfig as Record<string, unknown>).sourceStyleId;
  return typeof sourceStyleId === 'string' && sourceStyleId.trim() ? sourceStyleId.trim() : null;
}

async function resolveShortcutCodeAndPersistedId(options: {
  baseCode: string;
  sourceStyleId?: string;
}): Promise<{ code: string; persistedId: string | null }> {
  let attempt = 1;
  let candidate = options.baseCode;

  while (attempt <= 50) {
    const existing = await fetchShortcutByCode(candidate);
    if (!existing) {
      return { code: candidate, persistedId: null };
    }

    const existingId = typeof existing.id === 'string' && existing.id.trim() ? existing.id.trim() : null;
    const existingSourceStyleId = getSourceStyleIdFromShortcut(existing);

    if (options.sourceStyleId && existingSourceStyleId === options.sourceStyleId && existingId) {
      return { code: candidate, persistedId: existingId };
    }

    attempt += 1;
    candidate = `${options.baseCode}-${attempt}`;
  }

  throw new Error(`Failed to allocate shortcut code from base "${options.baseCode}"`);
}

async function resolveShortcutPersistedId(shortcut: PlaygroundShortcut): Promise<string | null> {
  if (shortcut.persistedId) {
    return shortcut.persistedId;
  }

  const existing = await fetchShortcutByCode(shortcut.id);
  return existing?.id?.trim() || null;
}

export async function persistShortcutGalleryOrder(
  shortcut: PlaygroundShortcut,
  imagePaths: string[],
): Promise<void> {
  const galleryOrder = normalizeGalleryOrder(imagePaths);
  const persistedId = await resolveShortcutPersistedId(shortcut);
  const endpoint = persistedId
    ? `${getApiBase()}/moodboard-cards/${persistedId}`
    : `${getApiBase()}/moodboard-cards`;

  const payload = persistedId
    ? { galleryOrder }
    : {
      code: shortcut.id,
      name: shortcut.name,
      ...(typeof shortcut.sortOrder === 'number' ? { sortOrder: shortcut.sortOrder } : {}),
      modelId: shortcut.model,
      defaultAspectRatio: shortcut.aspectRatio,
      promptTemplate: shortcut.promptTemplate,
      promptFields: shortcut.promptFields,
      moodboardDescription: shortcut.detailDescription,
      galleryOrder,
      coverUrl: galleryOrder[0],
      isEnabled: true,
      publishStatus: 'published' as const,
    };

  const response = await fetch(endpoint, {
    method: persistedId ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || `Failed to persist shortcut gallery: ${response.status}`);
  }
}

export async function upsertMoodboardAsShortcut(
  options: UpsertMoodboardShortcutOptions,
): Promise<{ code: string; persistedId: string | null }> {
  const name = options.name.trim() || 'Moodboard';
  const prompt = options.prompt.trim();
  const galleryOrder = normalizeGalleryOrder(options.imagePaths);
  const baseCode = buildBaseShortcutCode({
    preferredCode: options.preferredCode,
    sourceStyleId: options.sourceStyleId,
    name,
  });

  const { code, persistedId } = await resolveShortcutCodeAndPersistedId({
    baseCode,
    sourceStyleId: options.sourceStyleId,
  });

  const payload = {
    code,
    name,
    sortOrder: options.sortOrder,
    modelId: options.modelId || DEFAULT_SHORTCUT_MODEL,
    defaultAspectRatio: DEFAULT_SHORTCUT_ASPECT_RATIO,
    promptTemplate: prompt,
    promptFields: options.promptFields || [],
    moodboardDescription: options.moodboardDescription?.trim() || prompt,
    galleryOrder,
    coverUrl: galleryOrder[0],
    promptConfig: options.sourceStyleId
      ? { sourceStyleId: options.sourceStyleId, migratedFrom: 'style_stacks' }
      : undefined,
    isEnabled: true,
    publishStatus: 'published' as const,
  };

  const response = await fetch(
    persistedId
      ? `${getApiBase()}/moodboard-cards/${persistedId}`
      : `${getApiBase()}/moodboard-cards`,
    {
      method: persistedId ? 'PATCH' : 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(raw || `Failed to save moodboard shortcut: ${response.status}`);
  }

  if (persistedId) {
    return { code, persistedId };
  }

  const created = await response.json() as ShortcutLookupResponse;
  return {
    code,
    persistedId: created.id?.trim() || null,
  };
}
