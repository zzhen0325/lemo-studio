'use client';

import React from 'react';

import { cn } from '@/lib/utils';
import type { StyleStack } from '@/types/database';
import { type PlaygroundShortcut } from '@/config/playground-shortcuts';
import { ShortcutStackCard } from './ShortcutStackCard';
import { MoodboardDetailDialog } from './MoodboardDetailDialog';
import {
  SMALL_STACK_MARQUEE_ITEM_CLASS,
  SMALL_STACK_MARQUEE_ROOT_CLASS,
  SMALL_STACK_MARQUEE_TRACK_CLASS,
} from './style-card-layout';

interface StylesMarqueeProps {
  className?: string;
  shortcuts: PlaygroundShortcut[];
  shortcutMoodboards: Record<string, StyleStack | null>;
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
  onPreviewImage?: (shortcut: PlaygroundShortcut, imageIndex: number) => void;
  onShortcutsChange?: () => Promise<void> | void;
}

export const StylesMarquee: React.FC<StylesMarqueeProps> = ({
  className,
  shortcuts,
  shortcutMoodboards,
  onQuickApply,
  onPreviewImage,
  onShortcutsChange,
}) => {
  const [selectedShortcut, setSelectedShortcut] = React.useState<PlaygroundShortcut | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const duplicatedShortcuts = React.useMemo(
    () => [...shortcuts, ...shortcuts, ...shortcuts],
    [shortcuts],
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
            animation: `marquee ${Math.max(shortcuts.length, 1) * 9}s linear infinite`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {duplicatedShortcuts.map((shortcut, index) => (
            <div
              key={`${shortcut.id}-${index}`}
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
                  moodboard={shortcutMoodboards[shortcut.id]}
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
        moodboard={selectedShortcut ? shortcutMoodboards[selectedShortcut.id] : null}
        shortcut={selectedShortcut}
        onShortcutQuickApply={handleQuickApply}
        onShortcutPreviewImage={onPreviewImage}
        onShortcutsChange={onShortcutsChange}
      />
    </>
  );
};
