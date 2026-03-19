'use client';

import React from 'react';
import {
  type PlaygroundShortcut,
  type ShortcutPromptValues,
} from '@/config/playground-shortcuts';
import { cn } from '@/lib/utils';

interface ShortcutPromptComposerProps {
  shortcut: PlaygroundShortcut;
  values: ShortcutPromptValues;
  onFieldChange: (fieldId: string, value: string) => void;
  onExitTemplateMode: () => void;
}

export function ShortcutPromptComposer({
  shortcut,
  values,
  onFieldChange,
  onExitTemplateMode,
}: ShortcutPromptComposerProps) {
  const inputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});
  const initialFieldId = React.useMemo(
    () => shortcut.fields.find((field) => field.required)?.id || shortcut.fields[0]?.id || null,
    [shortcut.fields]
  );

  React.useEffect(() => {
    if (!initialFieldId) {
      return;
    }
    inputRefs.current[initialFieldId]?.focus();
  }, [initialFieldId, shortcut.id]);

  return (
    <div className="flex w-full flex-col gap-3 p-2 pl-4 pr-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[#E8FFB7]/30 bg-[#E8FFB7]/12 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[#F4FFCE]">
            {shortcut.name}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
            {shortcut.modelLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onExitTemplateMode}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55 transition-colors hover:bg-white/10 hover:text-white"
        >
          纯文本编辑
        </button>
      </div>

      <div className="flex min-h-[86px] flex-wrap items-center gap-x-1.5 gap-y-2 py-1 text-sm leading-7 text-white/88">
        {shortcut.promptParts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <span key={`text-${shortcut.id}-${index}`} className="whitespace-pre-wrap">
                {part.value}
              </span>
            );
          }

          const field = shortcut.fields.find((item) => item.id === part.fieldId);
          if (!field) {
            return null;
          }

          return (
            <label
              key={`field-${shortcut.id}-${field.id}-${index}`}
              className={cn(
                'inline-flex h-8 items-center rounded-sm gap-2 p-1 border border-[#E8FFB7]/30 bg-[#E8FFB7]/12 px-3 text-white  transition-colors focus-within:border-[#E8FFB7]/60 focus-within:bg-[#E8FFB7]/18',
                field.widthClassName
              )}
            >
              <span className="whitespace-nowrap text-[11px] font-medium uppercase text-[#F4FFCE]">
                {field.label}
              </span>
              <input
                ref={(node) => {
                  inputRefs.current[field.id] = node;
                }}
                value={values[field.id] || ''}
                onChange={(event) => onFieldChange(field.id, event.target.value)}
                placeholder={field.placeholder}
                className="min-w-[5rem] flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35"
              />
            </label>
          );
        })}
      </div>

      <p className="text-xs text-white/40">
        填写高亮字段后会自动同步到当前 prompt，生成前会校验必填项。
      </p>
    </div>
  );
}
