import { describe, expect, it } from 'vitest';

import type { GenerationConfig } from '@/types/database';
import type { PlaygroundState } from '@/lib/store/playground-store.types';
import {
  mergePersistedPlaygroundState,
  partializePlaygroundState,
} from '@/lib/store/playground-store.persist';

function createConfig(): GenerationConfig {
  return {
    prompt: 'Prompt 0',
    width: 1024,
    height: 1024,
    model: 'coze_seedream4_5',
    sourceImageUrls: [
      '/upload/source-0.png',
      'data:image/png;base64,abc',
      ''.padEnd(1201, 'x'),
    ],
  };
}

function createState(overrides: Partial<PlaygroundState> = {}): PlaygroundState {
  return {
    config: createConfig(),
    selectedModel: 'coze_seedream4_5',
    selectedWorkflowConfig: undefined,
    selectedLoras: [],
    isAspectRatioLocked: false,
    viewMode: 'dock',
    visitorId: 'visitor-1',
    generationHistory: [{ id: 'history-1' } as never],
    presets: [{ id: 'preset-1' } as never],
    styles: [{ id: 'style-1' } as never],
    uploadedImages: [{ id: 'upload-1' } as never],
    describeImages: [{ id: 'describe-1' } as never],
    ...overrides,
  } as unknown as PlaygroundState;
}

describe('partializePlaygroundState', () => {
  it('keeps persisted config compact and drops volatile collections', () => {
    const persisted = partializePlaygroundState(createState());

    expect(persisted.config.sourceImageUrls).toEqual(['/upload/source-0.png', '', '']);
    expect(persisted.generationHistory).toEqual([]);
    expect(persisted.uploadedImages).toEqual([]);
    expect(persisted.describeImages).toEqual([]);
    expect(persisted.presets).toEqual([]);
    expect(persisted.styles).toEqual([]);
  });
});

describe('mergePersistedPlaygroundState', () => {
  it('shallow-merges persisted values without reintroducing gallery cache state', () => {
    const merged = mergePersistedPlaygroundState(
      {
        viewMode: 'home',
        visitorId: 'visitor-2',
      },
      createState({ viewMode: 'dock', visitorId: 'visitor-1' }),
    );

    expect(merged.viewMode).toBe('home');
    expect(merged.visitorId).toBe('visitor-2');
  });
});
