"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Download, Image as ImageIcon, ImageOff, RefreshCw, Type } from 'lucide-react';
import { AddToMoodboardMenu } from '@studio/playground/_components/AddToMoodboardMenu';
import { TooltipButton } from '@/components/ui/tooltip-button';
import type { GalleryActionHandlers, GalleryItemViewModel, GalleryMoodboardData } from '@/lib/gallery/types';
import { cn } from '@/lib/utils';

const loadedGalleryImageKeys = new Set<string>();
const GALLERY_IMAGE_SIZES =
  "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 15vw";
const BLUR_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

type GalleryImageLoadState = 'loading' | 'loaded' | 'error';

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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageState, setImageState] = useState<GalleryImageLoadState>(() => (
    loadedGalleryImageKeys.has(item.imageLoadKey) ? 'loaded' : (item.displayUrl ? 'loading' : 'error')
  ));
  const [thumbnailState, setThumbnailState] = useState<GalleryImageLoadState>(() => (
    item.thumbnailUrl ? 'loading' : 'error'
  ));

  useEffect(() => {
    setImageState(loadedGalleryImageKeys.has(item.imageLoadKey) ? 'loaded' : (item.displayUrl ? 'loading' : 'error'));
    setThumbnailState(item.thumbnailUrl ? 'loading' : 'error');
  }, [item.displayUrl, item.imageLoadKey, item.thumbnailUrl]);

  useEffect(() => {
    const currentImage = imageRef.current;
    if (!currentImage || imageState === 'loaded') {
      return;
    }

    if (currentImage.complete) {
      if (currentImage.naturalWidth > 0) {
        loadedGalleryImageKeys.add(item.imageLoadKey);
        setImageState('loaded');
      } else {
        setImageState('error');
      }
    }
  }, [imageState, item.imageLoadKey]);

  const handleImageLoaded = useCallback(() => {
    loadedGalleryImageKeys.add(item.imageLoadKey);
    setImageState('loaded');
  }, [item.imageLoadKey]);

  const handleImageError = useCallback(() => {
    setImageState('error');
  }, []);

  const handleThumbnailLoaded = useCallback(() => {
    setThumbnailState('loaded');
  }, []);

  const handleThumbnailError = useCallback(() => {
    setThumbnailState('error');
  }, []);

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

  const showPrimaryImage = item.raw.status !== 'pending' && Boolean(item.displayUrl) && imageState !== 'error';
  const showThumbnailFallback =
    item.raw.status !== 'pending'
    && imageState === 'error'
    && Boolean(item.thumbnailUrl)
    && thumbnailState !== 'error';
  const showVisiblePlaceholder =
    item.raw.status !== 'pending'
    && (
      imageState === 'loading'
      || (imageState === 'error' && Boolean(item.thumbnailUrl) && thumbnailState === 'loading')
    );
  const showErrorFallback =
    item.raw.status !== 'pending'
    && imageState === 'error'
    && (!item.thumbnailUrl || thumbnailState === 'error');

  return (
    <div
      data-testid={`gallery-card-${item.id}`}
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className="group relative flex w-full cursor-pointer flex-col overflow-hidden border-[0.8px] border-black bg-black/20 transition-all duration-300 hover:border-white/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
    >
      <div
        className="relative w-full bg-white/5"
        style={{ aspectRatio: item.width && item.height ? `${item.width} / ${item.height}` : '1 / 1' }}
      >
        {item.raw.status === 'pending' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 p-8">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            <span className="animate-pulse text-[10px] font-medium uppercase tracking-widest text-white/30">
              Generating
            </span>
          </div>
        ) : (
          <>
            {showVisiblePlaceholder ? (
              <div
                data-testid={`gallery-card-loading-${item.id}`}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/8 via-white/5 to-black/20 p-6 text-center"
              >
                <div className="h-10 w-10 animate-pulse rounded-full border border-white/10 bg-white/5" />
                <span className="text-[10px] font-medium uppercase tracking-widest text-white/35">
                  Loading preview
                </span>
              </div>
            ) : null}

            {showPrimaryImage ? (
              <Image
                ref={imageRef}
                src={item.displayUrl}
                alt="Generated masterwork"
                fill
                sizes={GALLERY_IMAGE_SIZES}
                quality={25}
                loading={imageState === 'loaded' ? 'eager' : 'lazy'}
                fetchPriority={imageState === 'loaded' ? 'auto' : 'low'}
                decoding={imageState === 'loaded' ? 'auto' : 'async'}
                placeholder={imageState === 'loaded' ? 'empty' : 'blur'}
                blurDataURL={imageState === 'loaded' ? undefined : BLUR_DATA_URL}
                unoptimized
                className={cn(
                  'object-cover transition-all duration-700 group-hover:scale-105',
                  imageState === 'loaded' ? 'opacity-100 blur-0' : 'opacity-0 blur-xl',
                )}
                onLoad={handleImageLoaded}
                onLoadingComplete={handleImageLoaded}
                onError={handleImageError}
              />
            ) : null}

            {showThumbnailFallback ? (
              <Image
                src={item.thumbnailUrl!}
                alt="Fallback preview"
                fill
                sizes={GALLERY_IMAGE_SIZES}
                quality={25}
                loading={thumbnailState === 'loaded' ? 'eager' : 'lazy'}
                fetchPriority={thumbnailState === 'loaded' ? 'auto' : 'low'}
                decoding={thumbnailState === 'loaded' ? 'auto' : 'async'}
                unoptimized
                className={cn(
                  'object-cover transition-all duration-500 group-hover:scale-105',
                  thumbnailState === 'loaded' ? 'opacity-100' : 'opacity-0',
                )}
                onLoad={handleThumbnailLoaded}
                onLoadingComplete={handleThumbnailLoaded}
                onError={handleThumbnailError}
              />
            ) : null}

            {showErrorFallback ? (
              <div
                data-testid={`gallery-card-error-${item.id}`}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-white/8 via-white/5 to-black/20 p-6 text-center"
              >
                <ImageOff className="h-8 w-8 text-white/25" />
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">
                  Preview unavailable
                </span>
              </div>
            ) : null}
          </>
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
