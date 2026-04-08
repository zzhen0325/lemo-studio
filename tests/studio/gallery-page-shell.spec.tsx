import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeState = {
  setActiveTab: vi.fn(),
  setViewMode: vi.fn(),
};

vi.mock('@studio/playground/_components/GalleryView', () => ({
  default: () => <div data-testid="mock-gallery-view" />,
}));

vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

import GalleryPage from '@/app/studio/gallery/page';
import GalleryPageClient from '@/app/studio/gallery/_components/GalleryPageClient';

describe('Gallery route shell', () => {
  beforeEach(() => {
    storeState.setActiveTab.mockClear();
    storeState.setViewMode.mockClear();
  });

  it('keeps the standalone gallery route inside a bounded flex shell', () => {
    render(<GalleryPage />);

    const routeShell = screen.getByTestId('gallery-route-shell');
    expect(routeShell.className).toContain('flex-1');
    expect(routeShell.className).toContain('min-h-0');
  });

  it('provides a bounded client shell before rendering GalleryView', () => {
    render(<GalleryPageClient />);

    const clientShell = screen.getByTestId('gallery-page-client-shell');
    expect(clientShell.className).toContain('flex-1');
    expect(clientShell.className).toContain('min-h-0');
    expect(screen.getByTestId('mock-gallery-view')).toBeTruthy();
    expect(storeState.setViewMode).toHaveBeenCalledWith('dock');
    expect(storeState.setActiveTab).toHaveBeenCalledWith('gallery');
  });
});
