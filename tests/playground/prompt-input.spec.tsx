import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PromptInput from '@/app/studio/playground/_components/PromptInput';
import {
  createShortcutPromptValues,
  getShortcutById,
} from '@/config/playground-shortcuts';
import { createShortcutEditorDocumentFromParts } from '@/app/studio/playground/_lib/shortcut-editor-document';

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
});
