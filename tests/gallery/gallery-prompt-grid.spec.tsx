import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GalleryPromptGrid } from '@/components/gallery/GalleryPromptGrid';
import type { GalleryActionHandlers, GalleryItemViewModel } from '@/lib/gallery/types';
import type { Generation } from '@/types/database';

vi.mock('react-virtualized-auto-sizer', () => ({
  default: ({ children }: { children: (size: { height: number; width: number }) => React.ReactNode }) =>
    children({ height: 320, width: 840 }),
}));

function createItem(index: number): GalleryItemViewModel {
  const raw: Generation = {
    id: `prompt-${index}`,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `https://example.com/prompt-${index}.png`,
    status: 'completed',
    createdAt: '2026-04-07T12:00:00.000Z',
    config: {
      prompt: `Prompt ${index}`,
      width: 1024,
      height: 1024,
      model: 'coze_seedream4_5',
    },
  };

  return {
    id: raw.id,
    raw,
    displayUrl: raw.outputUrl || '',
    downloadUrl: raw.outputUrl || '',
    moodboardImagePath: raw.outputUrl || '',
    prompt: `Prompt ${index}`,
    promptCategory: 'standard_generation',
    promptCategoryLabel: '普通生成',
    model: 'coze_seedream4_5',
    presetName: '',
    createdAt: raw.createdAt,
    width: 1024,
    height: 1024,
    imageLoadKey: `${raw.id}:${raw.outputUrl}`,
    searchText: `prompt ${index}`,
    isPromptVisible: true,
    isImageVisible: true,
  };
}

describe('GalleryPromptGrid', () => {
  it('renders a virtualized subset and still applies prompt actions', () => {
    const items = Array.from({ length: 12 }, (_, index) => createItem(index));
    const actions: GalleryActionHandlers = {
      onSelectItem: vi.fn(),
      onUsePrompt: vi.fn(),
      onUseImage: vi.fn(async () => undefined),
      onRerun: vi.fn(async () => undefined),
      onDownload: vi.fn(),
      onAddToMoodboard: vi.fn(),
    };

    render(<GalleryPromptGrid items={items} actions={actions} />);

    expect(screen.getByText('Prompt 0')).toBeTruthy();
    expect(screen.queryByText('Prompt 10')).toBeNull();

    fireEvent.click(screen.getByText('Prompt 0'));

    expect(actions.onUsePrompt).toHaveBeenCalledWith(items[0].raw);
  });
});
