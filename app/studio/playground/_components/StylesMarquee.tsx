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

interface StylesMarqueeProps {
  className?: string;
  onQuickApply: (shortcut: PlaygroundShortcut) => void;
  onPreviewImage?: (shortcut: PlaygroundShortcut, imageIndex: number) => void;
}

export const StylesMarquee: React.FC<StylesMarqueeProps> = ({ className, onQuickApply, onPreviewImage }) => {
  const [selectedShortcut, setSelectedShortcut] = React.useState<PlaygroundShortcut | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
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
          'group/marquee relative w-full select-none overflow-hidden pointer-events-auto',
          'py-[4vw] [@media(max-height:1080px)]:py-[2vw] [@media(max-height:900px)]:py-4 [@media(max-height:600px)]:hidden',
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
          className="flex w-max gap-36 group-hover/marquee:[animation-play-state:paused] [@media(max-height:750px)]:gap-12"
          style={{ animation: `marquee ${PLAYGROUND_SHORTCUTS.length * 9}s linear infinite` }}
        >
          {duplicatedShortcuts.map((shortcut, index) => (
            <div
              key={`${shortcut.id}-${index}`}
              className="w-[clamp(64px,14vw,168px)] shrink-0 pt-14 text-white transition-all duration-300 [@media(max-height:900px)]:w-[clamp(64px,12vw,152px)] [@media(max-height:900px)]:pt-12 [@media(max-height:750px)]:w-[clamp(88px,10vw,136px)] [@media(max-height:750px)]:pt-10"
            >
              <ShortcutStackCard
                shortcut={shortcut}
                moodboard={shortcutMoodboards[shortcut.id]}
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
        moodboard={selectedShortcut ? shortcutMoodboards[selectedShortcut.id] : null}
        onQuickApply={handleQuickApply}
        onPreviewImage={onPreviewImage}
      />
    </>
  );
};
