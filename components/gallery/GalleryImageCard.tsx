"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Download, Image as ImageIcon, ImageOff, RefreshCw, Type } from 'lucide-react';
import { usePathname } from 'next/navigation';
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
  renderMode?: 'default' | 'virtualized';
}

export function GalleryImageCard({
  item,
  actions,
  allItems,
  moodboardData,
  renderMode = 'default',
}: GalleryImageCardProps) {
  const pathname = usePathname();
  const disableLocalFixtureImageMotion = pathname === '/studio/gallery/local';
  const useLightweightImageRendering = renderMode === 'virtualized' || disableLocalFixtureImageMotion;
  const imageCandidates = useMemo(() => {
    const candidates = [
      useLightweightImageRendering ? (item.previewUrl || item.displayUrl) : item.displayUrl,
      useLightweightImageRendering && item.previewUrl && item.previewUrl !== item.displayUrl
        ? item.displayUrl
        : undefined,
      item.thumbnailUrl,
    ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0);

    return candidates.filter((url, index) => candidates.indexOf(url) === index);
  }, [item.displayUrl, item.previewUrl, item.thumbnailUrl, useLightweightImageRendering]);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(() => (imageCandidates.length > 0 ? 0 : -1));
  const activeImageUrl = activeImageIndex >= 0 ? imageCandidates[activeImageIndex] : '';
  const [imageState, setImageState] = useState<GalleryImageLoadState>(() => (
    activeImageUrl ? (loadedGalleryImageKeys.has(activeImageUrl) ? 'loaded' : 'loading') : 'error'
  ));
  const primaryImagePlaceholder = useLightweightImageRendering || imageState === 'loaded' ? 'empty' : 'blur';

  useEffect(() => {
    const nextImageUrl = imageCandidates[0];
    setActiveImageIndex(nextImageUrl ? 0 : -1);
    setImageState(nextImageUrl ? (loadedGalleryImageKeys.has(nextImageUrl) ? 'loaded' : 'loading') : 'error');
  }, [imageCandidates]);

  const moveToNextImageCandidate = useCallback(() => {
    const nextIndex = activeImageIndex + 1;
    if (nextIndex >= imageCandidates.length) {
      setImageState('error');
      return;
    }

    const nextImageUrl = imageCandidates[nextIndex];
    setActiveImageIndex(nextIndex);
    setImageState(loadedGalleryImageKeys.has(nextImageUrl) ? 'loaded' : 'loading');
  }, [activeImageIndex, imageCandidates]);

  useEffect(() => {
    const currentImage = imageRef.current;
    if (!currentImage || !activeImageUrl || imageState !== 'loading') {
      return;
    }

    if (currentImage.complete) {
      if (currentImage.naturalWidth > 0) {
        loadedGalleryImageKeys.add(activeImageUrl);
        setImageState('loaded');
      } else {
        moveToNextImageCandidate();
      }
    }
  }, [activeImageUrl, imageState, moveToNextImageCandidate]);

  const handleImageLoaded = useCallback(() => {
    if (!activeImageUrl) {
      return;
    }

    loadedGalleryImageKeys.add(activeImageUrl);
    setImageState('loaded');
  }, [activeImageUrl]);

  const handleImageError = useCallback(() => {
    moveToNextImageCandidate();
  }, [moveToNextImageCandidate]);

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

  const showPrimaryImage = item.raw.status !== 'pending' && Boolean(activeImageUrl) && imageState !== 'error';
  const showVisiblePlaceholder =
    !useLightweightImageRendering
    && item.raw.status !== 'pending'
    && imageState === 'loading';
  const showErrorFallback =
    item.raw.status !== 'pending'
    && imageState === 'error';

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
              useLightweightImageRendering ? (
                <img
                  ref={imageRef}
                  src={activeImageUrl}
                  alt="Generated masterwork"
                  loading={imageState === 'loaded' ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-150 ease-out group-hover:scale-105"
                  onLoad={handleImageLoaded}
                  onError={handleImageError}
                />
              ) : (
                <Image
                  ref={imageRef}
                  src={activeImageUrl}
                  alt="Generated masterwork"
                  fill
                  sizes={GALLERY_IMAGE_SIZES}
                  quality={25}
                  loading={imageState === 'loaded' ? 'eager' : 'lazy'}
                  fetchPriority={imageState === 'loaded' ? 'auto' : 'low'}
                  decoding={imageState === 'loaded' ? 'auto' : 'async'}
                  placeholder={primaryImagePlaceholder}
                  blurDataURL={primaryImagePlaceholder === 'blur' ? BLUR_DATA_URL : undefined}
                  unoptimized
                  className={cn(
                    'object-cover group-hover:scale-105',
                    'transition-all duration-700',
                    imageState === 'loaded' ? 'opacity-100 blur-0' : 'opacity-0 blur-xl',
                  )}
                  onLoad={handleImageLoaded}
                  onLoadingComplete={handleImageLoaded}
                  onError={handleImageError}
                />
              )
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
