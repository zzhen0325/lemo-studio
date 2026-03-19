'use client';

import React from 'react';
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { type PlaygroundShortcut } from '@/config/playground-shortcuts';

interface ShortcutDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcut: PlaygroundShortcut | null;
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
}

export function ShortcutDetailDialog({
  open,
  onOpenChange,
  shortcut,
  onQuickApply,
}: ShortcutDetailDialogProps) {
  if (!shortcut) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#08090C]/96 p-0 text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
        <div className="grid max-h-[88vh] grid-cols-1 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-y-auto border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[#E8FFB7]/30 bg-[#E8FFB7]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#F4FFCE]">
                    {shortcut.name}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
                    {shortcut.modelLabel}
                  </span>
                </div>
                <DialogTitle className="text-2xl font-semibold text-white">
                  {shortcut.name} Moodboard
                </DialogTitle>
                <DialogDescription className="max-w-2xl text-sm leading-6 text-white/55">
                  {shortcut.detailDescription}
                </DialogDescription>
              </div>
              <Button
                type="button"
                onClick={() => onQuickApply(shortcut)}
                className="rounded-full bg-[#E8FFB7] px-5 text-sm font-medium text-black hover:bg-[#F0FFC6]"
              >
                快速生成
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shortcut.imagePaths.map((imagePath, index) => (
                <div
                  key={`${shortcut.id}-${imagePath}-${index}`}
                  className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/5"
                >
                  <div className="relative aspect-[4/5]">
                    <NextImage
                      src={imagePath}
                      alt={`${shortcut.name} gallery ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-white/45">
                  Prompt Template
                </h3>
                <div className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-sm leading-7 text-white/85">
                    {shortcut.promptParts.map((part, index) => {
                      if (part.type === 'text') {
                        return (
                          <span key={`prompt-text-${shortcut.id}-${index}`} className="whitespace-pre-wrap">
                            {part.value}
                          </span>
                        );
                      }

                      const field = shortcut.fields.find((item) => item.id === part.fieldId);
                      if (!field) {
                        return null;
                      }

                      return (
                        <span
                          key={`prompt-field-${shortcut.id}-${field.id}-${index}`}
                          className="inline-flex items-center rounded-full border border-[#E8FFB7]/30 bg-[#E8FFB7]/12 px-3 py-1.5 text-sm text-[#F4FFCE]"
                        >
                          {field.placeholder}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium uppercase tracking-[0.18em] text-white/45">
                  Required Inputs
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {shortcut.fields.map((field) => (
                    <span
                      key={`${shortcut.id}-${field.id}`}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70"
                    >
                      {field.label}
                      {field.required ? ' *' : ''}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-white/50">
                点击“快速生成”后，会把对应模型、比例和 prompt 模板应用到首页输入区。你可以直接填写高亮字段，再走现有生成按钮。
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
