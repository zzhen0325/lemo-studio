import {
  normalizeShortcutColorValue,
  type PlaygroundShortcut,
  type ShortcutPromptPart,
  type ShortcutPromptValues,
} from '@/config/moodboard-cards';

export interface ShortcutEditorTextNode {
  type: 'text';
  text: string;
}

export interface ShortcutEditorTokenNode {
  type: 'token';
  fieldId: string;
}

export interface ShortcutEditorParagraphBlock {
  type: 'paragraph';
  children: Array<ShortcutEditorTextNode | ShortcutEditorTokenNode>;
}

export interface ShortcutEditorImageBlock {
  type: 'image';
  id: string;
  label: string;
}

export type ShortcutEditorBlock = ShortcutEditorParagraphBlock | ShortcutEditorImageBlock;
export type ShortcutEditorDocument = ShortcutEditorBlock[];

function normalizeTextNode(text: string): ShortcutEditorTextNode | null {
  return text.length > 0 ? { type: 'text', text } : null;
}

function normalizeParagraphChildren(
  children: Array<ShortcutEditorTextNode | ShortcutEditorTokenNode>,
): Array<ShortcutEditorTextNode | ShortcutEditorTokenNode> {
  const normalized: Array<ShortcutEditorTextNode | ShortcutEditorTokenNode> = [];

  children.forEach((child) => {
    if (child.type === 'text') {
      const textValue = child.text || '';
      if (!textValue) {
        return;
      }

      const previous = normalized[normalized.length - 1];
      if (previous?.type === 'text') {
        previous.text += textValue;
        return;
      }

      normalized.push({ type: 'text', text: textValue });
      return;
    }

    normalized.push({ type: 'token', fieldId: child.fieldId });
  });

  return normalized.length > 0 ? normalized : [{ type: 'text', text: '' }];
}

export function normalizeShortcutEditorDocument(
  document: ShortcutEditorDocument,
): ShortcutEditorDocument {
  const normalized = document.reduce<ShortcutEditorDocument>((acc, block) => {
    if (block.type === 'image') {
      acc.push({
        type: 'image',
        id: block.id,
        label: block.label || '图片占位',
      });
      return acc;
    }

    acc.push({
      type: 'paragraph',
      children: normalizeParagraphChildren(block.children || []),
    });
    return acc;
  }, []);

  return normalized.length > 0
    ? normalized
    : [{ type: 'paragraph', children: [{ type: 'text', text: '' }] }];
}

export function cloneShortcutEditorDocument(
  document: ShortcutEditorDocument,
): ShortcutEditorDocument {
  return document.map((block) => (
    block.type === 'image'
      ? { ...block }
      : {
        type: 'paragraph',
        children: block.children.map((child) => ({ ...child })),
      }
  ));
}

export function createShortcutEditorDocumentFromParts(
  parts: ShortcutPromptPart[],
): ShortcutEditorDocument {
  const blocks: ShortcutEditorDocument = [];
  let currentParagraph: ShortcutEditorParagraphBlock = {
    type: 'paragraph',
    children: [],
  };

  const pushParagraph = () => {
    blocks.push({
      type: 'paragraph',
      children: normalizeParagraphChildren(currentParagraph.children),
    });
    currentParagraph = {
      type: 'paragraph',
      children: [],
    };
  };

  parts.forEach((part) => {
    if (part.type === 'field') {
      currentParagraph.children.push({
        type: 'token',
        fieldId: part.fieldId,
      });
      return;
    }

    const textSegments = part.value.split('\n');
    textSegments.forEach((segment, index) => {
      const textNode = normalizeTextNode(segment);
      if (textNode) {
        currentParagraph.children.push(textNode);
      }

      if (index < textSegments.length - 1) {
        pushParagraph();
      }
    });
  });

  pushParagraph();

  return normalizeShortcutEditorDocument(blocks);
}

export function createShortcutEditorDocumentFromText(
  text: string,
): ShortcutEditorDocument {
  const normalizedText = (text || '').replace(/\r\n?/g, '\n');

  return normalizeShortcutEditorDocument(
    normalizedText.split('\n').map((line) => ({
      type: 'paragraph' as const,
      children: [{ type: 'text' as const, text: line }],
    })),
  );
}

export function createShortcutEditorDocumentFromTemplate(
  template: string,
): ShortcutEditorDocument {
  const normalizedTemplate = (template || '').replace(/\r\n?/g, '\n');

  const blocks = normalizedTemplate.split('\n').map((line) => {
    const children: Array<ShortcutEditorTextNode | ShortcutEditorTokenNode> = [];
    let lastIndex = 0;
    const tokenPattern = /{{\s*([a-zA-Z0-9_-]+)\s*}}/g;

    for (const match of line.matchAll(tokenPattern)) {
      const index = match.index ?? 0;
      const token = match[1]?.trim();

      if (index > lastIndex) {
        children.push({
          type: 'text',
          text: line.slice(lastIndex, index),
        });
      }

      if (token) {
        children.push({
          type: 'token',
          fieldId: token,
        });
      }

      lastIndex = index + match[0].length;
    }

    if (lastIndex < line.length) {
      children.push({
        type: 'text',
        text: line.slice(lastIndex),
      });
    }

    if (children.length === 0) {
      children.push({
        type: 'text',
        text: '',
      });
    }

    return {
      type: 'paragraph' as const,
      children,
    };
  });

  return normalizeShortcutEditorDocument(blocks);
}

export function serializeShortcutEditorDocumentToTemplate(
  document: ShortcutEditorDocument,
): string {
  return normalizeShortcutEditorDocument(document)
    .map((block) => {
      if (block.type === 'image') {
        return '';
      }

      return block.children.map((child) => (
        child.type === 'text' ? child.text : `{{${child.fieldId}}}`
      )).join('');
    })
    .join('\n');
}

export function getShortcutEditorDocumentFieldIds(
  document: ShortcutEditorDocument,
): string[] {
  const seen = new Set<string>();
  const fieldIds: string[] = [];

  normalizeShortcutEditorDocument(document).forEach((block) => {
    if (block.type === 'image') {
      return;
    }

    block.children.forEach((child) => {
      if (child.type !== 'token' || seen.has(child.fieldId)) {
        return;
      }

      seen.add(child.fieldId);
      fieldIds.push(child.fieldId);
    });
  });

  return fieldIds;
}

function resolvePromptFieldValue(
  shortcut: PlaygroundShortcut,
  fieldId: string,
  values: ShortcutPromptValues,
  usePlaceholder: boolean,
) {
  const field = shortcut.fields.find((item) => item.id === fieldId);
  if (!field) {
    return '';
  }

  const rawValue = values[fieldId] || '';
  const normalizedValue = field.type === 'color'
    ? normalizeShortcutColorValue(rawValue)
    : rawValue.trim();

  if (normalizedValue) {
    return normalizedValue;
  }

  return usePlaceholder ? `【${field.placeholder || field.id}】` : '';
}

export function buildPromptFromShortcutEditorDocument(
  document: ShortcutEditorDocument,
  shortcut: PlaygroundShortcut,
  values: ShortcutPromptValues,
  options?: {
    removedFieldIds?: string[];
    usePlaceholder?: boolean;
  },
) {
  const removedFieldIds = new Set(options?.removedFieldIds || []);
  const usePlaceholder = options?.usePlaceholder ?? true;

  return normalizeShortcutEditorDocument(document)
    .map((block) => {
      if (block.type === 'image') {
        return '';
      }

      return block.children.map((child) => {
        if (child.type === 'text') {
          return child.text;
        }

        if (removedFieldIds.has(child.fieldId)) {
          return '';
        }

        return resolvePromptFieldValue(shortcut, child.fieldId, values, usePlaceholder);
      }).join('');
    })
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function removeFieldFromShortcutEditorDocument(
  document: ShortcutEditorDocument,
  fieldId: string,
): ShortcutEditorDocument {
  return normalizeShortcutEditorDocument(document.map((block) => {
    if (block.type === 'image') {
      return block;
    }

    return {
      type: 'paragraph',
      children: block.children.filter((child) => (
        child.type !== 'token' || child.fieldId !== fieldId
      )),
    };
  }));
}

export function shortcutEditorDocumentContainsField(
  document: ShortcutEditorDocument,
  fieldId: string,
) {
  return document.some((block) => (
    block.type === 'paragraph'
    && block.children.some((child) => child.type === 'token' && child.fieldId === fieldId)
  ));
}

export function getRemovedFieldIdsFromShortcutEditorDocument(
  shortcut: PlaygroundShortcut,
  document: ShortcutEditorDocument,
) {
  return shortcut.fields
    .filter((field) => !shortcutEditorDocumentContainsField(document, field.id))
    .map((field) => field.id);
}
