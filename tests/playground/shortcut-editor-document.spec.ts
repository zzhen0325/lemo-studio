import { describe, expect, it } from 'vitest';

import { getShortcutById } from '@/config/playground-shortcuts';
import {
  buildPromptFromShortcutEditorDocument,
  createShortcutEditorDocumentFromParts,
  createShortcutEditorDocumentFromText,
  getRemovedFieldIdsFromShortcutEditorDocument,
  removeFieldFromShortcutEditorDocument,
} from '@/app/studio/playground/_lib/shortcut-editor-document';

describe('shortcut editor document helpers', () => {
  it('builds prompt text from editor document tokens and ignores image blocks', () => {
    const shortcut = getShortcutById('lemo');
    if (!shortcut) {
      throw new Error('Missing lemo shortcut');
    }

    const document = createShortcutEditorDocumentFromParts(shortcut.promptParts);
    document.push({
      type: 'image',
      id: 'img-slot-1',
      label: '图片占位',
    });

    const prompt = buildPromptFromShortcutEditorDocument(
      document,
      shortcut,
      {
        action: 'standing beside a plush mascot',
        outfit: 'soft yellow hoodie',
        scene: 'toy store display window',
        mood: 'playful and cozy',
        background: 'pastel sky',
        extra: 'brand-ready illustration finish',
      },
      { usePlaceholder: false },
    );

    expect(prompt).toContain('standing beside a plush mascot');
    expect(prompt).not.toContain('图片占位');
  });

  it('derives removed field ids from the current editor document', () => {
    const shortcut = getShortcutById('lemo');
    if (!shortcut) {
      throw new Error('Missing lemo shortcut');
    }

    const document = createShortcutEditorDocumentFromParts(shortcut.promptParts);
    const nextDocument = removeFieldFromShortcutEditorDocument(document, 'background');

    expect(getRemovedFieldIdsFromShortcutEditorDocument(shortcut, nextDocument)).toContain('background');
    expect(buildPromptFromShortcutEditorDocument(
      nextDocument,
      shortcut,
      {
        action: 'jumping',
        outfit: 'striped scarf',
        scene: 'park picnic',
        mood: 'sunny',
        background: 'mint backdrop',
        extra: 'clean finishing',
      },
      { removedFieldIds: ['background'], usePlaceholder: false },
    )).not.toContain('mint backdrop');
  });

  it('creates a text-only editor document from optimized prompt text', () => {
    const document = createShortcutEditorDocumentFromText('first line\n\nthird line');

    expect(document).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'first line' }],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: '' }],
      },
      {
        type: 'paragraph',
        children: [{ type: 'text', text: 'third line' }],
      },
    ]);
  });
});
