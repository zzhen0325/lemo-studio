'use client';

import React from 'react';

import { cn } from '@/lib/utils';
import { type MoodboardCard, type MoodboardCardEntry } from '@/config/moodboard-cards';
import { MoodboardStackCard } from './MoodboardStackCard';
import { MoodboardDetailDialog } from './MoodboardDetailDialog';
import {
  SMALL_STACK_MARQUEE_ITEM_CLASS,
  SMALL_STACK_MARQUEE_ROOT_CLASS,
  SMALL_STACK_MARQUEE_TRACK_CLASS,
} from './style-card-layout';

interface MoodboardMarqueeProps {
  className?: string;
  items: MoodboardCardEntry[];
  onQuickApply: (moodboardCard: MoodboardCard) => void;
  onPreviewImage?: (moodboardCard: MoodboardCard, imageIndex: number) => void;
  onMoodboardCardsChange?: () => Promise<void> | void;
  onShortcutsChange?: () => Promise<void> | void;
}

export const MoodboardMarquee: React.FC<MoodboardMarqueeProps> = ({
  className,
  items,
  onQuickApply,
  onPreviewImage,
  onMoodboardCardsChange,
  onShortcutsChange,
}) => {
  const [selectedMoodboardCard, setSelectedMoodboardCard] = React.useState<MoodboardCard | null>(null);
  const [isDetailOpen, setIsDetailOpen] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const duplicatedItems = React.useMemo(
    () => [...items, ...items, ...items],
    [items],
  );
  const handleMoodboardCardsChange = onMoodboardCardsChange ?? onShortcutsChange;

  const handleViewDetail = React.useCallback((moodboardCard: MoodboardCard) => {
    setSelectedMoodboardCard(moodboardCard);
    setIsDetailOpen(true);
  }, []);

  const handleQuickApply = React.useCallback((moodboardCard: MoodboardCard) => {
    setIsDetailOpen(false);
    onQuickApply(moodboardCard);
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
          {duplicatedItems.map(({ shortcut: moodboardCard, moodboard }, index) => (
            <div
              key={`${moodboardCard.id}-${moodboard.id}-${index}`}
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
                <MoodboardStackCard
                  shortcut={moodboardCard}
                  moodboard={moodboard}
                  size="sm"
                  onQuickApply={handleQuickApply}
                  onViewDetail={handleViewDetail}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <MoodboardDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        moodboard={selectedMoodboardCard ? items.find((item) => item.shortcut.id === selectedMoodboardCard.id)?.moodboard || null : null}
        shortcut={selectedMoodboardCard}
        onShortcutQuickApply={handleQuickApply}
        onShortcutPreviewImage={onPreviewImage}
        onShortcutsChange={handleMoodboardCardsChange}
      />
    </>
  );
};
