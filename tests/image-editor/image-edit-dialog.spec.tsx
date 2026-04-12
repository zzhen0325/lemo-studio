import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ImageEditDialog from '@/components/image-editor/ImageEditDialog';

vi.mock('@/hooks/common/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div role="dialog" className={className}>
      {children}
    </div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <button type="button" className={className}>
      {children}
    </button>
  ),
  SelectValue: () => <span>Select</span>,
}));

vi.mock('@/components/ui/slider', () => ({
  Slider: ({
    value,
    onValueChange,
    ...props
  }: {
    value?: number[];
    onValueChange?: (value: number[]) => void;
  }) => (
    <input
      {...props}
      data-testid="brush-width-slider"
      type="range"
      value={value?.[0] || 1}
      onChange={(event) => onValueChange?.([Number(event.target.value)])}
    />
  ),
}));

vi.mock('@/components/image-editor/ImageEditPromptEditor', () => ({
  default: ({
    prompt,
    onPromptChange,
  }: {
    prompt: string;
    onPromptChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Prompt Editor Input"
      value={prompt}
      onChange={(event) => onPromptChange(event.target.value)}
    />
  ),
}));

vi.mock('@/lib/store/api-config-store', () => ({
  useAPIConfigStore: (selector: (state: {
    providers: [];
    getModelEntryById: () => {
      capabilities: {
        supportsImageSize: boolean;
        supportsBatch: boolean;
        allowedImageSizes: ['1K', '2K', '4K'];
        maxBatchSize: number;
      };
    };
  }) => unknown) => selector({
    providers: [],
    getModelEntryById: () => ({
      capabilities: {
        supportsImageSize: true,
        supportsBatch: true,
        allowedImageSizes: ['1K', '2K', '4K'],
        maxBatchSize: 4,
      },
    }),
  }),
}));

vi.mock('@/lib/model-center-ui', () => ({
  getContextModelOptions: () => [],
}));

vi.mock('@/lib/model-center', () => ({
  normalizeImageSizeToken: (value: string) => value,
}));

const mockHookState = {
  annotations: [] as Array<{ id: string }>,
};

vi.mock('@/components/image-editor/hooks/use-fabric-image-editor', async () => {
  const ReactModule = await import('react');

  return {
    useFabricImageEditor: () => {
      const [tool, setTool] = ReactModule.useState<'select' | 'annotate' | 'brush' | 'eraser' | 'crop'>('annotate');
      const [brushColor, setBrushColor] = ReactModule.useState('#123456');
      const [brushWidth, setBrushWidth] = ReactModule.useState(4);

      return {
        setCanvasRef: vi.fn(),
        isReady: true,
        loadError: undefined,
        imageSize: { width: 1024, height: 768 },
        tool,
        setTool,
        brushColor,
        setBrushColor,
        brushWidth,
        setBrushWidth,
        annotations: mockHookState.annotations,
        crop: undefined,
        removeAnnotation: vi.fn(),
        clearCrop: vi.fn(),
        buildSessionSnapshot: vi.fn(() => ({
          version: 1,
          imageWidth: 1024,
          imageHeight: 768,
          plainPrompt: '',
          annotations: [],
          strokes: [],
        })),
        exportMergedImageDataUrl: vi.fn(() => 'data:image/png;base64,merged'),
      };
    },
  };
});

class MockFileReader {
  result: string | ArrayBuffer | null = null;

  onerror: (() => void) | null = null;

  onload: (() => void) | null = null;

  readAsDataURL(file: File) {
    this.result = `data:${file.type};base64,mocked`;
    this.onload?.();
  }
}

function createBaseProps() {
  return {
    open: true,
    imageUrl: '',
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
  };
}

describe('ImageEditDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('FileReader', MockFileReader);
    vi.stubGlobal('confirm', vi.fn(() => true));
    mockHookState.annotations = [];
  });

  it('replaces image from pasted clipboard image files', async () => {
    render(<ImageEditDialog {...createBaseProps()} />);

    fireEvent.paste(screen.getByTestId('image-edit-canvas-pane'), {
      clipboardData: {
        items: [{
          kind: 'file',
          type: 'image/png',
          getAsFile: () => new File(['image'], 'clipboard.png', { type: 'image/png' }),
        }],
      },
    });

    await waitFor(() => {
      expect(screen.queryByText('点击、拖拽或粘贴上传图片')).toBeNull();
    });
  });

  it('does not hijack plain text paste inside the prompt editor', () => {
    render(<ImageEditDialog {...createBaseProps()} />);

    fireEvent.paste(screen.getByLabelText('Prompt Editor Input'), {
      clipboardData: {
        items: [{
          kind: 'string',
          type: 'text/plain',
          getAsFile: () => null,
        }],
      },
    });

    expect(globalThis.confirm).not.toHaveBeenCalled();
    expect(screen.getByText('点击、拖拽或粘贴上传图片')).toBeTruthy();
  });

  it('shows brush controls and wires color and width changes', async () => {
    render(<ImageEditDialog {...createBaseProps()} imageUrl="https://example.com/existing.png" />);

    fireEvent.click(screen.getByRole('button', { name: '画笔' }));

    const colorInput = await screen.findByLabelText('画笔颜色');
    fireEvent.change(colorInput, { target: { value: '#ff0000' } });
    fireEvent.change(screen.getByTestId('brush-width-slider'), { target: { value: '12' } });

    expect(screen.getByDisplayValue('#ff0000')).toBeTruthy();
    expect(screen.getByDisplayValue('12')).toBeTruthy();
  });

  it('keeps zoom layout constrained to the left pane container', () => {
    render(<ImageEditDialog {...createBaseProps()} imageUrl="https://example.com/existing.png" />);

    expect(screen.getByTestId('image-edit-canvas-pane').className).toContain('min-w-0');
    expect(screen.getByTestId('image-edit-canvas-pane').className).toContain('overflow-auto');
    expect(screen.getByTestId('image-edit-sidebar').className).toContain('shrink-0');
  });

  it('confirms before replacing an existing image via paste', async () => {
    render(<ImageEditDialog {...createBaseProps()} imageUrl="https://example.com/existing.png" />);

    fireEvent.paste(screen.getByLabelText('Prompt Editor Input'), {
      clipboardData: {
        items: [{
          kind: 'file',
          type: 'image/png',
          getAsFile: () => new File(['image'], 'clipboard.png', { type: 'image/png' }),
        }],
      },
    });

    await waitFor(() => {
      expect(globalThis.confirm).toHaveBeenCalled();
    });
  });
});
