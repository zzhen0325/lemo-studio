'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  PLAYGROUND_SHORTCUTS,
  getShortcutMoodboardId,
  type PlaygroundShortcut,
} from '@/config/playground-shortcuts';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { ShortcutStackCard } from './ShortcutStackCard';
import { ShortcutDetailDialog } from './ShortcutDetailDialog';
import {
  SMALL_STACK_MARQUEE_ITEM_CLASS,
  SMALL_STACK_MARQUEE_ROOT_CLASS,
  SMALL_STACK_MARQUEE_TRACK_CLASS,
} from './style-card-layout';

interface StylesMarqueeProps {
  className?: string;
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
  onPreviewImage?: (shortcut: PlaygroundShortcut, imageIndex: number) => void;
}

export const StylesMarquee: React.FC<StylesMarqueeProps> = ({ className, onQuickApply, onPreviewImage }) => {
  const [selectedShortcut, setSelectedShortcut] = React.useState<PlaygroundShortcut | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const styles = usePlaygroundStore((state) => state.styles);
  const initStyles = usePlaygroundStore((state) => state.initStyles);
  const duplicatedShortcuts = [...PLAYGROUND_SHORTCUTS, ...PLAYGROUND_SHORTCUTS, ...PLAYGROUND_SHORTCUTS];

  React.useEffect(() => {
    void initStyles();
  }, [initStyles]);

  const shortcutMoodboards = React.useMemo(() => {
    const moodboardById = new Map(styles.map((style) => [style.id, style]));
    return PLAYGROUND_SHORTCUTS.reduce<Record<string, (typeof styles)[number] | null>>((acc, shortcut) => {
      acc[shortcut.id] = moodboardById.get(getShortcutMoodboardId(shortcut.id)) || null;
      return acc;
    }, {});
  }, [styles]);

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
          className
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
            'pointer-events-none'
          )}
          style={{
            animation: `marquee ${PLAYGROUND_SHORTCUTS.length * 9}s linear infinite`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        >
          {duplicatedShortcuts.map((shortcut, index) => (
            <div
              key={`${shortcut.id}-${index}`}
              className={cn(
                SMALL_STACK_MARQUEE_ITEM_CLASS,
                'pointer-events-none'
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

      <ShortcutDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        shortcut={selectedShortcut}
        moodboard={selectedShortcut ? shortcutMoodboards[selectedShortcut.id] : null}
        onQuickApply={handleQuickApply}
        onPreviewImage={onPreviewImage}
      />
    </>
  );
};
