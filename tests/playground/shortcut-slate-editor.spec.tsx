import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShortcutSlateEditor } from '@/app/studio/playground/_components/ShortcutSlateEditor';
import {
  createShortcutPromptValues,
  getShortcutById,
} from '@/config/moodboard-cards';
import { createShortcutEditorDocumentFromParts } from '@/app/studio/playground/_lib/shortcut-editor-document';

describe('ShortcutSlateEditor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces token field updates while keeping the local input responsive', () => {
    vi.useFakeTimers();

    const shortcut = getShortcutById('lemo');
    if (!shortcut) {
      throw new Error('Missing lemo shortcut');
    }

    const values = createShortcutPromptValues(shortcut);
    const onFieldChange = vi.fn();

    render(
      <ShortcutSlateEditor
        shortcut={shortcut}
        values={values}
        document={createShortcutEditorDocumentFromParts(shortcut.promptParts)}
        onFieldChange={onFieldChange}
        onDocumentChange={() => {}}
      />,
    );

    const actionInput = screen.getByPlaceholderText('在做什么') as HTMLInputElement;
    fireEvent.change(actionInput, { target: { value: 'jumping forward' } });

    expect(actionInput.value).toBe('jumping forward');
    expect(onFieldChange).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(140);
    });

    expect(onFieldChange).toHaveBeenCalledTimes(1);
    expect(onFieldChange).toHaveBeenCalledWith('action', 'jumping forward');
  });
});
