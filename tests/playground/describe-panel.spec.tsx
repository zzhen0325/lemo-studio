/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DescribePanel } from '@/app/studio/playground/_components/DescribePanel';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  },
}));

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

vi.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}));

vi.mock('@/hooks/common/use-image-source', () => ({
  useImageSource: (src?: string) => src,
}));

const storeState = {
  setPreviewImage: vi.fn(),
};

vi.mock('@/lib/store/playground-store', () => ({
  usePlaygroundStore: (selector?: (state: typeof storeState) => unknown) => selector ? selector(storeState) : storeState,
}));

describe('DescribePanel clipboard support', () => {
  it('accepts pasted clipboard images when the panel is open', () => {
    const onDropFiles = vi.fn();
    const panelRef = React.createRef<HTMLDivElement>();

    render(
      <DescribePanel
        open
        panelRef={panelRef}
        describeImages={[]}
        isDraggingOverPanel={false}
        setIsDraggingOverPanel={vi.fn()}
        setIsDraggingOver={vi.fn()}
        onUploadClick={vi.fn()}
        onDropFiles={onDropFiles}
        onClose={vi.fn()}
        isDescribing={false}
        isGenerating={false}
        onDescribe={vi.fn()}
      />,
    );

    const panel = screen.getByRole('region', { name: 'Describe 图片面板' });
    expect(document.activeElement).toBe(panel);
    expect(screen.getByText('支持直接粘贴截图或剪贴板图片')).toBeTruthy();

    const file = new File(['image-bytes'], 'clipboard-image.png', { type: 'image/png' });
    fireEvent.paste(panel, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
      },
    });

    expect(onDropFiles).toHaveBeenCalledWith([file]);
  });
});
