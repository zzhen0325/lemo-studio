import { describe, expect, it } from 'vitest';

import type { Generation, GenerationConfig } from '@/types/database';
import type { PlaygroundState } from '@/lib/store/playground-store.types';
import { partializePlaygroundState } from '@/lib/store/playground-store.persist';
import { PERSISTED_GALLERY_LIMIT } from '@/lib/store/playground-store.helpers';

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

describe('partializePlaygroundState', () => {
  it('caps persisted gallery items and keeps only compact fields', () => {
    const galleryItems = Array.from({ length: PERSISTED_GALLERY_LIMIT + 15 }, (_, index) => createGeneration(index));

    const state = {
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
      galleryItems,
      galleryPage: 3,
      hasMoreGallery: true,
      galleryLastSyncAt: 123,
      _galleryLoaded: true,
    } as unknown as PlaygroundState;

    const persisted = partializePlaygroundState(state);

    expect(persisted.galleryItems).toHaveLength(PERSISTED_GALLERY_LIMIT);

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
});
