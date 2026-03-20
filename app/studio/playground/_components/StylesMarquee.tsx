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

  // 动画时长基于内容数量，确保速度一致
  const animationDuration = PLAYGROUND_SHORTCUTS.length * 8;

  return (
    <>
      <div
        className={cn(
          'group/marquee relative w-full select-none overflow-hidden pointer-events-auto',
          // 响应式垂直内边距
          'py-[clamp(16px,4vw,48px)]',
          // 小屏幕高度时减少内边距
          '[@media(max-height:900px)]:py-[clamp(12px,2vw,32px)]',
          '[@media(max-height:750px)]:py-[clamp(8px,1.5vw,24px)]',
          '[@media(max-height:650px)]:hidden',
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
          className="flex w-max gap-4 group-hover/marquee:[animation-play-state:paused] sm:gap-6 md:gap-8 lg:gap-10"
          style={{ animation: `marquee ${animationDuration}s linear infinite` }}
        >
          {duplicatedShortcuts.map((shortcut, index) => (
            <div
              key={`${shortcut.id}-${index}`}
              className={cn(
                // 响应式宽度：使用 clamp 实现平滑缩放
                // 最小 120px，最大 220px，基准为 15vw
                'shrink-0 text-white transition-all duration-300',
                'w-[clamp(120px,15vw,220px)]',
                // 更小屏幕时的调整
                '[@media(max-width:640px)]:w-[clamp(100px,18vw,140px)]'
              )}
            >
              <ShortcutStackCard
                shortcut={shortcut}
                size="responsive"
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
