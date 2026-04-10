import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@studio/playground/_components/GalleryView', () => ({
  default: () => <div data-testid="mock-dock-gallery-view" />,
}));

vi.mock('@studio/playground/_components/MoodboardView', () => ({
  MoodboardView: () => <div data-testid="mock-moodboard-view" />,
}));

vi.mock('@studio/playground/_components/Banner/BannerModePanel', () => ({
  BannerModePanel: () => <div data-testid="mock-banner-mode-panel" />,
}));

import { PlaygroundDockPanels } from '@/app/studio/playground/_components/containers/components/PlaygroundDockPanels';

describe('PlaygroundDockPanels gallery shell', () => {
  it('keeps the dock gallery inside a bounded flex shell and uses the gallery skeleton fallback', () => {
    render(
      <PlaygroundDockPanels
        viewMode="dock"
        activeTab="gallery"
        onImageClick={vi.fn()}
        onUsePrompt={vi.fn()}
        onUseImage={vi.fn(async () => undefined)}
        onShortcutQuickApply={vi.fn()}
        onMoodboardApply={vi.fn()}
        isGenerating={false}
        onGenerateBanner={vi.fn()}
        bannerSessionHistory={[]}
        isDraggingOver={false}
      />,
    );

    const shell = screen.getByTestId('playground-dock-gallery-shell');
    const content = screen.getByTestId('playground-dock-gallery-content');

    expect(shell.className).toContain('flex-1');
    expect(shell.className).toContain('min-h-0');
    expect(shell.className).toContain('min-w-0');
    expect(shell.className).not.toContain('animate-in');
    expect(shell.className).not.toContain('fade-in');
    expect(shell.className).not.toContain('slide-in-from-bottom-4');
    expect(content.className).toContain('flex-1');
    expect(content.className).toContain('min-h-0');
    expect(content.className).toContain('min-w-0');
    expect(screen.getByTestId('gallery-view-loading-shell')).toBeTruthy();
  });

  it('keeps the gallery mounted after the first open and hides it when inactive', () => {
    const { rerender } = render(
      <PlaygroundDockPanels
        viewMode="dock"
        activeTab="gallery"
        onImageClick={vi.fn()}
        onUsePrompt={vi.fn()}
        onUseImage={vi.fn(async () => undefined)}
        onShortcutQuickApply={vi.fn()}
        onMoodboardApply={vi.fn()}
        isGenerating={false}
        onGenerateBanner={vi.fn()}
        bannerSessionHistory={[]}
        isDraggingOver={false}
      />,
    );

    expect(screen.getByTestId('playground-dock-gallery-shell').getAttribute('data-gallery-visible')).toBe('true');

    rerender(
      <PlaygroundDockPanels
        viewMode="dock"
        activeTab="history"
        onImageClick={vi.fn()}
        onUsePrompt={vi.fn()}
        onUseImage={vi.fn(async () => undefined)}
        onShortcutQuickApply={vi.fn()}
        onMoodboardApply={vi.fn()}
        isGenerating={false}
        onGenerateBanner={vi.fn()}
        bannerSessionHistory={[]}
        isDraggingOver={false}
      />,
    );

    const shell = screen.getByTestId('playground-dock-gallery-shell');
    expect(shell.getAttribute('data-gallery-visible')).toBe('false');
    expect(shell.getAttribute('aria-hidden')).toBe('true');
  });
});
