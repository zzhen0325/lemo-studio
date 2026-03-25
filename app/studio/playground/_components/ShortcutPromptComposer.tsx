'use client';

import React from 'react';
import { X } from 'lucide-react';
import {
  getShortcutRenderableFieldSegments,
  normalizeShortcutColorValue,
  sanitizeShortcutColorDraft,
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from '@/config/playground-shortcuts';
import { cn } from '@/lib/utils';

interface ShortcutPromptComposerProps {
  shortcut: PlaygroundShortcut;
  values: ShortcutPromptValues;
  removedFieldIds: string[];
  onFieldChange: (fieldId: string, value: string) => void;
  onRemoveField: (fieldId: string) => void;
  onExitTemplateMode: () => void;
}

export function ShortcutPromptComposer({
  shortcut,
  values,
  removedFieldIds,
  onFieldChange,
  onRemoveField,
  onExitTemplateMode,
}: ShortcutPromptComposerProps) {
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const colorPickerRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocusFieldIdRef = React.useRef<string | null>(null);
  const visibleSegments = React.useMemo(
    () => getShortcutRenderableFieldSegments(shortcut, values, { removedFieldIds }),
    [removedFieldIds, shortcut, values]
  );
  const visibleFieldIds = React.useMemo(
    () => visibleSegments.map((segment) => segment.field.id),
    [visibleSegments]
  );
  const initialFieldId = React.useMemo(
    () => visibleSegments.find((segment) => segment.field.required)?.field.id || visibleSegments[0]?.field.id || null,
    [visibleSegments]
  );

  React.useEffect(() => {
    if (!initialFieldId) {
      return;
    }
    inputRefs.current[initialFieldId]?.focus();
  }, [initialFieldId, shortcut.id]);

  React.useEffect(() => {
    const pendingFocusFieldId = pendingFocusFieldIdRef.current;
    if (!pendingFocusFieldId) {
      return;
    }

    const target = inputRefs.current[pendingFocusFieldId];
    if (target) {
      target.focus();
    }
    pendingFocusFieldIdRef.current = null;
  }, [visibleFieldIds]);

  return (
    <div className="flex w-full flex-col gap-3 p-2 pb-4 pl-4 pr-10">
      <div className="flex min-h-[86px] flex-wrap items-center gap-x-1.5 gap-y-2 py-1 text-sm leading-7 text-white/88">
        {visibleSegments.length === 0 ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
            所有 inline token 已删除，可直接应用为纯文本继续编辑。
          </span>
        ) : (
          visibleSegments.map((segment, index) => {
            const { field, prefixText } = segment;
            const nextFieldId = visibleSegments[index + 1]?.field.id || visibleSegments[index - 1]?.field.id || null;

            return (
              <React.Fragment key={`field-${shortcut.id}-${field.id}-${index}`}>
                {prefixText ? (
                  <span className="whitespace-pre-wrap">
                    {prefixText}
                  </span>
                ) : null}
                <label
                  className={cn(
                    'inline-flex h-8 items-center gap-2 rounded-md border border-[#E8FFB7]/30 bg-[#e8ffb71a] px-2 text-white transition-colors focus-within:border-[#E8FFB7]/60 focus-within:bg-[#E8FFB7]/18',
                    field.widthClassName
                  )}
                >
                  <span className="whitespace-nowrap text-[11px] font-medium uppercase text-[#F4FFCE]">
                    {field.label}
                  </span>
                  {field.type === 'color' ? (
                    <div className="flex min-w-[7rem] flex-1 items-center gap-2">
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => colorPickerRefs.current[field.id]?.click()}
                        className="h-5 w-5 shrink-0 rounded-full border border-white/30 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                        style={{ backgroundColor: normalizeShortcutColorValue(values[field.id]) || '#FF6B00' }}
                        aria-label={`选择 ${field.label}`}
                      />
                      <input
                        ref={(node) => {
                          inputRefs.current[field.id] = node;
                        }}
                        value={values[field.id] || ''}
                        onChange={(event) => onFieldChange(field.id, sanitizeShortcutColorDraft(event.target.value))}
                        placeholder={field.placeholder}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        className="min-w-[5rem] flex-1 bg-transparent text-sm uppercase text-white outline-none placeholder:text-white/35"
                      />
                      <input
                        ref={(node) => {
                          colorPickerRefs.current[field.id] = node;
                        }}
                        type="color"
                        tabIndex={-1}
                        value={normalizeShortcutColorValue(values[field.id]) || '#FF6B00'}
                        onChange={(event) => onFieldChange(field.id, event.target.value.toUpperCase())}
                        className="sr-only"
                      />
                    </div>
                  ) : (
                    <input
                      ref={(node) => {
                        inputRefs.current[field.id] = node;
                      }}
                      value={values[field.id] || ''}
                      onChange={(event) => onFieldChange(field.id, event.target.value)}
                      placeholder={field.placeholder}
                      className="min-w-[5rem] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                    />
                  )}
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      pendingFocusFieldIdRef.current = nextFieldId;
                      onRemoveField(field.id);
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[#F4FFCE]/65 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label={`删除 ${field.label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </label>
              </React.Fragment>
            );
          })
        )}
      </div>
      <div className="flex items-center justify-start">
        {/* <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
            {shortcut.modelLabel}
          </span>
        </div> */}
        <button
          type="button"
          onClick={onExitTemplateMode}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          应用为纯文本
        </button>
      </div>
    </div>
  );
}
