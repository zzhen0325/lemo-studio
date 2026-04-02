import { extractStorageKeyFromPresignedUrl, STORAGE_KEY_PREFIX } from '@/lib/api-base';
import type { Generation } from '@/types/database';

/**
 * Build a stable identity for moodboard image paths so we can map them back
 * to original history/gallery generation records.
 */
export function getMoodboardImageMatchKey(url: string | undefined | null): string {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith(STORAGE_KEY_PREFIX)) {
    return `storage:${trimmed}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const storageKey = extractStorageKeyFromPresignedUrl(trimmed);
    if (storageKey) {
      return `storage:${storageKey}`;
    }
  }

  return `raw:${trimmed}`;
}

export function buildGenerationOutputLookup(items: Generation[]): Map<string, Generation> {
  const lookup = new Map<string, Generation>();

  for (const item of items) {
    const key = getMoodboardImageMatchKey(item.outputUrl);
    if (!key) {
      continue;
    }

    const existing = lookup.get(key);
    if (!existing) {
      lookup.set(key, item);
      continue;
    }

    const existingHasPrompt = Boolean(existing.config?.prompt?.trim());
    const nextHasPrompt = Boolean(item.config?.prompt?.trim());
    if (!existingHasPrompt && nextHasPrompt) {
      lookup.set(key, item);
    }
  }

  return lookup;
}
