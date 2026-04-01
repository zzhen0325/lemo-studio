'use client';

import React from 'react';

import { cn } from '@/lib/utils';
import { type PlaygroundShortcut, type ShortcutMoodboardEntry } from '@/config/playground-shortcuts';
import { ShortcutStackCard } from './ShortcutStackCard';
import { MoodboardDetailDialog } from './MoodboardDetailDialog';
import {
  SMALL_STACK_MARQUEE_ITEM_CLASS,
  SMALL_STACK_MARQUEE_ROOT_CLASS,
  SMALL_STACK_MARQUEE_TRACK_CLASS,
} from './style-card-layout';

interface StylesMarqueeProps {
  className?: string;
  items: ShortcutMoodboardEntry[];
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
  onPreviewImage?: (shortcut: PlaygroundShortcut, imageIndex: number) => void;
  onShortcutsChange?: () => Promise<void> | void;
}

export const StylesMarquee: React.FC<StylesMarqueeProps> = ({
  className,
  items,
  onQuickApply,
  onPreviewImage,
  onShortcutsChange,
}) => {
  const [selectedShortcut, setSelectedShortcut] = React.useState<PlaygroundShortcut | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const duplicatedItems = React.useMemo(
    () => [...items, ...items, ...items],
    [items],
  );

  const handleViewDetail = React.useCallback((shortcut: PlaygroundShortcut) => {
    setSelectedShortcut(shortcut);
    setIsDetailOpen(true);
  }, []);

  const handleQuickApply = React.useCallback((shortcut: PlaygroundShortcut) => {
    setIsDetailOpen(false);
    onQuickApply(shortcut);
  }, [onQuickApply]);

  return (
    <>
      <div
        className={cn(
          'relative w-full select-none overflow-hidden pointer-events-none',
          SMALL_STACK_MARQUEE_ROOT_CLASS,
          className,
        )}
      >
        <style>
          {`
            @keyframes marquee {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-33.33%); }
            }
          `}
        </style>
        <div
          className={cn(
            SMALL_STACK_MARQUEE_TRACK_CLASS,
            'pointer-events-none',
          )}
          style={{
            animation: `marquee ${Math.max(items.length, 1) * 9}s linear infinite`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {duplicatedItems.map(({ shortcut, moodboard }, index) => (
            <div
              key={`${shortcut.id}-${moodboard.id}-${index}`}
              className={cn(
                SMALL_STACK_MARQUEE_ITEM_CLASS,
                'pointer-events-none',
              )}
            >
              <div
                className="pointer-events-auto"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
              >
                <ShortcutStackCard
                  shortcut={shortcut}
                  moodboard={moodboard}
                  size="sm"
                  onQuickApply={handleQuickApply}
                  onViewDetail={handleViewDetail}
                  onPreviewImage={onPreviewImage}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <MoodboardDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        moodboard={selectedShortcut ? items.find((item) => item.shortcut.id === selectedShortcut.id)?.moodboard || null : null}
        shortcut={selectedShortcut}
        onShortcutQuickApply={handleQuickApply}
        onShortcutPreviewImage={onPreviewImage}
        onShortcutsChange={onShortcutsChange}
      />
    </>
  );
};
