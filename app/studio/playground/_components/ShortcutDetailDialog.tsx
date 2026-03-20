'use client';

import React from 'react';
import NextImage from 'next/image';
import { ZoomIn } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  buildShortcutPrompt,
  createShortcutPromptValues,
  type PlaygroundShortcut,
} from '@/config/playground-shortcuts';
import type { StyleStack } from './types';

interface ShortcutDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcut: PlaygroundShortcut | null;
  moodboard?: StyleStack | null;
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
  onPreviewImage?: (shortcut: PlaygroundShortcut, imageIndex: number) => void;
}

export function ShortcutDetailDialog({
  open,
  onOpenChange,
  shortcut,
  moodboard,
  onQuickApply,
  onPreviewImage,
}: ShortcutDetailDialogProps) {
  if (!shortcut) {
    return null;
  }

  const galleryImages = moodboard?.imagePaths?.length ? moodboard.imagePaths : shortcut.imagePaths;
  const currentPrompt = moodboard?.prompt?.trim() || '';
  const boardName = moodboard?.name || shortcut.name;
  const promptTemplate = buildShortcutPrompt(shortcut, createShortcutPromptValues(shortcut));
  const shouldShowCurrentPrompt = Boolean(currentPrompt) && currentPrompt !== promptTemplate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-full max-h-[68vh] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-black/80 p-4 backdrop-blur-md text-white shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
        <div className="grid max-h-[88vh] grid-cols-1 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-y-auto border-b border-white/10 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="space-y-2 ">
                <div className="flex items-center gap-2 mb-6">
                  <span className="rounded-full border border-[#E8FFB7]/30 bg-[#E8FFB7]/10 px-3 py-1 text-[11px] uppercase  text-[#F4FFCE]">
                    {shortcut.name}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
                    {shortcut.modelLabel}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/55">
                    {galleryImages.length} images
                  </span>
                </div>
                <DialogTitle className="text-2xl font-semibold text-white ">
                  {boardName} Moodboard
                </DialogTitle>
                <DialogDescription className="max-w-2xl text-sm  text-white/55">
                  {shortcut.detailDescription}
                </DialogDescription>
              </div>

            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {galleryImages.map((imagePath, index) => (
                <div
                  key={`${shortcut.id}-${imagePath}-${index}`}
                  className="relative overflow-hidden rounded-md border border-white/10 bg-white/5"
                >
                  <button
                    type="button"
                    className="group relative block aspect-[4/5] w-full cursor-zoom-in"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPreviewImage?.(shortcut, index);
                    }}
                    aria-label={`预览 ${shortcut.name} 示例图 ${index + 1}`}
                  >
                    <NextImage
                      src={imagePath}
                      alt={`${shortcut.name} gallery ${index + 1}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/20" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/0 backdrop-blur-md transition-all duration-200 group-hover:scale-100 group-hover:text-white/90 scale-90">
                        <ZoomIn className="h-4 w-4" />
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

            <div className="relative flex flex-col overflow-y-auto p-6">
            <div className="flex-1 space-y-6">
              {shouldShowCurrentPrompt && (
                <div>
                  <h3 className="text-sm font-medium   text-white/45">
                    Current Prompt
                  </h3>
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/10 p-5">
                    <p className="text-sm leading-7 text-white/85 whitespace-pre-wrap">
                      {currentPrompt}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium   text-white/45">
                  Prompt Template
                </h3>
                <div className="mt-4 rounded-xl border border-white/10 bg-white/10 p-5">
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
                          className="inline-flex items-center rounded-md border border-[#E8FFB7]/30 bg-[#E8FFB7]/12 px-2 py-1 text-sm text-[#F4FFCE]"
                        >
                                {field.placeholder}
                            </span>
                          );
                        })}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium   text-white/45">
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
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                type="button"
                onClick={() => onQuickApply(shortcut)}
                className="rounded-full bg-[#E8FFB7] px-5 text-sm font-medium text-black hover:bg-[#F0FFC6]"
              >
                快速应用prompt模版
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
