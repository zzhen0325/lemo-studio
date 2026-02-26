import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  DatasetImage,
  TranslateLang,
} from '@/components/features/dataset/collection-detail/types';
import {
  updateCollectionData,
  uploadCollectionFilesBatch,
} from '@/components/features/dataset/collection-detail/collection-detail.service';
import {
  IMAGE_EXTENSIONS,
  UPLOAD_BATCH_SIZE,
  UPLOAD_CONCURRENCY,
  chunkArray,
  mapWithConcurrency,
} from '@/components/features/dataset/collection-detail/collection-detail.utils';

type SetState<T> = Dispatch<SetStateAction<T>>;

type ToastFn = (options: {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => unknown;

interface ProcessUploadFilesParams {
  files: File[];
  collectionName: string;
  activePromptLang: TranslateLang;
  setIsProcessing: SetState<boolean>;
  setProgress: SetState<{ current: number; total: number } | null>;
  setImages: SetState<DatasetImage[]>;
  toast: ToastFn;
  fetchImages: () => Promise<void>;
  suppressSyncRef: MutableRefObject<boolean>;
  pendingSyncRefreshRef: MutableRefObject<boolean>;
}

export async function processCollectionUpload({
  files,
  collectionName,
  activePromptLang,
  setIsProcessing,
  setProgress,
  setImages,
  toast,
  fetchImages,
  suppressSyncRef,
  pendingSyncRefreshRef,
}: ProcessUploadFilesParams) {
  if (files.length === 0) return;

  setIsProcessing(true);
  setProgress({ current: 0, total: files.length });
  suppressSyncRef.current = true;
  pendingSyncRefreshRef.current = false;
  let refreshed = false;

  try {
    const imageFiles: File[] = [];
    const promptMap: Record<string, string> = {};
    const txtFiles = files.filter((file) => file.name.toLowerCase().endsWith('.txt'));

    await Promise.all(
      txtFiles.map(async (file) => {
        const text = await file.text();
        const baseName = file.name.replace(/\.txt$/i, '');
        promptMap[baseName] = text.trim();
      }),
    );

    files.forEach((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext && IMAGE_EXTENSIONS.has(ext)) {
        imageFiles.push(file);
      }
    });

    if (imageFiles.length === 0) {
      toast({
        title: 'No images found',
        description: 'Only .txt files were provided.',
        variant: 'destructive',
      });
      return;
    }

    const uploadedImages: DatasetImage[] = [];
    const promptUpdates: Record<string, string> = {};
    let successCount = 0;
    let processedCount = 0;
    setProgress({ current: 0, total: imageFiles.length });

    const uploadChunks = chunkArray(imageFiles, UPLOAD_BATCH_SIZE);
    await mapWithConcurrency(uploadChunks, UPLOAD_CONCURRENCY, async (chunkFiles) => {
      try {
        const chunkPromptMap: Record<string, string> = {};
        chunkFiles.forEach((file, index) => {
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const promptText = promptMap[baseName];
          if (promptText) {
            chunkPromptMap[`#${index}`] = promptText;
            chunkPromptMap[String(index)] = promptText;
            chunkPromptMap[baseName] = promptText;
            chunkPromptMap[file.name] = promptText;
          }
        });

        const res = await uploadCollectionFilesBatch(
          collectionName,
          chunkFiles,
          chunkPromptMap,
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          uploaded?: Array<{ filename: string; url: string; prompt?: string }>;
        };

        if (!res.ok) {
          throw new Error(data.error || `Upload failed (${res.status})`);
        }

        const uploaded = data.uploaded || [];
        successCount += uploaded.length;

        uploaded.forEach((item) => {
          const prompt = item.prompt || '';
          uploadedImages.push({
            id: item.filename,
            filename: item.filename,
            url: item.url,
            prompt,
            promptZh: activePromptLang === 'zh' ? prompt : '',
            promptEn: activePromptLang === 'en' ? prompt : '',
          });
          if (prompt) {
            promptUpdates[item.filename] = prompt;
          }
        });
      } catch (error) {
        console.error('Batch upload chunk failed', error);
      } finally {
        processedCount += chunkFiles.length;
        setProgress({
          current: Math.min(processedCount, imageFiles.length),
          total: imageFiles.length,
        });
      }
    });

    if (successCount === 0) {
      throw new Error('No files uploaded successfully');
    }

    if (Object.keys(promptUpdates).length > 0) {
      const persistRes = await updateCollectionData({
        collection: collectionName,
        prompts: promptUpdates,
        promptLang: activePromptLang,
      });
      if (!persistRes.ok) {
        throw new Error('Prompt association failed after upload');
      }
    }

    if (uploadedImages.length > 0) {
      setImages((prev) => [...prev, ...uploadedImages]);
    }

    await fetchImages();
    refreshed = true;
    toast({
      title: 'Upload complete',
      description: `Uploaded ${successCount}/${imageFiles.length} images with associated prompts.`,
    });
  } catch (error) {
    console.error('Upload failed', error);
    toast({ title: 'Upload failed', variant: 'destructive' });
  } finally {
    suppressSyncRef.current = false;
    if (!refreshed && pendingSyncRefreshRef.current) {
      await fetchImages();
    }
    pendingSyncRefreshRef.current = false;
    setIsProcessing(false);
    setProgress(null);
  }
}
