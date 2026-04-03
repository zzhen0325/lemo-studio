import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PromptInput from '@/app/studio/playground/_components/PromptInput';
import {
  createShortcutPromptValues,
  getShortcutById,
} from '@/config/moodboard-cards';
import { createShortcutEditorDocumentFromParts } from '@/app/studio/playground/_lib/shortcut-editor-document';

function createStructuredShortcutTemplate() {
  const shortcut = getShortcutById('us-kv');
  if (!shortcut) {
    throw new Error('Missing us-kv shortcut');
  }

  const values = createShortcutPromptValues(shortcut);

  return {
    shortcut,
    values,
    removedFieldIds: [] as string[],
    optimizationSession: {
      originPrompt: 'Create a US-EVENT KV ...',
      activeVariantId: 'v1' as const,
      variants: [
        {
          id: 'v1' as const,
          label: '预算海报',
          coreSuggestions: values,
          palette: [
            { hex: '#15BC55', weight: '50%' },
            { hex: '#F8E6CC', weight: '50%' },
          ],
          analysis: {
            canvas: { detailText: '整体以 #15BC55 为主色。' },
            subject: { detailText: '主体突出预算账本。' },
            background: { detailText: '背景使用纸纹。' },
            layout: { detailText: '标题居中。' },
            typography: { detailText: '字体偏粗。' },
          },
          promptPreview: '',
          pendingInstruction: '',
          pendingScope: 'variant' as const,
          isModifying: false,
        },
      ],
    },
  };
}

describe('PromptInput shortcut template mode', () => {
  it('renders the Slate editor for inline shortcut templates', () => {
    const shortcut = getShortcutById('lemo');
    if (!shortcut) {
      throw new Error('Missing lemo shortcut');
    }

    const values = createShortcutPromptValues(shortcut);
    const onPromptChange = vi.fn();

    render(
      <PromptInput
        prompt=""
        onPromptChange={onPromptChange}
        uploadedImages={[]}
        onRemoveImage={() => {}}
        isOptimizing={false}
        onOptimize={() => {}}
        selectedAIModel="auto"
        onAIModelChange={() => {}}
        onAddImages={() => {}}
        shortcutTemplate={{
          shortcut,
          values,
          removedFieldIds: [],
          editorDocument: createShortcutEditorDocumentFromParts(shortcut.promptParts),
          optimizationSession: null,
        }}
      />,
    );

    expect(screen.queryByText('最终 Prompt')).toBeNull();
    expect(screen.getByLabelText('Prompt Template Editor')).toBeTruthy();
    expect(onPromptChange).not.toHaveBeenCalled();
  });

  it('keeps expanded structured prompt composer on outside click and collapses only by button', () => {
    const onFocusChange = vi.fn();
    const structuredShortcutTemplate = createStructuredShortcutTemplate();

    render(
      <div>
        <button type="button" data-testid="outside-button">outside</button>
        <PromptInput
          prompt=""
          onPromptChange={() => {}}
          uploadedImages={[]}
          onRemoveImage={() => {}}
          isOptimizing={false}
          onOptimize={() => {}}
          selectedAIModel="auto"
          onAIModelChange={() => {}}
          onAddImages={() => {}}
          shortcutTemplate={structuredShortcutTemplate}
          onFocusChange={onFocusChange}
        />
      </div>,
    );

    const expandButton = screen.getByRole('button', { name: '展开' });
    fireEvent.mouseDown(expandButton);
    fireEvent.click(expandButton);
    expect(screen.getByRole('button', { name: '收起' })).toBeTruthy();
    const structuredContainer = screen.getByTestId('structured-prompt-container');
    const outsideButton = screen.getByTestId('outside-button');
    expect(structuredContainer.className).not.toContain('max-h-[86px]');

    fireEvent.click(outsideButton);

    expect(onFocusChange).toHaveBeenCalledWith(false);
    expect(structuredContainer.className).toContain('max-h-[86px]');
    expect(screen.getByRole('button', { name: '收起' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '展开' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '收起' }));
    expect(screen.getByRole('button', { name: '展开' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '收起' })).toBeNull();
  });

  it('auto-focuses structured prompt on session ready and toggles 86px clamp by click in/out', () => {
    const onFocusChange = vi.fn();
    const structuredShortcutTemplate = createStructuredShortcutTemplate();

    render(
      <div>
        <button type="button" data-testid="outside-button">outside</button>
        <PromptInput
          prompt=""
          onPromptChange={() => {}}
          uploadedImages={[]}
          onRemoveImage={() => {}}
          isOptimizing={false}
          onOptimize={() => {}}
          selectedAIModel="auto"
          onAIModelChange={() => {}}
          onAddImages={() => {}}
          shortcutTemplate={structuredShortcutTemplate}
          onFocusChange={onFocusChange}
        />
      </div>,
    );

    const canvasEditor = within(screen.getByTestId('collapsed-analysis-canvas')).getByRole('textbox');
    const structuredContainer = screen.getByTestId('structured-prompt-container');
    const outsideButton = screen.getByTestId('outside-button');

    expect(structuredContainer.className).not.toContain('max-h-[86px]');

    fireEvent.click(outsideButton);
    expect(structuredContainer.className).toContain('max-h-[86px]');

    fireEvent.mouseDown(canvasEditor);
    expect(structuredContainer.className).not.toContain('max-h-[86px]');

    expect(onFocusChange).toHaveBeenCalledWith(true);
    expect(onFocusChange).toHaveBeenCalledWith(false);
  });
});
