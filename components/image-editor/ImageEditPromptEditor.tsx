"use client";

import React from 'react';
import {
  createEditor,
  Descendant,
  Editor,
  Element as SlateElement,
  Range,
  Text,
  Transforms,
} from 'slate';
import { withHistory } from 'slate-history';
import {
  Editable,
  ReactEditor,
  RenderElementProps,
  Slate,
  useFocused,
  useSelected,
  withReact,
} from 'slate-react';
import { cn } from '@/lib/utils';
import type { ImageEditorAnnotation } from './types';
import { IMAGE_EDITOR_THEME } from './theme';
import {
  buildPromptTokenLabelByAnnotationId,
  parseImageEditPromptParts,
  serializeImageEditPromptParts,
  type ImageEditPromptPart,
} from './utils/image-edit-prompt-tokens';

type ImageEditPromptText = {
  text: string;
};

type ImageEditPromptTokenElement = {
  type: 'annotation-token';
  annotationId: string;
  children: ImageEditPromptText[];
};

type ImageEditPromptParagraphElement = {
  type: 'paragraph';
  children: Array<ImageEditPromptText | ImageEditPromptTokenElement>;
};

type ImageEditPromptElement =
  | ImageEditPromptTokenElement
  | ImageEditPromptParagraphElement;

interface ImageEditPromptEditorProps {
  prompt: string;
  annotations: ImageEditorAnnotation[];
  onPromptChange: (value: string) => void;
  onTokenIdsChange?: (annotationIds: string[]) => void;
  onFocusChange?: (focused: boolean) => void;
  insertTokenRequest?: {
    requestId: string;
    annotationId: string;
  } | null;
  onInsertTokenRequestHandled?: (requestId: string) => void;
}

const PROMPT_SYNC_DELAY = 120;

function withImageEditPromptElements(editor: Editor) {
  const { isInline, isVoid } = editor;

  editor.isInline = (element) => {
    const slateElement = element as { type?: string };
    if (SlateElement.isElement(element) && slateElement.type === 'annotation-token') {
      return true;
    }
    return isInline(element);
  };

  editor.isVoid = (element) => {
    const slateElement = element as { type?: string };
    if (SlateElement.isElement(element) && slateElement.type === 'annotation-token') {
      return true;
    }
    return isVoid(element);
  };

  return editor;
}

function buildSlateValue(
  prompt: string,
  annotations: ImageEditorAnnotation[],
): Descendant[] {
  return parseImageEditPromptParts(prompt, annotations).map((paragraph) => ({
    type: 'paragraph',
    children: paragraph.map((part) => {
      if (part.type === 'text') {
        return { text: part.text };
      }

      return {
        type: 'annotation-token',
        annotationId: part.annotationId,
        children: [{ text: '' }],
      };
    }),
  })) as unknown as Descendant[];
}

function buildPrompt(value: Descendant[], annotations: ImageEditorAnnotation[]): string {
  const paragraphs = value.reduce<ImageEditPromptPart[][]>((result, node) => {
    const element = node as unknown as ImageEditPromptElement;
    if (!SlateElement.isElement(node) || element.type !== 'paragraph') {
      return result;
    }

    const paragraph = element.children.reduce<ImageEditPromptPart[]>((parts, child) => {
      const childElement = child as unknown as ImageEditPromptElement;

      if (SlateElement.isElement(child) && childElement.type === 'annotation-token') {
        parts.push({
          type: 'annotation-token',
          annotationId: childElement.annotationId,
        });
        return parts;
      }

      if (Text.isText(child)) {
        parts.push({
          type: 'text',
          text: child.text,
        });
      }

      return parts;
    }, []);

    result.push(paragraph.length > 0 ? paragraph : [{ type: 'text', text: '' }]);
    return result;
  }, []);

  return serializeImageEditPromptParts(paragraphs, annotations);
}

function collectTokenAnnotationIds(value: Descendant[]): string[] {
  return value.reduce<string[]>((result, node) => {
    const element = node as unknown as ImageEditPromptElement;
    if (!SlateElement.isElement(node) || element.type !== 'paragraph') {
      return result;
    }

    element.children.forEach((child) => {
      const childElement = child as unknown as ImageEditPromptElement;
      if (SlateElement.isElement(child) && childElement.type === 'annotation-token') {
        result.push(childElement.annotationId);
      }
    });

    return result;
  }, []);
}

function isSelectionValid(editor: Editor, selection: Range | null): selection is Range {
  if (!selection) {
    return false;
  }

  try {
    Editor.node(editor, selection.anchor.path);
    Editor.node(editor, selection.focus.path);
    return true;
  } catch {
    return false;
  }
}

function AnnotationTokenElement({
  attributes,
  children,
  element,
  tokenLabelByAnnotationId,
}: {
  attributes: RenderElementProps['attributes'];
  children: React.ReactNode;
  element: ImageEditPromptTokenElement;
  tokenLabelByAnnotationId: Map<string, string>;
}) {
  const selected = useSelected();
  const focused = useFocused();
  const tokenLabel = tokenLabelByAnnotationId.get(element.annotationId) || '标注区域';

  return (
    <span
      {...attributes}
      contentEditable={false}
      className="mx-1 inline-flex align-baseline"
    >
      <span
          className={cn(
            "inline-flex h-7 items-center rounded-sm border px-3 text-xs font-medium transition-colors text-[#D9D9D9]",
            selected && focused 
              ? "border-[#DAFFAC] bg-[#DAFFAC]/[0.14]" 
              : "border-[#4A4C4D] bg-[#2C2D2F]"
          )}
        >
          {tokenLabel}
        </span>
      {children}
    </span>
  );
}

function ElementRenderer(
  props: RenderElementProps & {
    tokenLabelByAnnotationId: Map<string, string>;
  },
) {
  const element = props.element as unknown as ImageEditPromptElement;

  if (element.type === 'annotation-token') {
    return (
      <AnnotationTokenElement
        attributes={props.attributes}
        element={element}
        tokenLabelByAnnotationId={props.tokenLabelByAnnotationId}
      >
        {props.children}
      </AnnotationTokenElement>
    );
  }

  return (
    <p {...props.attributes} className="min-h-[1.75rem] whitespace-pre-wrap break-words text-sm leading-8">
      {props.children}
    </p>
  );
}

export default function ImageEditPromptEditor({
  prompt,
  annotations,
  onPromptChange,
  onTokenIdsChange,
  onFocusChange,
  insertTokenRequest,
  onInsertTokenRequestHandled,
}: ImageEditPromptEditorProps) {
  const lastPropPromptRef = React.useRef(prompt);
  const lastCommittedPromptRef = React.useRef(prompt);
  const lastHandledInsertRequestRef = React.useRef<string | null>(null);
  const lastSelectionRef = React.useRef<Range | null>(null);
  const pendingPromptRef = React.useRef<string | null>(null);
  const promptSyncTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editorResetVersion, setEditorResetVersion] = React.useState(0);
  const [isEditorFocused, setIsEditorFocused] = React.useState(false);
  const editor = React.useMemo(
    () => {
      void editorResetVersion;
      return withImageEditPromptElements(withHistory(withReact(createEditor())));
    },
    [editorResetVersion],
  );
  const initialValue = React.useMemo(
    () => {
      void editorResetVersion;
      return buildSlateValue(prompt, annotations);
    },
    [annotations, editorResetVersion, prompt],
  );
  const tokenLabelByAnnotationId = React.useMemo(
    () => buildPromptTokenLabelByAnnotationId(annotations),
    [annotations],
  );

  const flushPromptChange = React.useCallback(() => {
    if (promptSyncTimeoutRef.current) {
      clearTimeout(promptSyncTimeoutRef.current);
      promptSyncTimeoutRef.current = null;
    }

    const pendingPrompt = pendingPromptRef.current;
    if (pendingPrompt === null) {
      return;
    }

    pendingPromptRef.current = null;
    lastCommittedPromptRef.current = pendingPrompt;
    React.startTransition(() => {
      onPromptChange(pendingPrompt);
    });
  }, [onPromptChange]);

  const schedulePromptChange = React.useCallback(() => {
    if (promptSyncTimeoutRef.current) {
      clearTimeout(promptSyncTimeoutRef.current);
    }

    promptSyncTimeoutRef.current = setTimeout(() => {
      flushPromptChange();
    }, PROMPT_SYNC_DELAY);
  }, [flushPromptChange]);

  React.useEffect(() => {
    if (prompt === lastPropPromptRef.current) {
      return;
    }

    lastPropPromptRef.current = prompt;
    if (prompt === lastCommittedPromptRef.current || prompt === pendingPromptRef.current || isEditorFocused) {
      return;
    }

    lastSelectionRef.current = null;
    setEditorResetVersion((current) => current + 1);
  }, [isEditorFocused, prompt]);

  React.useEffect(() => () => {
    if (promptSyncTimeoutRef.current) {
      clearTimeout(promptSyncTimeoutRef.current);
    }
  }, []);

  React.useEffect(() => {
    onTokenIdsChange?.(collectTokenAnnotationIds(editor.children));
  }, [editor, editorResetVersion, onTokenIdsChange]);

  React.useEffect(() => {
    const validAnnotationIds = new Set(annotations.map((annotation) => annotation.id));
    const invalidTokenEntries = Array.from(
      Editor.nodes(editor, {
        at: [],
        match: (node) => {
          const slateElement = node as { type?: string; annotationId?: string };
          return SlateElement.isElement(node)
            && slateElement.type === 'annotation-token'
            && !validAnnotationIds.has(slateElement.annotationId || '');
        },
      }),
    );

    if (invalidTokenEntries.length === 0) {
      return;
    }

    const previousSelection = isSelectionValid(editor, editor.selection) ? editor.selection : null;
    if (!previousSelection) {
      editor.selection = null;
      lastSelectionRef.current = null;
    }

    Editor.withoutNormalizing(editor, () => {
      invalidTokenEntries.reverse().forEach(([, path]) => {
        Transforms.removeNodes(editor, { at: path });
      });
    });

    if (previousSelection) {
      try {
        Transforms.select(editor, previousSelection);
      } catch {
        editor.selection = null;
        lastSelectionRef.current = null;
      }
    }

    if (!isSelectionValid(editor, editor.selection)) {
      try {
        const end = Editor.end(editor, []);
        const fallbackSelection = { anchor: end, focus: end };
        Transforms.select(editor, fallbackSelection);
        lastSelectionRef.current = fallbackSelection;
      } catch {
        editor.selection = null;
        lastSelectionRef.current = null;
      }
    } else {
      lastSelectionRef.current = editor.selection;
    }

    const nextPrompt = buildPrompt(editor.children, annotations);
    pendingPromptRef.current = nextPrompt;
    onTokenIdsChange?.(collectTokenAnnotationIds(editor.children));
    flushPromptChange();
  }, [annotations, editor, flushPromptChange, onTokenIdsChange]);

  const insertTokenAtSelection = React.useCallback((annotationId: string) => {
    const tokenNode: ImageEditPromptTokenElement = {
      type: 'annotation-token',
      annotationId,
      children: [{ text: '' }],
    };

    if (!isSelectionValid(editor, editor.selection)) {
      editor.selection = null;
    }

    if (!editor.selection && isSelectionValid(editor, lastSelectionRef.current)) {
      try {
        Transforms.select(editor, lastSelectionRef.current);
      } catch {
        editor.selection = null;
        lastSelectionRef.current = null;
      }
    }

    if (!editor.selection) {
      try {
        const end = Editor.end(editor, []);
        const fallbackSelection = { anchor: end, focus: end };
        Transforms.select(editor, fallbackSelection);
        lastSelectionRef.current = fallbackSelection;
      } catch {
        editor.selection = null;
        lastSelectionRef.current = null;
      }
    }

    try {
      ReactEditor.focus(editor);
    } catch {
      editor.selection = null;
      try {
        ReactEditor.focus(editor);
      } catch {
        return;
      }
    }

    if (editor.selection && !Range.isCollapsed(editor.selection)) {
      Transforms.delete(editor);
    }

    Transforms.insertNodes(editor, tokenNode as any);
    lastSelectionRef.current = editor.selection;
  }, [editor]);

  React.useEffect(() => {
    if (!insertTokenRequest || insertTokenRequest.requestId === lastHandledInsertRequestRef.current) {
      return;
    }

    insertTokenAtSelection(insertTokenRequest.annotationId);
    lastHandledInsertRequestRef.current = insertTokenRequest.requestId;
    onInsertTokenRequestHandled?.(insertTokenRequest.requestId);
  }, [insertTokenAtSelection, insertTokenRequest, onInsertTokenRequestHandled]);

  const renderElement = React.useCallback((props: RenderElementProps) => (
    <ElementRenderer
      {...props}
      tokenLabelByAnnotationId={tokenLabelByAnnotationId}
    />
  ), [tokenLabelByAnnotationId]);

  return (
    <div className="relative rounded-2xl bg-transparent p-2">
      <Slate
        key={editorResetVersion}
        editor={editor}
        initialValue={initialValue}
        onChange={(nextValue) => {
          if (editor.selection) {
            lastSelectionRef.current = editor.selection;
          }

          const hasContentChange = editor.operations.some((operation) => operation.type !== 'set_selection');
          if (!hasContentChange) {
            return;
          }

          const nextPrompt = buildPrompt(nextValue, annotations);
          pendingPromptRef.current = nextPrompt;
          onTokenIdsChange?.(collectTokenAnnotationIds(nextValue));
          schedulePromptChange();
        }}
      >
        <Editable
          role="textbox"
          aria-label="Prompt"
          spellCheck={false}
          renderElement={renderElement}
          placeholder="输入基础编辑prompt，在标注 token 后继续补充prompt..."
          className="min-h-[320px] w-full outline-none text-[#D9D9D9]"
          onFocus={() => {
            setIsEditorFocused(true);
            onFocusChange?.(true);
          }}
          onBlur={() => {
            flushPromptChange();
            lastSelectionRef.current = editor.selection;
            setIsEditorFocused(false);
            onFocusChange?.(false);
          }}
        />
      </Slate>
    </div>
  );
}
