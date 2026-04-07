import { describe, expect, it } from 'vitest';

import type { Generation, GenerationConfig } from '@/types/database';
import type { PlaygroundState } from '@/lib/store/playground-store.types';
import {
  normalizePersistedGalleryState,
  partializePlaygroundState,
} from '@/lib/store/playground-store.persist';
import {
  GALLERY_PAGE_LIMIT,
  PERSISTED_GALLERY_LIMIT,
} from '@/lib/store/playground-store.helpers';

function createConfig(index: number): GenerationConfig {
  return {
    prompt: `Prompt ${index}`,
    width: 1024,
    height: 1024,
    model: 'coze_seedream4_5',
    presetName: `Preset ${index}`,
    sourceImageUrls: [
      `upload/source-${index}.png`,
      'data:image/png;base64,abc',
      ''.padEnd(1201, 'x'),
    ],
    promptCategory: 'standard_generation',
    historyRecordType: 'generation',
    loras: [{ model_name: 'lora.safetensors', strength: 0.6 }],
    workflowName: 'workflow',
  };
}

function createGeneration(index: number): Generation {
  return {
    id: `gen-${index}`,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `upload/output-${index}.png`,
    config: createConfig(index),
    status: 'completed',
    createdAt: `2026-04-05T00:${String(index % 60).padStart(2, '0')}:00.000Z`,
    llmResponse: 'raw response',
  };
}

function createState(overrides: Partial<PlaygroundState> = {}): PlaygroundState {
  return {
    config: createConfig(0),
    selectedModel: 'coze_seedream4_5',
    selectedWorkflowConfig: undefined,
    selectedLoras: [],
    isAspectRatioLocked: false,
    viewMode: 'dock',
    visitorId: 'visitor-1',
    generationHistory: [],
    presets: [],
    styles: [],
    uploadedImages: [],
    describeImages: [],
    galleryItems: [],
    galleryPage: 1,
    hasMoreGallery: true,
    galleryLastSyncAt: 123,
    _galleryLoaded: false,
    ...overrides,
  } as unknown as PlaygroundState;
}

describe('partializePlaygroundState', () => {
  it('heals truncated gallery cache metadata and keeps only compact fields', () => {
    const galleryItems = Array.from({ length: PERSISTED_GALLERY_LIMIT + 15 }, (_, index) => createGeneration(index));
    const state = createState({
      galleryItems,
      galleryPage: 18,
      hasMoreGallery: false,
      _galleryLoaded: true,
    });

    const persisted = partializePlaygroundState(state);

    expect(persisted.galleryItems).toHaveLength(PERSISTED_GALLERY_LIMIT);
    expect(persisted.galleryPage).toBe(PERSISTED_GALLERY_LIMIT / GALLERY_PAGE_LIMIT);
    expect(persisted.hasMoreGallery).toBe(true);
    expect(persisted._galleryLoaded).toBe(true);

    const first = persisted.galleryItems[0];
    expect(first).toMatchObject({
      id: 'gen-0',
      userId: 'user-1',
      projectId: 'default',
      outputUrl: 'upload/output-0.png',
      status: 'completed',
      createdAt: '2026-04-05T00:00:00.000Z',
      config: {
        prompt: 'Prompt 0',
        model: 'coze_seedream4_5',
        presetName: 'Preset 0',
        width: 1024,
        height: 1024,
        promptCategory: 'standard_generation',
        historyRecordType: 'generation',
      },
    });

    expect(first.config.sourceImageUrls).toEqual(['upload/source-0.png']);
    const compactConfig = first.config as Record<string, unknown>;
    expect('loras' in compactConfig).toBe(false);
    expect('workflowName' in compactConfig).toBe(false);
  });

  it('preserves a real end-of-gallery state when cache is not truncated', () => {
    const galleryItems = Array.from({ length: GALLERY_PAGE_LIMIT * 2 }, (_, index) => createGeneration(index));
    const state = createState({
      galleryItems,
      galleryPage: 99,
      hasMoreGallery: false,
      _galleryLoaded: true,
    });

    const persisted = partializePlaygroundState(state);

    expect(persisted.galleryItems).toHaveLength(galleryItems.length);
    expect(persisted.galleryPage).toBe(2);
    expect(persisted.hasMoreGallery).toBe(false);
    expect(persisted._galleryLoaded).toBe(true);
  });

  it('resets empty gallery cache back to initial paging semantics', () => {
    const persisted = partializePlaygroundState(createState({
      galleryItems: [],
      galleryPage: 8,
      hasMoreGallery: false,
      _galleryLoaded: true,
    }));

    expect(persisted.galleryItems).toEqual([]);
    expect(persisted.galleryPage).toBe(1);
    expect(persisted.hasMoreGallery).toBe(true);
    expect(persisted._galleryLoaded).toBe(false);
  });
});

describe('normalizePersistedGalleryState', () => {
  it('matches the gallery metadata written by partialize for shared rehydrate behavior', () => {
    const state = createState({
      galleryItems: Array.from({ length: PERSISTED_GALLERY_LIMIT + 30 }, (_, index) => createGeneration(index)),
      galleryPage: 42,
      hasMoreGallery: false,
      _galleryLoaded: true,
    });

    const normalized = normalizePersistedGalleryState(state);
    const persisted = partializePlaygroundState(state);

    expect(normalized).toEqual({
      galleryItems: persisted.galleryItems,
      galleryPage: persisted.galleryPage,
      hasMoreGallery: persisted.hasMoreGallery,
      _galleryLoaded: persisted._galleryLoaded,
    });
  });
});
