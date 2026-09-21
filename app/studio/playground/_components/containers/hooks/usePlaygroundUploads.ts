"use client";

import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useToast } from '@/hooks/common/use-toast';
import { getApiBase } from '@/lib/api-base';
import type { UploadedImage } from '@/lib/playground/types';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import type { PlaygroundTab } from '@/lib/store/playground-store.types';
import { upsertMoodboardAsShortcut } from '../../../_lib/moodboard-card-gallery';

interface UsePlaygroundUploadsArgs {
  activeTab: PlaygroundTab;
  getNextAutoMoodboardName: () => string;
  refreshMoodboardCards: () => Promise<unknown>;
}

export function usePlaygroundUploads({ activeTab, getNextAutoMoodboardName, refreshMoodboardCards }: UsePlaygroundUploadsArgs) {
  const { toast } = useToast();
  const setDescribeImages = usePlaygroundStore(s => s.setDescribeImages);
  const setUploadedImages = usePlaygroundStore(s => s.setUploadedImages);
  const updateDescribeImage = usePlaygroundStore(s => s.updateDescribeImage);
  const updateUploadedImage = usePlaygroundStore(s => s.updateUploadedImage);
  const updateHistorySourceUrl = usePlaygroundStore(s => s.updateHistorySourceUrl);
  const updateConfig = usePlaygroundStore(s => s.updateConfig);
  const syncLocalImageToHistory = usePlaygroundStore(s => s.syncLocalImageToHistory);

  const handleFilesUpload = React.useCallback(async (
    files: File[] | FileList,
    target: 'reference' | 'describe' = 'reference',
    options?: { waitForUpload?: boolean },
  ) => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    const setImages = target === 'describe' ? setDescribeImages : setUploadedImages;
    const updateImage = target === 'describe' ? updateDescribeImage : updateUploadedImage;

    for (const file of uploads) {
      const tempId = uuidv4(); // Use uuid for better ID management

      // 1. Generate local preview and base64 immediately
      const dataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.split(',')[1];

      // 2. Get image dimensions
      const dimensions: { width: number; height: number } = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.src = dataUrl;
      });


      // 4. Add to UI immediately (prepend to show on top)
      setImages((prev: UploadedImage[]) => [{
        id: tempId,
        localId: tempId,
        file,
        base64: base64Data,
        previewUrl: dataUrl,
        isUploading: true,
        width: dimensions.width,
        height: dimensions.height
      }, ...prev]);

      // 5. Update config for 'auto' mode if it's the first image in reference
      if (target === 'reference' && usePlaygroundStore.getState().config.aspectRatio === 'auto') {
        let { width, height } = dimensions;
        const minSide = Math.min(width, height);
        if (minSide < 1024) {
          const scale = 1024 / minSide;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        updateConfig({ width, height });
      }

      // 6. Start upload (optional wait for flows that need deterministic completion)
      const uploadTask = async (throwOnError: boolean) => {
        const form = new FormData();
        form.append('file', file);

        const originalUrl = dataUrl; // Keep track of the local URL

        try {
          const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: form });
          if (!resp.ok) {
            const errorText = await resp.text().catch(() => '');
            throw new Error(errorText || `Upload failed with status ${resp.status}`);
          }

          const json = await resp.json();
          const path = json?.path ? String(json.path) : undefined;
          const url = json?.url ? String(json.url) : undefined; // 预签名 URL

          // Update the specific image with its CDN path (storageKey) and preview URL (signed URL)
          updateImage(tempId, {
            path, // storageKey 用于持久化标识
            previewUrl: url || path, // 优先使用预签名 URL 显示，如果没有则使用 path
            isUploading: false
          });

          // Also update history records that were using this local URL or localId
          if (path) {
            updateHistorySourceUrl(originalUrl, url || path);
            await syncLocalImageToHistory(tempId, path);
          }
        } catch (err) {
          console.error("Upload failed in background", err);
          updateImage(tempId, { isUploading: false });
          if (throwOnError) {
            throw err;
          }
        }
      };

      if (options?.waitForUpload) {
        await uploadTask(true);
      } else {
        void uploadTask(false);
      }
    }
  }, [setDescribeImages, setUploadedImages, updateDescribeImage, updateUploadedImage, updateHistorySourceUrl, updateConfig, syncLocalImageToHistory]);
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (!files) return;
    // 默认通过 input 上传的归为参考图，除非有特殊逻辑
    await handleFilesUpload(files, activeTab === 'describe' ? 'describe' : 'reference');
  };
  const removeImage = React.useCallback((index: number) => { setUploadedImages(prev => prev.filter((_, i) => i !== index)); }, [setUploadedImages]);

  const handleStyleUpload = async (files: File[] | FileList) => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (uploads.length === 0) return;
    const autoMoodboardName = getNextAutoMoodboardName();

    toast({ title: "正在上传图片", description: `正在为新情绪板处理 ${uploads.length} 张图片...` });

    try {
      const uploadPromises = uploads.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: formData });
        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();
        return data.path;
      });

      const imagePaths = await Promise.all(uploadPromises);

      await upsertMoodboardAsShortcut({
        name: autoMoodboardName,
        prompt: '',
        imagePaths,
      });
      await refreshMoodboardCards();
      toast({ title: "情绪板创建成功", description: `已成功创建新情绪板并包含 ${uploads.length} 张图片` });
    } catch (error) {
      console.error("Failed to upload images for new style", error);
      toast({
        title: "创建失败",
        description: "上传图片过程中出现错误，请重试",
        variant: "destructive"
      });
    }
  };

  return { handleFilesUpload, handleImageUpload, removeImage, handleStyleUpload };
}
