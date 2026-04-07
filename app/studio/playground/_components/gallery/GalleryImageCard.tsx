"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Download, Image as ImageIcon, RefreshCw, Type } from 'lucide-react';

import { AddToMoodboardMenu } from '@studio/playground/_components/AddToMoodboardMenu';
import type { GenerateOptions } from '@studio/playground/_components/hooks/useGenerationService';
import { TooltipButton } from '@/components/ui/tooltip-button';
import { useToast } from '@/hooks/common/use-toast';
import { resolveGalleryImageUrl } from '@/lib/gallery-asset';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { cn } from '@/lib/utils';
import type { MoodboardCard } from '@/config/moodboard-cards';
import type { Generation, GenerationConfig, StyleStack } from '@/types/database';

const loadedGalleryImageKeys = new Set<string>();

export function clearGalleryImageLoadCacheForTests() {
  loadedGalleryImageKeys.clear();
}

interface GalleryImageCardProps {
  item: Generation;
  imageLoadKey: string;
  onSelectItem?: (item: Generation, items?: Generation[]) => void;
  onDownload: (event: React.MouseEvent, url: string, filename: string) => void;
  onGenerate: (options?: GenerateOptions) => Promise<unknown>;
  onUsePrompt?: (item: Generation) => void;
  onUseImage?: (item: Generation) => void | Promise<void>;
  moodboards: StyleStack[];
  moodboardCards: MoodboardCard[];
  refreshMoodboardCards: () => Promise<void>;
}

export const GalleryImageCard = React.memo(function GalleryImageCard({
  item,
  imageLoadKey,
  onSelectItem,
  onDownload,
  onGenerate,
  onUsePrompt,
  onUseImage,
  moodboards,
  moodboardCards,
  refreshMoodboardCards,
}: GalleryImageCardProps) {
  const [isHover, setIsHover] = useState(false);
  const [isLoaded, setIsLoaded] = useState(() => loadedGalleryImageKeys.has(imageLoadKey));
  const { toast } = useToast();

  useEffect(() => {
    setIsLoaded(loadedGalleryImageKeys.has(imageLoadKey));
  }, [imageLoadKey]);

  const sourceUrls = item.config?.sourceImageUrls || [];
  const firstSourceUrl = sourceUrls[0];
  const sourceImage = useMemo(
    () => (firstSourceUrl ? resolveGalleryImageUrl(firstSourceUrl) : undefined),
    [firstSourceUrl],
  );
  const mainImageUrl = useMemo(
    () => (item.outputUrl ? resolveGalleryImageUrl(item.outputUrl) : ''),
    [item.outputUrl],
  );

  const handleCardClick = useCallback(() => {
    onSelectItem?.(item);
  }, [item, onSelectItem]);

  const handleImageLoaded = useCallback(() => {
    loadedGalleryImageKeys.add(imageLoadKey);
    setIsLoaded(true);
  }, [imageLoadKey]);

  const performDownload = useCallback(() => {
    if (!item.outputUrl) return;
    const fakeEvent = { stopPropagation: () => void 0 } as unknown as React.MouseEvent;
    onDownload(fakeEvent, item.outputUrl, item.id || `img_${new Date(item.createdAt).getTime()}`);
  }, [item.createdAt, item.id, item.outputUrl, onDownload]);

  return (
    <div
      data-testid={`gallery-card-${item.id || imageLoadKey}`}
      className="group relative flex flex-col bg-black/20 border-[0.8px] border-black overflow-hidden hover:border-white/20 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer translate-z-0"
      onClick={handleCardClick}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <div className="relative w-full flex items-center justify-center bg-white/5">
        {item.status === 'pending' ? (
          <div className="w-full flex flex-col items-center justify-center p-8 space-y-3">
            <div className="w-9 h-9 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
            <span className="text-[10px] text-white/30 font-medium uppercase tracking-widest animate-pulse">
              Generating
            </span>
          </div>
        ) : (
          <Image
            src={mainImageUrl}
            alt="Generated masterwork"
            width={item.config?.width || 1024}
            height={item.config?.height || 1024}
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 15vw"
            quality={25}
            loading="lazy"
            fetchPriority="low"
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            unoptimized
            className={cn(
              'w-full h-auto object-cover transition-all duration-700 group-hover:scale-105',
              isLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-xl',
            )}
            onLoad={handleImageLoaded}
          />
        )}

        {sourceImage ? (
          <div className="absolute top-3 left-3 z-10 w-12 h-12 rounded-lg border border-white overflow-hidden shadow-2xl transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:scale-110">
            <Image
              src={sourceImage}
              alt="Reference image"
              fill
              className="object-cover"
              sizes="48px"
              unoptimized
            />
          </div>
        ) : null}

        {isHover ? (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex shrink-0 items-center gap-1 max-w-[calc(100%-24px)] overflow-hidden bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl transition-all duration-50 opacity-100 translate-y-0 scale-100"
            onClick={(event) => event.stopPropagation()}
          >
            <AddToMoodboardMenu
              imagePath={item.outputUrl}
              tooltipWithProvider={false}
              moodboardsData={moodboards}
              moodboardCardsData={moodboardCards}
              onRefreshMoodboardCards={refreshMoodboardCards}
            />

            <TooltipButton
              icon={<Type className="w-4 h-4" />}
              label="Use Prompt"
              tooltipContent="Use Prompt"
              tooltipSide="top"
              withProvider={false}
              className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => {
                if (!item.config?.prompt) return;
                if (onUsePrompt) {
                  onUsePrompt(item);
                } else {
                  usePlaygroundStore.getState().applyPrompt(item.config.prompt);
                }
                toast({ title: 'Prompt Applied', description: '提示词已应用到输入框' });
              }}
            />
            <TooltipButton
              icon={<ImageIcon className="w-4 h-4" />}
              label="Use Image"
              tooltipContent="Use Image"
              tooltipSide="top"
              withProvider={false}
              className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => {
                if (!item.outputUrl) return;
                if (onUseImage) {
                  void onUseImage(item);
                } else {
                  usePlaygroundStore.getState().applyImage(item.outputUrl);
                }
                toast({ title: 'Image Added', description: '图片已添加为参考图' });
              }}
            />

            <TooltipButton
              icon={<RefreshCw className="w-4 h-4" />}
              label="Rerun"
              tooltipContent="Rerun"
              tooltipSide="top"
              withProvider={false}
              className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
              onClick={async () => {
                if (!item.config) return;

                const store = usePlaygroundStore.getState();
                const {
                  applyImages,
                  setUploadedImages,
                  applyModel,
                  applyPrompt,
                  setSelectedPresetName,
                  setViewMode,
                  setActiveTab,
                  config: currentConfig,
                } = store;

                const currentSourceUrls = item.config?.sourceImageUrls || [];
                if (currentSourceUrls.length > 0) {
                  await applyImages(currentSourceUrls);
                } else {
                  setUploadedImages([]);
                }

                const recordConfig: GenerationConfig = {
                  ...item.config,
                  taskId: undefined,
                };

                const fullConfig: GenerationConfig = {
                  ...currentConfig,
                  ...recordConfig,
                  prompt: recordConfig.prompt || '',
                  width: recordConfig.width || currentConfig.width,
                  height: recordConfig.height || currentConfig.height,
                  model: recordConfig.model || currentConfig.model,
                  isEdit: recordConfig.isEdit,
                  editConfig: recordConfig.editConfig,
                  parentId: recordConfig.parentId,
                  sourceImageUrls: currentSourceUrls,
                  taskId: undefined,
                };

                applyModel(fullConfig.model, fullConfig);
                applyPrompt(fullConfig.prompt);
                setSelectedPresetName(recordConfig.presetName);
                setViewMode('dock');
                setActiveTab('history');
                await onGenerate({ configOverride: fullConfig });

                toast({ title: 'Rerunning', description: '正在根据此图片重新生成...' });
              }}
            />
            <TooltipButton
              icon={<Download className="w-4 h-4" />}
              label="Download"
              tooltipContent="Download"
              tooltipSide="top"
              withProvider={false}
              className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
              onClick={performDownload}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
});

GalleryImageCard.displayName = 'GalleryImageCard';
