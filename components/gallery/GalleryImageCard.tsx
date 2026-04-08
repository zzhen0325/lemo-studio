"use client";

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Download, Image as ImageIcon, RefreshCw, Type } from 'lucide-react';
import { AddToMoodboardMenu } from '@studio/playground/_components/AddToMoodboardMenu';
import { TooltipButton } from '@/components/ui/tooltip-button';
import type { GalleryActionHandlers, GalleryItemViewModel, GalleryMoodboardData } from '@/lib/gallery/types';
import { cn } from '@/lib/utils';

const loadedGalleryImageKeys = new Set<string>();

export function clearGalleryImageLoadCacheForTests() {
  loadedGalleryImageKeys.clear();
}

interface GalleryImageCardProps {
  item: GalleryItemViewModel;
  actions: GalleryActionHandlers;
  allItems?: import('@/types/database').Generation[];
  moodboardData: GalleryMoodboardData;
}

export function GalleryImageCard({
  item,
  actions,
  allItems,
  moodboardData,
}: GalleryImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(() => loadedGalleryImageKeys.has(item.imageLoadKey));

  useEffect(() => {
    setIsLoaded(loadedGalleryImageKeys.has(item.imageLoadKey));
  }, [item.imageLoadKey]);

  const handleImageLoaded = useCallback(() => {
    loadedGalleryImageKeys.add(item.imageLoadKey);
    setIsLoaded(true);
  }, [item.imageLoadKey]);

  const handleSelect = useCallback(() => {
    if (item.raw.status === 'pending') {
      return;
    }
    actions.onSelectItem?.(item.raw, allItems);
  }, [actions, allItems, item.raw]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    handleSelect();
  }, [handleSelect]);

  return (
    <div
      data-testid={`gallery-card-${item.id}`}
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className="group relative flex cursor-pointer flex-col overflow-hidden border-[0.8px] border-black bg-black/20 transition-all duration-300 hover:border-white/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      <div className="relative flex w-full items-center justify-center bg-white/5">
        {item.raw.status === 'pending' ? (
          <div className="flex w-full flex-col items-center justify-center space-y-3 p-8">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <span className="animate-pulse text-[10px] font-medium uppercase tracking-widest text-white/30">
              Generating
            </span>
          </div>
        ) : (
          <Image
            src={item.displayUrl}
            alt="Generated masterwork"
            width={item.width}
            height={item.height}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 15vw"
            quality={25}
            loading="lazy"
            fetchPriority="low"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            unoptimized
            className={cn(
              'h-auto w-full object-cover transition-all duration-700 group-hover:scale-105',
              isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-xl',
            )}
            onLoad={handleImageLoaded}
          />
        )}

        {item.sourceImageUrl ? (
          <div className="absolute left-3 top-3 z-10 h-12 w-12 overflow-hidden rounded-lg border border-white shadow-2xl opacity-0 transition-all duration-300 group-focus-within:opacity-100 group-focus-within:scale-110 group-hover:scale-110 group-hover:opacity-100">
            <Image
              src={item.sourceImageUrl}
              alt="Reference image"
              fill
              className="object-cover"
              sizes="48px"
              unoptimized
            />
          </div>
        ) : null}

        <div
          className="absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-24px)] shrink-0 -translate-x-1/2 items-center gap-1 overflow-hidden rounded-xl border border-white/10 bg-black/50 shadow-2xl opacity-0 backdrop-blur-xl transition-all duration-150 group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100"
          onClick={(event) => event.stopPropagation()}
        >
          <AddToMoodboardMenu
            imagePath={item.moodboardImagePath}
            tooltipWithProvider={false}
            moodboardsData={moodboardData.moodboards}
            moodboardCardsData={moodboardData.moodboardCards}
            onRefreshMoodboardCards={async () => {
              await moodboardData.refreshMoodboardCards();
              actions.onAddToMoodboard?.(item.raw);
            }}
          />

          <TooltipButton
            icon={<Type className="h-4 w-4" />}
            label="Use Prompt"
            tooltipContent="Use Prompt"
            tooltipSide="top"
            withProvider={false}
            className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => actions.onUsePrompt(item.raw)}
          />
          <TooltipButton
            icon={<ImageIcon className="h-4 w-4" />}
            label="Use Image"
            tooltipContent="Use Image"
            tooltipSide="top"
            withProvider={false}
            className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => void actions.onUseImage(item.raw)}
          />
          <TooltipButton
            icon={<RefreshCw className="h-4 w-4" />}
            label="Rerun"
            tooltipContent="Rerun"
            tooltipSide="top"
            withProvider={false}
            className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => void actions.onRerun(item.raw)}
          />
          <TooltipButton
            icon={<Download className="h-4 w-4" />}
            label="Download"
            tooltipContent="Download"
            tooltipSide="top"
            withProvider={false}
            className="h-8 w-8 rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
            onClick={() => actions.onDownload(item.raw, item.downloadUrl)}
          />
        </div>
      </div>
    </div>
  );
}
