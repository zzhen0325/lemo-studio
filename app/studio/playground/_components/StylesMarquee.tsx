'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  PLAYGROUND_SHORTCUTS,
  type PlaygroundShortcut,
} from '@/config/playground-shortcuts';
import { ShortcutStackCard } from './ShortcutStackCard';
import { ShortcutDetailDialog } from './ShortcutDetailDialog';

interface StylesMarqueeProps {
  className?: string;
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
}

export const StylesMarquee: React.FC<StylesMarqueeProps> = ({ className, onQuickApply }) => {
  const [selectedShortcut, setSelectedShortcut] = React.useState<PlaygroundShortcut | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const duplicatedShortcuts = [...PLAYGROUND_SHORTCUTS, ...PLAYGROUND_SHORTCUTS, ...PLAYGROUND_SHORTCUTS];

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
          'group/marquee relative w-full select-none overflow-hidden pointer-events-auto',
          'py-[4vw] [@media(max-height:900px)]:py-[2vw] [@media(max-height:750px)]:py-4 [@media(max-height:650px)]:hidden',
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
          className="flex w-max gap-10 group-hover/marquee:[animation-play-state:paused]"
          style={{ animation: `marquee ${PLAYGROUND_SHORTCUTS.length * 9}s linear infinite` }}
        >
          {duplicatedShortcuts.map((shortcut, index) => (
            <div
              key={`${shortcut.id}-${index}`}
              className="w-[14vw] min-w-[140px] shrink-0 text-white transition-all duration-300 [@media(max-height:900px)]:w-[12vw] [@media(max-height:750px)]:w-[10vw]"
            >
              <ShortcutStackCard
                shortcut={shortcut}
                size="sm"
                onQuickApply={handleQuickApply}
                onViewDetail={handleViewDetail}
              />
            </div>
          ))}
        </div>
      </div>

      <ShortcutDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        shortcut={selectedShortcut}
        onQuickApply={handleQuickApply}
      />
    </>
  );
};
