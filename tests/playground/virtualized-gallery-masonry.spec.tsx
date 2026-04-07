import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VirtualizedGalleryMasonry } from '@/app/studio/playground/_components/gallery/VirtualizedGalleryMasonry';
import type { Generation } from '@/types/database';

function createGeneration(index: number): Generation {
  return {
    id: `item-${index}`,
    userId: 'user-1',
    projectId: 'default',
    outputUrl: `https://example.com/item-${index}.png`,
    status: 'completed',
    createdAt: `2026-04-07T12:00:${String(59 - (index % 50)).padStart(2, '0')}.000Z`,
    config: {
      prompt: `Prompt ${index}`,
      width: 1024,
      height: 1400,
      model: 'coze_seedream4_5',
    },
  };
}

class MockResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

function Harness({ items }: { items: Generation[] }) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollContainerRef} data-test-height="900">
      <VirtualizedGalleryMasonry
        items={items}
        columnsCount={6}
        containerWidth={1200}
        layoutKey="recent"
        scrollContainerRef={scrollContainerRef}
        renderItem={(item) => <div data-testid="virtualized-card">{item.id}</div>}
      />
    </div>
  );
}

describe('VirtualizedGalleryMasonry', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver as unknown as typeof ResizeObserver);
    vi.stubGlobal('requestAnimationFrame', ((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }) as typeof requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        const value = this.getAttribute('data-test-height');
        return value ? Number(value) : 0;
      },
    });
  });

  afterEach(() => {
    if (originalClientHeight) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
    }
    vi.unstubAllGlobals();
  });

  it('renders only a visible subset of a large gallery payload', () => {
    const items = Array.from({ length: 400 }, (_, index) => createGeneration(index));

    render(<Harness items={items} />);

    const renderedCards = screen.getAllByTestId('virtualized-card');
    expect(renderedCards.length).toBeGreaterThan(0);
    expect(renderedCards.length).toBeLessThan(120);
  });
});
