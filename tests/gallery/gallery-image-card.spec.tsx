/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GalleryImageCard,
  clearGalleryImageLoadCacheForTests,
} from '@/components/gallery/GalleryImageCard';
import type { GalleryActionHandlers, GalleryItemViewModel, GalleryMoodboardData } from '@/lib/gallery/types';
import type { Generation } from '@/types/database';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    fetchPriority?: string;
    blurDataURL?: string;
    unoptimized?: boolean;
  }) => {
    const nextProps = { ...props };
    delete nextProps.fill;
    delete nextProps.fetchPriority;
    delete nextProps.blurDataURL;
    delete nextProps.unoptimized;
    return <img alt={props.alt || ''} {...nextProps} />;
  },
}));

vi.mock('@studio/playground/_components/AddToMoodboardMenu', () => ({
  AddToMoodboardMenu: () => <div data-testid="add-to-moodboard-menu" />,
}));

vi.mock('@/components/ui/tooltip-button', () => ({
  TooltipButton: ({
    label,
    icon,
    onClick,
  }: {
    label: string;
    icon: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" aria-label={label} onClick={onClick}>
      {icon}
    </button>
  ),
}));

function createGeneration(id: string, status: Generation['status'] = 'completed'): Generation {
  return {
    id,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `https://example.com/${id}.png`,
    status,
    createdAt: '2026-04-07T12:00:00.000Z',
    config: {
      prompt: `Prompt ${id}`,
      width: 1024,
      height: 1024,
      model: 'coze_seedream4_5',
      sourceImageUrls: [],
    },
  };
}

function createViewModel(raw: Generation): GalleryItemViewModel {
  return {
    id: raw.id,
    raw,
    displayUrl: raw.outputUrl || '',
    downloadUrl: `https://download.example.com/${raw.id}.png`,
    moodboardImagePath: raw.outputUrl || '',
    prompt: raw.config?.prompt || '',
    promptCategory: 'standard_generation',
    promptCategoryLabel: '普通生成',
    model: raw.config?.model || 'Unknown Model',
    presetName: raw.config?.presetName || '',
    createdAt: raw.createdAt,
    width: raw.config?.width || 1024,
    height: raw.config?.height || 1024,
    imageLoadKey: `${raw.id}:${raw.outputUrl}`,
    searchText: (raw.config?.prompt || '').toLowerCase(),
    isPromptVisible: true,
    isImageVisible: true,
  };
}

const moodboardData: GalleryMoodboardData = {
  moodboards: [],
  moodboardCards: [],
  refreshMoodboardCards: vi.fn(async () => undefined),
};

function createActions(): GalleryActionHandlers {
  return {
    onSelectItem: vi.fn(),
    onUsePrompt: vi.fn(),
    onUseImage: vi.fn(async () => undefined),
    onRerun: vi.fn(async () => undefined),
    onDownload: vi.fn(),
    onAddToMoodboard: vi.fn(),
  };
}

describe('GalleryImageCard', () => {
  beforeEach(() => {
    clearGalleryImageLoadCacheForTests();
  });

  it('keeps the loaded visual state when the same image mounts again', () => {
    const raw = createGeneration('image-1');
    const item = createViewModel(raw);
    const actions = createActions();

    const firstRender = render(
      <GalleryImageCard item={item} actions={actions} moodboardData={moodboardData} />,
    );
    const firstImage = screen.getByAltText('Generated masterwork');
    expect(firstImage.className).toContain('opacity-0');

    fireEvent.load(firstImage);
    expect(firstImage.className).toContain('opacity-100');

    firstRender.unmount();

    render(<GalleryImageCard item={item} actions={actions} moodboardData={moodboardData} />);
    const secondImage = screen.getByAltText('Generated masterwork');
    expect(secondImage.className).toContain('opacity-100');
  });

  it('uses the resolved download url instead of the raw output url', () => {
    const raw = createGeneration('image-2');
    const item = createViewModel(raw);
    const actions = createActions();

    render(<GalleryImageCard item={item} actions={actions} moodboardData={moodboardData} />);

    fireEvent.click(screen.getByLabelText('Download'));

    expect(actions.onDownload).toHaveBeenCalledWith(raw, 'https://download.example.com/image-2.png');
  });
});
