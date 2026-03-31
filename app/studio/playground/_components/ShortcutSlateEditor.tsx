'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, X } from 'lucide-react';
import {
  BaseEditor,
  createEditor,
  Descendant,
  Editor,
  Element as SlateElement,
  Range,
  Text,
  Transforms,
} from 'slate';
import { HistoryEditor, withHistory } from 'slate-history';
import {
  Editable,
  ReactEditor,
  RenderElementProps,
  Slate,
  useFocused,
  useSelected,
  useSlateStatic,
  withReact,
} from 'slate-react';

import { cn } from '@/lib/utils';
import {
  normalizeShortcutColorValue,
  sanitizeShortcutColorDraft,
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from '@/config/playground-shortcuts';
import {
  cloneShortcutEditorDocument,
  normalizeShortcutEditorDocument,
  type ShortcutEditorDocument,
  type ShortcutEditorImageBlock,
  type ShortcutEditorParagraphBlock,
  type ShortcutEditorTextNode,
  type ShortcutEditorTokenNode,
} from '@/app/studio/playground/_lib/shortcut-editor-document';

type ShortcutSlateText = {
  text: string;
};

type ShortcutSlateTokenElement = {
  type: 'token';
  fieldId: string;
  children: ShortcutSlateText[];
};

type ShortcutSlateParagraphElement = {
  type: 'paragraph';
  children: Array<ShortcutSlateText | ShortcutSlateTokenElement>;
};

type ShortcutSlateImageElement = {
  type: 'image';
  id: string;
  label: string;
  children: ShortcutSlateText[];
};

type ShortcutSlateElement =
  | ShortcutSlateParagraphElement
  | ShortcutSlateTokenElement
  | ShortcutSlateImageElement;

declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: ShortcutSlateElement;
    Text: ShortcutSlateText;
  }
}

interface ShortcutSlateEditorProps {
  shortcut: PlaygroundShortcut;
  values: ShortcutPromptValues;
  document: ShortcutEditorDocument;
  isDisabled?: boolean;
  onFieldChange: (fieldId: string, value: string) => void;
  onDocumentChange: (nextDocument: ShortcutEditorDocument) => void;
  onFocusChange?: (focused: boolean) => void;
  insertTokenRequest?: ShortcutSlateInsertTokenRequest | null;
  onInsertTokenRequestHandled?: (requestId: string) => void;
}

export interface ShortcutSlateInsertTokenRequest {
  requestId: string;
  fieldId: string;
}

function withShortcutElements(editor: Editor) {
  const { isInline, isVoid } = editor;

  editor.isInline = (element) => {
    if (SlateElement.isElement(element) && element.type === 'token') {
      return true;
    }
    return isInline(element);
  };

  editor.isVoid = (element) => {
    if (SlateElement.isElement(element) && (element.type === 'token' || element.type === 'image')) {
      return true;
    }
    return isVoid(element);
  };

  return editor;
}

function buildSlateValue(document: ShortcutEditorDocument): Descendant[] {
  return normalizeShortcutEditorDocument(document).map((block) => {
    if (block.type === 'image') {
      return {
        type: 'image',
        id: block.id,
        label: block.label,
        children: [{ text: '' }],
      } satisfies ShortcutSlateImageElement;
    }

    const children: Array<ShortcutSlateText | ShortcutSlateTokenElement> = block.children.length > 0
      ? block.children.map((child) => {
        if (child.type === 'text') {
          return { text: child.text };
        }

        return {
          type: 'token' as const,
          fieldId: child.fieldId,
          children: [{ text: '' }],
        };
      })
      : [{ text: '' }];

    return {
      type: 'paragraph',
      children,
    } satisfies ShortcutSlateParagraphElement;
  });
}

function buildEditorDocument(value: Descendant[]): ShortcutEditorDocument {
  const blocks = value.reduce<ShortcutEditorDocument>((acc, node) => {
    if (!SlateElement.isElement(node)) {
      return acc;
    }

    if (node.type === 'image') {
      acc.push({
        type: 'image',
        id: node.id,
        label: node.label,
      } satisfies ShortcutEditorImageBlock);
      return acc;
    }

    if (node.type !== 'paragraph') {
      return acc;
    }

    const children = node.children.reduce<Array<ShortcutEditorTextNode | ShortcutEditorTokenNode>>((paragraphChildren, child) => {
      if (SlateElement.isElement(child) && child.type === 'token') {
        paragraphChildren.push({
          type: 'token',
          fieldId: child.fieldId,
        });
        return paragraphChildren;
      }

      if (Text.isText(child)) {
        paragraphChildren.push({
          type: 'text',
          text: child.text,
        });
      }

      return paragraphChildren;
    }, []);

    acc.push({
      type: 'paragraph',
      children,
    } satisfies ShortcutEditorParagraphBlock);
    return acc;
  }, []);

  return normalizeShortcutEditorDocument(blocks);
}

function createImagePlaceholderElement(): ShortcutSlateImageElement {
  return {
    type: 'image',
    id: `shortcut-image-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: '图片占位',
    children: [{ text: '' }],
  };
}

function TokenElement({
  attributes,
  children,
  element,
  shortcut,
  values,
  onFieldChange,
}: RenderElementProps & {
  element: ShortcutSlateTokenElement;
  shortcut: PlaygroundShortcut;
  values: ShortcutPromptValues;
  onFieldChange: (fieldId: string, value: string) => void;
}) {
  const editor = useSlateStatic();
  const field = shortcut.fields.find((item) => item.id === element.fieldId);

  if (!field) {
    return <span {...attributes}>{children}</span>;
  }

  const removeToken = () => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.removeNodes(editor, { at: path });
  };

  return (
    <span
      {...attributes}
      contentEditable={false}
      className="mx-[2px] inline-flex align-baseline"
    >
      <span
        className={cn(
          'inline-flex min-w-0 items-center gap-2 rounded-md border border-[#E8FFB7]/0 bg-white/10 px-2 text-white transition-colors focus-within:border-[#E8FFB7]/20 focus-within:bg-[#E8FFB7]/18',
          field.widthClassName ? `h-7 ${field.widthClassName}` : 'h-7 min-w-[7rem]'
        )}
      >
        <span className="shrink-0 whitespace-nowrap text-[10px] font-normal text-[#F4FFCE]">
          {field.label}
        </span>
        {field.type === 'color' ? (
          <ColorFieldControl fieldId={field.id} value={values[field.id] || ''} placeholder={field.placeholder} onFieldChange={onFieldChange} />
        ) : (
          <input
            value={values[field.id] || ''}
            onChange={(event) => onFieldChange(field.id, event.target.value)}
            placeholder={field.placeholder}
            className="min-w-[5rem] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
          />
        )}
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={removeToken}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#F4FFCE]/65 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={`删除 ${field.label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
      {children}
    </span>
  );
}

function ColorFieldControl({
  fieldId,
  value,
  placeholder,
  onFieldChange,
}: {
  fieldId: string;
  value: string;
  placeholder: string;
  onFieldChange: (fieldId: string, value: string) => void;
}) {
  const colorPickerRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => colorPickerRef.current?.click()}
        className="h-4 w-4 shrink-0 rounded-sm border border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
        style={{ backgroundColor: normalizeShortcutColorValue(value) || '#FF6B00' }}
        aria-label="选择颜色"
      />
      <input
        value={value}
        onChange={(event) => onFieldChange(fieldId, sanitizeShortcutColorDraft(event.target.value))}
        placeholder={placeholder}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="min-w-[5rem] flex-1 bg-transparent text-sm uppercase text-white outline-none placeholder:text-white/35"
      />
      <input
        ref={colorPickerRef}
        type="color"
        tabIndex={-1}
        value={normalizeShortcutColorValue(value) || '#FF6B00'}
        onChange={(event) => onFieldChange(fieldId, event.target.value.toUpperCase())}
        className="sr-only"
      />
    </div>
  );
}

function ImageBlockElement({
  attributes,
  children,
  element,
}: RenderElementProps & {
  element: ShortcutSlateImageElement;
}) {
  const editor = useSlateStatic();
  const selected = useSelected();
  const focused = useFocused();

  return (
    <div {...attributes}>
      <div contentEditable={false} className="my-3">
        <div
          className={cn(
            'flex items-center justify-between rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white/70 transition-colors',
            selected && focused && 'border-[#E8FFB7]/35 bg-[#E8FFB7]/[0.05]'
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/55">
              <ImagePlus className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/35">
                Image Slot
              </span>
              <span>{element.label}</span>
            </div>
          </div>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const path = ReactEditor.findPath(editor, element);
              Transforms.removeNodes(editor, { at: path });
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="删除图片占位"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function ElementRenderer(
  props: RenderElementProps & {
    shortcut: PlaygroundShortcut;
    values: ShortcutPromptValues;
    onFieldChange: (fieldId: string, value: string) => void;
  },
) {
  const { element } = props;

  switch (element.type) {
    case 'token':
      return <TokenElement {...props} element={element} />;
    case 'image':
      return <ImageBlockElement {...props} element={element} />;
    default:
      return (
        <p {...props.attributes} className="min-h-[1.75rem] whitespace-pre-wrap break-words text-sm pr-8 leading-8 text-white/80">
          {props.children}
        </p>
      );
  }
}

function HoveringToolbar({
  editor,
  visible,
}: {
  editor: Editor;
  visible: boolean;
}) {
  const toolbarRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = toolbarRef.current;
    const { selection } = editor;

    if (!el) {
      return;
    }

    if (!visible || !selection || Range.isCollapsed(selection)) {
      el.style.opacity = '0';
      el.style.transform = 'translate(-9999px, -9999px)';
      return;
    }

    try {
      const domRange = ReactEditor.toDOMRange(editor as ReactEditor, selection);
      const rect = domRange.getBoundingClientRect();

      el.style.opacity = '1';
      el.style.transform = 'translate(-50%, 0)';
      el.style.top = `${rect.top + window.scrollY - el.offsetHeight - 10}px`;
      el.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    } catch {
      el.style.opacity = '0';
      el.style.transform = 'translate(-9999px, -9999px)';
    }
  }, [editor, editor.selection, visible]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={toolbarRef}
      className="pointer-events-auto fixed z-[80] inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#0d0f13]/95 px-2 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-opacity"
      style={{ top: '-9999px', left: '-9999px', opacity: 0 }}
    >
      <button
        type="button"
        onMouseDown={(event) => {
          event.preventDefault();
          Transforms.insertNodes(editor, createImagePlaceholderElement());
        }}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-white/78 transition-colors hover:bg-white/10 hover:text-white"
      >
        <ImagePlus className="h-3.5 w-3.5" />
        图片占位
      </button>
    </div>,
    document.body,
  );
}

const SHORTCUT_EDITOR_SYNC_DELAY = 120;

function ShortcutSlateEditorComponent({
  shortcut,
  values,
  document,
  isDisabled = false,
  onFieldChange,
  onDocumentChange,
  onFocusChange,
  insertTokenRequest,
  onInsertTokenRequestHandled,
}: ShortcutSlateEditorProps) {
  const documentSignature = React.useMemo(() => JSON.stringify(document), [document]);
  const valuesSignature = React.useMemo(() => JSON.stringify(values), [values]);
  const lastPropDocumentSignatureRef = React.useRef(documentSignature);
  const lastCommittedDocumentSignatureRef = React.useRef(documentSignature);
  const lastPropValuesSignatureRef = React.useRef(valuesSignature);
  const pendingDocumentRef = React.useRef<ShortcutEditorDocument | null>(null);
  const pendingFieldValuesRef = React.useRef<Record<string, string>>({});
  const documentSyncTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldSyncTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editorResetVersion, setEditorResetVersion] = React.useState(0);
  const [isEditorFocused, setIsEditorFocused] = React.useState(false);
  const [localValues, setLocalValues] = React.useState<ShortcutPromptValues>(values);
  const lastHandledInsertRequestRef = React.useRef<string | null>(null);
  const editor = React.useMemo(
    () => {
      void editorResetVersion;
      return withShortcutElements(withHistory(withReact(createEditor())));
    },
    [editorResetVersion],
  );
  const initialValue = React.useMemo(
    () => {
      void editorResetVersion;
      return buildSlateValue(document);
    },
    [document, editorResetVersion],
  );

  const flushDocumentChange = React.useCallback(() => {
    if (documentSyncTimeoutRef.current) {
      clearTimeout(documentSyncTimeoutRef.current);
      documentSyncTimeoutRef.current = null;
    }

    const pendingDocument = pendingDocumentRef.current;
    if (!pendingDocument) {
      return;
    }

    pendingDocumentRef.current = null;
    const nextDocument = cloneShortcutEditorDocument(pendingDocument);
    lastCommittedDocumentSignatureRef.current = JSON.stringify(nextDocument);
    React.startTransition(() => {
      onDocumentChange(nextDocument);
    });
  }, [onDocumentChange]);

  const scheduleDocumentChange = React.useCallback(() => {
    if (documentSyncTimeoutRef.current) {
      clearTimeout(documentSyncTimeoutRef.current);
    }

    documentSyncTimeoutRef.current = setTimeout(() => {
      flushDocumentChange();
    }, SHORTCUT_EDITOR_SYNC_DELAY);
  }, [flushDocumentChange]);

  const flushFieldChanges = React.useCallback(() => {
    if (fieldSyncTimeoutRef.current) {
      clearTimeout(fieldSyncTimeoutRef.current);
      fieldSyncTimeoutRef.current = null;
    }

    const pendingEntries = Object.entries(pendingFieldValuesRef.current);
    if (pendingEntries.length === 0) {
      return;
    }

    pendingFieldValuesRef.current = {};
    React.startTransition(() => {
      pendingEntries.forEach(([fieldId, value]) => {
        onFieldChange(fieldId, value);
      });
    });
  }, [onFieldChange]);

  const scheduleFieldChanges = React.useCallback(() => {
    if (fieldSyncTimeoutRef.current) {
      clearTimeout(fieldSyncTimeoutRef.current);
    }

    fieldSyncTimeoutRef.current = setTimeout(() => {
      flushFieldChanges();
    }, SHORTCUT_EDITOR_SYNC_DELAY);
  }, [flushFieldChanges]);

  React.useEffect(() => {
    if (documentSignature === lastPropDocumentSignatureRef.current) {
      return;
    }

    lastPropDocumentSignatureRef.current = documentSignature;
    pendingDocumentRef.current = null;
    if (documentSyncTimeoutRef.current) {
      clearTimeout(documentSyncTimeoutRef.current);
      documentSyncTimeoutRef.current = null;
    }

    if (documentSignature === lastCommittedDocumentSignatureRef.current) {
      return;
    }

    setEditorResetVersion((current) => current + 1);
  }, [documentSignature]);

  React.useEffect(() => {
    if (valuesSignature === lastPropValuesSignatureRef.current) {
      return;
    }

    lastPropValuesSignatureRef.current = valuesSignature;
    pendingFieldValuesRef.current = {};
    if (fieldSyncTimeoutRef.current) {
      clearTimeout(fieldSyncTimeoutRef.current);
      fieldSyncTimeoutRef.current = null;
    }
    setLocalValues(values);
  }, [values, valuesSignature]);

  React.useEffect(() => () => {
    if (documentSyncTimeoutRef.current) {
      clearTimeout(documentSyncTimeoutRef.current);
    }
    if (fieldSyncTimeoutRef.current) {
      clearTimeout(fieldSyncTimeoutRef.current);
    }
  }, []);

  const insertTokenAtSelection = React.useCallback((fieldId: string) => {
    const tokenNode: ShortcutSlateTokenElement = {
      type: 'token',
      fieldId,
      children: [{ text: '' }],
    };

    ReactEditor.focus(editor);

    if (!editor.selection) {
      Transforms.select(editor, Editor.end(editor, []));
    }

    if (editor.selection && !Range.isCollapsed(editor.selection)) {
      Transforms.delete(editor);
    }

    Transforms.insertNodes(editor, tokenNode);
  }, [editor]);

  React.useEffect(() => {
    if (!insertTokenRequest || insertTokenRequest.requestId === lastHandledInsertRequestRef.current) {
      return;
    }

    insertTokenAtSelection(insertTokenRequest.fieldId);
    lastHandledInsertRequestRef.current = insertTokenRequest.requestId;
    onInsertTokenRequestHandled?.(insertTokenRequest.requestId);
  }, [insertTokenAtSelection, insertTokenRequest, onInsertTokenRequestHandled]);

  const handleFieldChange = React.useCallback((fieldId: string, value: string) => {
    setLocalValues((current) => (
      current[fieldId] === value
        ? current
        : {
          ...current,
          [fieldId]: value,
        }
    ));
    pendingFieldValuesRef.current = {
      ...pendingFieldValuesRef.current,
      [fieldId]: value,
    };
    scheduleFieldChanges();
  }, [scheduleFieldChanges]);

  const renderElement = React.useCallback((props: RenderElementProps) => (
    <ElementRenderer
      {...props}
      shortcut={shortcut}
      values={localValues}
      onFieldChange={handleFieldChange}
    />
  ), [handleFieldChange, localValues, shortcut]);

  return (
    <div className="relative rounded-2xl  bg-transparent p-3 pr-8">
      <Slate
        key={editorResetVersion}
        editor={editor}
        initialValue={initialValue}
        onChange={(nextValue) => {
          const hasContentChange = editor.operations.some((operation) => operation.type !== 'set_selection');
          if (!hasContentChange) {
            return;
          }

          const nextDocument = buildEditorDocument(nextValue);
          pendingDocumentRef.current = cloneShortcutEditorDocument(nextDocument);
          scheduleDocumentChange();
        }}
      >
        <HoveringToolbar
          editor={editor}
          visible={isEditorFocused && Boolean(editor.selection) && !Range.isCollapsed(editor.selection as Range)}
        />
        <Editable
          role="textbox"
          aria-label="Prompt Template Editor"
          spellCheck={false}
          readOnly={isDisabled}
          renderElement={renderElement}
          onFocus={() => {
            setIsEditorFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            flushFieldChanges();
            flushDocumentChange();
            setIsEditorFocused(false);
            onFocusChange?.(false);
          }}
          placeholder="在模板里自由补充文本，保留 token 继续编辑"
          className="min-h-[86px] outline-none"
        />
      </Slate>
    </div>
  );
}

export const ShortcutSlateEditor = React.memo(ShortcutSlateEditorComponent);
ShortcutSlateEditor.displayName = 'ShortcutSlateEditor';
