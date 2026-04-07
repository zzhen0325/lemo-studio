/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GalleryImageCard,
  clearGalleryImageLoadCacheForTests,
} from '@/app/studio/playground/_components/gallery/GalleryImageCard';
import type { Generation } from '@/types/database';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & {
    fetchPriority?: string;
    blurDataURL?: string;
    unoptimized?: boolean;
  }) => {
    const nextProps = { ...props };
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
    icon,
    onClick,
  }: {
    icon: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {icon}
    </button>
  ),
}));

vi.mock('@/hooks/common/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const storeState = {
  applyPrompt: vi.fn(),
  applyImage: vi.fn(),
};

vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

function createGeneration(id: string): Generation {
  return {
    id,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `https://example.com/${id}.png`,
    status: 'completed',
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

describe('GalleryImageCard', () => {
  beforeEach(() => {
    clearGalleryImageLoadCacheForTests();
  });

  it('keeps the loaded visual state when the same image is mounted again', () => {
    const item = createGeneration('image-1');
    const props = {
      item,
      imageLoadKey: `${item.id}:${item.outputUrl}`,
      onDownload: vi.fn(),
      onGenerate: vi.fn(async () => undefined),
      moodboards: [],
      moodboardCards: [],
      refreshMoodboardCards: vi.fn(async () => undefined),
    };

    const firstRender = render(<GalleryImageCard {...props} />);
    const firstImage = screen.getByAltText('Generated masterwork');
    expect(firstImage.className).toContain('opacity-0');

    fireEvent.load(firstImage);
    expect(firstImage.className).toContain('opacity-100');

    firstRender.unmount();

    render(<GalleryImageCard {...props} />);
    const secondImage = screen.getByAltText('Generated masterwork');
    expect(secondImage.className).toContain('opacity-100');
  });
});
