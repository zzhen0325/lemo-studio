import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolPreview } from '@/app/studio/tools/_components/ToolPreview';
import type { WebGLToolConfig } from '@/app/studio/tools/_components/tool-configs';

const tool: WebGLToolConfig = {
  id: 'preview', name: 'Preview', description: '', type: 'component',
  parameters: [{ id: 'speed', name: 'Speed', type: 'number', defaultValue: 2 }],
  component: ({ speed, isPreview }) => <div data-testid="renderer">{String(isPreview)}:{speed}</div>,
};

afterEach(() => vi.unstubAllGlobals());

describe('tool preview visibility', () => {
  it('starts a renderer only in view and releases it offscreen and on unmount', () => {
    let onVisibility: IntersectionObserverCallback;
    const disconnect = vi.fn();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { onVisibility = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    const { unmount } = render(<ToolPreview tool={tool} />);
    expect(screen.queryByTestId('renderer')).toBeNull();
    const setVisible = (isIntersecting: boolean) => act(() => {
      onVisibility([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    setVisible(true);
    expect(screen.getByTestId('renderer').textContent).toBe('true:2');
    setVisible(false);
    expect(screen.queryByTestId('renderer')).toBeNull();
    setVisible(true);
    expect(screen.getByTestId('renderer')).toBeTruthy();
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('still shows the preview without IntersectionObserver support', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<ToolPreview tool={tool} />);
    expect(screen.getByTestId('renderer')).toBeTruthy();
  });
});
