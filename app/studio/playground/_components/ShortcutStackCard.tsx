'use client';

import React, { useState } from 'react';
import NextImage from 'next/image';
import { motion } from 'framer-motion';
import { Sparkles, PanelsTopLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatImageUrl } from '@/lib/api-base';
import { cn } from '@/lib/utils';
import { type PlaygroundShortcut } from '@/config/playground-shortcuts';
import type { StyleStack } from './types';
import {
  SMALL_STACK_CARD_LAYOUT_CLASS,
  SMALL_STACK_DESCRIPTION_CLASS,
  SMALL_STACK_IMAGE_CLASS,
  SMALL_STACK_STAGE_CLASS,
  SMALL_STACK_TITLE_CLASS,
} from './style-card-layout';

interface ShortcutStackCardProps {
  shortcut: PlaygroundShortcut;
  moodboard?: StyleStack | null;
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
  onViewDetail: (shortcut: PlaygroundShortcut) => void;
  onPreviewImage?: (shortcut: PlaygroundShortcut, imageIndex: number) => void;
  size?: 'sm' | 'md';
}

export function ShortcutStackCard({
  shortcut,
  moodboard,
  onQuickApply,
  onViewDetail,
  onPreviewImage,
  size = 'md',
}: ShortcutStackCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isSmall = size === 'sm';
  const galleryImages = moodboard ? moodboard.imagePaths : shortcut.imagePaths;
  const displayImages = galleryImages.slice(-3).reverse();
  const collapsedOffset = isSmall ? 24 : 50;
  const expandedOffset = isSmall ? 72 : 160;

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-[2rem] transition-all',
        isSmall ? SMALL_STACK_CARD_LAYOUT_CLASS : 'gap-4 p-4'
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onClick={() => onViewDetail(shortcut)}
    >
      <div className="absolute -top-12 left-1/2 z-[30] flex -translate-x-1/2 gap-2 opacity-0 transition-all duration-300 group-hover:-translate-y-2 group-hover:opacity-100">
        <Button
          size="sm"
          className="h-9 rounded-full border border-white/10 bg-black/40 backdrop-blur-md px-4 text-white shadow-2xl transition-all hover:bg-[#15181C] hover:border-[#E8FFB7]/50"
          onClick={(event) => {
            event.stopPropagation();
            onQuickApply(shortcut);
          }}
        >
          <Sparkles size={14} className="mr-1.5 text-white" />
          快速应用
        </Button>
        <Button
          size="sm"
          className="h-9 rounded-full border border-white/10 bg-black/40  backdrop-blur-md px-4 text-white shadow-2xl transition-all hover:border-white/20 hover:bg-neutral-800"
          onClick={(event) => {
            event.stopPropagation();
            onViewDetail(shortcut);
          }}
        >
          <PanelsTopLeft size={14} className="mr-1.5 text-white/70" />
          查看详情
        </Button>
      </div>

      <div
        className={cn(
          'relative flex w-full items-center justify-center perspective-1000',
          isSmall ? SMALL_STACK_STAGE_CLASS : 'h-[200px]'
        )}
      >
        {displayImages.map((imagePath, index) => (
          <motion.div
            key={`${shortcut.id}-${imagePath}-${index}`}
            className={cn(
              'absolute overflow-hidden rounded-2xl border border-white/20 bg-none shadow-xl',
              isSmall ? SMALL_STACK_IMAGE_CLASS : 'h-[200px] w-40'
            )}
            initial={false}
            animate={{
              x: isExpanded
                ? (index - (displayImages.length - 1) / 2) * expandedOffset
                : (index - (displayImages.length - 1) / 2) * collapsedOffset,
              y: isExpanded ? (isSmall ? -10 : -20) : index * -4,
              rotate: isExpanded ? (index - (displayImages.length - 1) / 2) * 10 : (index - (displayImages.length - 1) / 2) * 5,
              zIndex: 10 - index,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
              mass: 1.2,
            }}
            onClick={(event) => {
              event.stopPropagation();
              if (onPreviewImage) {
                // 计算原始图片索引
                const originalIndex = galleryImages.indexOf(imagePath);
                if (originalIndex !== -1) {
                  onPreviewImage(shortcut, originalIndex);
                  return;
                }
              }
              onViewDetail(shortcut);
            }}
            style={{ cursor: onPreviewImage ? 'zoom-in' : 'pointer' }}
          >
            <NextImage
              src={formatImageUrl(imagePath)}
              alt={`${shortcut.name} cover ${index + 1}`}
              fill
              sizes={isSmall ? '(max-width: 1280px) 96px, 112px' : '220px'}
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              unoptimized
            />
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-col items-center justify-center">
          <h3
            className={cn(
              'w-full truncate text-center font-semibold text-white transition-all duration-300',
              isSmall ? SMALL_STACK_TITLE_CLASS : 'text-lg'
            )}
          >
            {moodboard?.name || shortcut.name}
          </h3>
          <p
            className={cn(
              'mt-1 w-full text-center text-white/48 transition-all duration-300',
              isSmall ? SMALL_STACK_DESCRIPTION_CLASS : 'min-h-[2.5rem] text-sm'
            )}
          >
            {shortcut.description}
          </p>
          {/* <span className={cn(
            'mt-2 max-w-full truncate rounded-full border border-white/10 bg-black/15 px-3 py-1 text-white/75',
            isSmall ? SMALL_STACK_BADGE_CLASS : 'text-[clamp(9px,0.75vw,11px)]'
          )}>
            {shortcut.modelLabel}
          </span> */}
        </div>
      </div>
    </div>
  );
}
