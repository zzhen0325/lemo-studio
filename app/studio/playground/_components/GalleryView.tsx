"use client";

import { useCallback, useState } from 'react';
import { GalleryScene } from '@/components/gallery/GalleryScene';
import { useGalleryFeed } from '@/lib/gallery/use-gallery-feed';
import type { SortBy } from '@/lib/server/service/history.service';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import type { Generation, GenerationConfig } from '@/types/database';
import { useToast } from '@/hooks/common/use-toast';
import { useGenerationService } from '@studio/playground/_components/hooks/useGenerationService';
import type { PlaygroundHistoryController } from '@studio/playground/_components/hooks/useHistory';
import { usePlaygroundMoodboards } from '@studio/playground/_components/hooks/usePlaygroundMoodboards';

export default function GalleryView({
  isActive = true,
  onSelectItem,
  onUsePrompt,
  onUseImage,
  onRerun,
  historyController,
}: {
  isActive?: boolean;
  onSelectItem?: (item: Generation, items?: Generation[]) => void;
  onUsePrompt?: (item: Generation) => void;
  onUseImage?: (item: Generation) => void | Promise<void>;
  onRerun?: (item: Generation) => Promise<void>;
  historyController?: Pick<PlaygroundHistoryController, 'setHistory' | 'getHistoryItem'>;
}) {
  const [sortBy, setSortBy] = useState<Exclude<SortBy, 'interactionPriority'>>('recent');
  const feed = useGalleryFeed({ sortBy, isActive });
  const { toast } = useToast();
  const { handleGenerate } = useGenerationService(historyController);
  const moodboardData = usePlaygroundMoodboards();

  const handlePromptApply = useCallback((item: Generation) => {
    if (!item.config?.prompt) {
      return;
    }

    if (onUsePrompt) {
      onUsePrompt(item);
    } else {
      usePlaygroundStore.getState().applyPrompt(item.config.prompt);
    }

    toast({
      title: 'Prompt Applied',
      description: '提示词已应用到输入框',
    });
  }, [onUsePrompt, toast]);

  const handleImageApply = useCallback(async (item: Generation) => {
    if (!item.outputUrl) {
      return;
    }

    if (onUseImage) {
      await onUseImage(item);
    } else {
      await usePlaygroundStore.getState().applyImage(item.outputUrl);
    }

    toast({
      title: 'Image Added',
      description: '图片已添加为参考图',
    });
  }, [onUseImage, toast]);

  const handleDownload = useCallback((item: Generation, downloadUrl: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${item.id || `img_${new Date(item.createdAt).getTime()}`}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleRerun = useCallback(async (item: Generation) => {
    if (!item.config) {
      return;
    }

    if (onRerun) {
      await onRerun(item);
      return;
    }

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
    await handleGenerate({ configOverride: fullConfig });

    toast({
      title: 'Rerunning',
      description: '正在根据此图片重新生成...',
    });
  }, [handleGenerate, onRerun, toast]);

  return (
    <GalleryScene
      feed={feed}
      isActive={isActive}
      sortBy={sortBy}
      onSortByChange={setSortBy}
      moodboardData={moodboardData}
      actions={{
        onSelectItem,
        onUsePrompt: handlePromptApply,
        onUseImage: handleImageApply,
        onRerun: handleRerun,
        onDownload: handleDownload,
      }}
    />
  );
}
