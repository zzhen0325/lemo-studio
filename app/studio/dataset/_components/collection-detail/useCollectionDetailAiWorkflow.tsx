'use client';

import { useState } from 'react';
import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import type {
  DatasetImage,
  TranslateLang,
} from './types';
import {
  updateCollectionData,
} from './collection-detail.service';
import {
  chunkArray,
  fetchImageAsDataUrl,
  getPromptByLang,
  mapWithConcurrency,
  normalizePromptFields,
  OPTIMIZE_BATCH_SIZE,
  OPTIMIZE_CONCURRENCY,
  setPromptByLang,
  TRANSLATE_BATCH_SIZE,
  TRANSLATE_CONCURRENCY,
} from './collection-detail.utils';
import {
  generateDatasetLabelWithRetry,
  requestBatchTranslateWithRetry,
  requestDatasetLabel,
  type VisionCaller,
} from './collection-detail.ai';

type PendingTask = { type: 'generate_prompt' | 'translate'; lang?: TranslateLang } | null;

type SetState<T> = Dispatch<SetStateAction<T>>;

type ToastFn = (options: {
  id?: string | number;
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
  action?: ReactNode;
}) => string | number | undefined;

type DismissFn = (id?: string | number) => void;

interface UseCollectionDetailAiWorkflowParams {
  collectionName: string;
  images: DatasetImage[];
  selectedIds: Set<string>;
  isProcessing: boolean;
  systemPrompt: string;
  datasetLabelModelId: string;
  batchPrefix: string;
  callVision: VisionCaller;
  toast: ToastFn;
  dismiss: DismissFn;
  fetchImages: () => Promise<void>;
  getDisplayLangForImage: (id: string) => TranslateLang;
  activePromptLangRef: MutableRefObject<TranslateLang>;
  cancelRef: MutableRefObject<AbortController | null>;
  suppressSyncRef: MutableRefObject<boolean>;
  pendingSyncRefreshRef: MutableRefObject<boolean>;
  setImages: SetState<DatasetImage[]>;
  setDirtyIds: SetState<Set<string>>;
  setIsProcessing: SetState<boolean>;
  setProgress: SetState<{ current: number; total: number } | null>;
  setPromptDisplayLangById: SetState<Record<string, TranslateLang>>;
  setActivePromptLang: SetState<TranslateLang>;
  setIsAutoSavePaused: SetState<boolean>;
  handlePromptChange: (id: string, value: string, lang?: TranslateLang) => void;
}

export function useCollectionDetailAiWorkflow({
  collectionName,
  images,
  selectedIds,
  isProcessing,
  systemPrompt,
  datasetLabelModelId,
  batchPrefix,
  callVision,
  toast,
  dismiss,
  fetchImages,
  getDisplayLangForImage,
  activePromptLangRef,
  cancelRef,
  suppressSyncRef,
  pendingSyncRefreshRef,
  setImages,
  setDirtyIds,
  setIsProcessing,
  setProgress,
  setPromptDisplayLangById,
  setActivePromptLang,
  setIsAutoSavePaused,
  handlePromptChange,
}: UseCollectionDetailAiWorkflowParams) {
  const [pendingTask, setPendingTask] = useState<PendingTask>(null);
  const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);

  const startGeneratePrompts = async (specificTargets?: DatasetImage[]) => {
    const targets = specificTargets || images;
    if (targets.length === 0) {
      toast({ title: '无图片', description: '没有可自动生成 prompt 的图片。' });
      return;
    }

    const promptLang = activePromptLangRef.current;
    setIsProcessing(true);
    setProgress({ current: 0, total: targets.length });
    suppressSyncRef.current = true;
    pendingSyncRefreshRef.current = false;

    const controller = new AbortController();
    cancelRef.current = controller;

    const toastId = toast({
      title: '批量生成 Prompt 中...',
      description: `准备中: 0/${targets.length}`,
      duration: Infinity,
      action: (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs font-semibold hover:bg-destructive/10 hover:text-destructive"
          onClick={() => {
            controller.abort();
            dismiss(toastId);
          }}
        >
          Cancel
        </Button>
      ),
    });

    try {
      let success = 0;
      let processedCount = 0;
      let persistFailed = 0;

      const targetChunks = chunkArray(targets, OPTIMIZE_BATCH_SIZE);
      await mapWithConcurrency(targetChunks, OPTIMIZE_CONCURRENCY, async (chunkTargets) => {
        if (controller.signal.aborted) {
          return;
        }

        const chunkIds = new Set(chunkTargets.map((item) => item.id));
        setImages((prev) =>
          prev.map((item) =>
            chunkIds.has(item.id) ? { ...item, isOptimizing: true } : item,
          ),
        );

        const chunkPrompts: Record<string, string> = {};
        const chunkSucceededIds: string[] = [];
        let chunkProcessed = 0;

        for (const img of chunkTargets) {
          if (controller.signal.aborted) {
            break;
          }

          try {
            const newPrompt = await generateDatasetLabelWithRetry({
              img,
              signal: controller.signal,
              systemPrompt,
              modelId: datasetLabelModelId,
              callVision,
            });
            chunkPrompts[img.filename] = newPrompt;
            chunkSucceededIds.push(img.id);
            success += 1;
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
              break;
            }
            console.error('[dataset] prompt generation failed for image', img.filename, error);
          } finally {
            chunkProcessed += 1;
          }
        }

        if (!controller.signal.aborted && Object.keys(chunkPrompts).length > 0) {
          try {
            const persistRes = await updateCollectionData(
              {
                collection: collectionName,
                prompts: chunkPrompts,
                promptLang,
              },
              controller.signal,
            );

            if (!persistRes.ok) {
              persistFailed += Object.keys(chunkPrompts).length;
              const failedIds = new Set(chunkSucceededIds);
              setDirtyIds((prev) => {
                const next = new Set(prev);
                failedIds.forEach((id) => next.add(id));
                return next;
              });
            } else {
              const succeededIds = new Set(chunkSucceededIds);
              setDirtyIds((prev) => {
                const next = new Set(prev);
                succeededIds.forEach((id) => next.delete(id));
                return next;
              });
            }
          } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
              console.error('[dataset] generated prompt persist failed for chunk', error);
            }
            persistFailed += Object.keys(chunkPrompts).length;
            const failedIds = new Set(chunkSucceededIds);
            setDirtyIds((prev) => {
              const next = new Set(prev);
              failedIds.forEach((id) => next.add(id));
              return next;
            });
          }
        }

        const promptById = new Map(
          chunkTargets
            .filter((item) => chunkPrompts[item.filename])
            .map((item) => [item.id, chunkPrompts[item.filename]]),
        );

        setImages((prev) =>
          prev.map((item) => {
            if (!chunkIds.has(item.id)) return item;
            const nextPrompt = promptById.get(item.id);
            if (!nextPrompt) {
              return { ...item, isOptimizing: false };
            }
            const nextImage = setPromptByLang(
              item,
              promptLang,
              nextPrompt,
              activePromptLangRef.current,
            );
            return {
              ...nextImage,
              isOptimizing: false,
            };
          }),
        );

        processedCount += chunkProcessed;
        setProgress({
          current: Math.min(processedCount, targets.length),
          total: targets.length,
        });
        toast({
          id: toastId,
          title: '批量生成 Prompt 中...',
          description: `已处理 ${Math.min(processedCount, targets.length)}/${targets.length} 张...`,
          duration: Infinity,
        });
      });

      if (!controller.signal.aborted) {
        dismiss(toastId);
        toast({
          title: 'Prompt 生成完成',
          description:
            persistFailed > 0
              ? `成功生成 ${success}/${targets.length} 张，${persistFailed} 张保存失败（已标记待自动保存）。`
              : `成功生成 ${success}/${targets.length} 张图片的提示词。`,
        });
      } else {
        toast({
          title: '任务已取消',
          description: `已处理 ${success} 张后中止。`,
        });
      }
    } catch (error) {
      dismiss(toastId);
      toast({
        title: 'Prompt 生成失败',
        variant: 'destructive',
        description: error instanceof Error ? error.message : '发生未知错误，请重试。',
      });
    } finally {
      suppressSyncRef.current = false;
      if (pendingSyncRefreshRef.current) {
        pendingSyncRefreshRef.current = false;
        await fetchImages();
      }
      setIsProcessing(false);
      setProgress(null);
      cancelRef.current = null;
    }
  };

  const startBatchTranslate = async (
    targetLang: TranslateLang,
    specificTargets?: DatasetImage[],
  ) => {
    const baseTargets = specificTargets || images;
    if (baseTargets.length === 0) {
      toast({ title: 'No images', description: 'This collection is empty.' });
      return;
    }

    const sourceLang = activePromptLangRef.current;
    if (targetLang === sourceLang) {
      toast({
        title: '语言未变化',
        description: targetLang === 'zh' ? '当前已在中文版本。' : '当前已在英文版本。',
      });
      return;
    }

    setPromptDisplayLangById((prev) => {
      const next = { ...prev };
      baseTargets.forEach((img) => {
        next[img.id] = targetLang;
      });
      return next;
    });
    setActivePromptLang(targetLang);

    const targets = baseTargets.filter((img) => {
      const sourceText = getPromptByLang(img, sourceLang).trim();
      const existingTargetText = getPromptByLang(img, targetLang).trim();
      return sourceText.length > 0 && existingTargetText.length === 0;
    });

    if (targets.length === 0) {
      toast({
        title: '已切换语言',
        description:
          targetLang === 'zh'
            ? '当前图片已有中文文本，未重复翻译。'
            : '当前图片已有英文文本，未重复翻译。',
      });
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: targets.length });
    setIsAutoSavePaused(true);
    suppressSyncRef.current = true;
    pendingSyncRefreshRef.current = false;

    const controller = new AbortController();
    cancelRef.current = controller;

    let successCount = 0;
    let processedCount = 0;
    const translatedPromptMap: Record<string, string> = {};
    const translatedIds = new Set<string>();

    try {
      const targetChunks = chunkArray(targets, TRANSLATE_BATCH_SIZE);
      await mapWithConcurrency(targetChunks, TRANSLATE_CONCURRENCY, async (chunkTargets) => {
        if (controller.signal.aborted) {
          processedCount += chunkTargets.length;
          setProgress({
            current: Math.min(processedCount, targets.length),
            total: targets.length,
          });
          return;
        }

        const chunkIds = new Set(chunkTargets.map((item) => item.id));
        setImages((prev) =>
          prev.map((img) =>
            chunkIds.has(img.id) ? { ...img, isTranslating: true } : img,
          ),
        );

        try {
          const sourceTexts = chunkTargets.map((item) =>
            getPromptByLang(item, sourceLang),
          );
          const translatedTexts = await requestBatchTranslateWithRetry(
            sourceTexts,
            targetLang,
            controller.signal,
          );
          const translatedById = new Map<string, string>();

          chunkTargets.forEach((item, index) => {
            const fallbackText = getPromptByLang(item, sourceLang);
            const translatedText =
              (translatedTexts[index] || fallbackText).trim() || fallbackText;
            translatedById.set(item.id, translatedText);
            translatedPromptMap[item.filename] = translatedText;
            translatedIds.add(item.id);
            successCount += 1;
          });

          setImages((prev) =>
            prev.map((img) => {
              if (!translatedById.has(img.id)) return img;
              const nextPrompt = translatedById.get(img.id) || '';
              const nextImage = setPromptByLang(
                img,
                targetLang,
                nextPrompt,
                targetLang,
              );
              return {
                ...nextImage,
                isTranslating: false,
              };
            }),
          );
        } catch (error: unknown) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            return;
          }
          console.error('Failed to translate chunk', error);
        } finally {
          setImages((prev) =>
            prev.map((img) =>
              chunkIds.has(img.id) ? { ...img, isTranslating: false } : img,
            ),
          );
          processedCount += chunkTargets.length;
          setProgress({
            current: Math.min(processedCount, targets.length),
            total: targets.length,
          });
        }
      });

      if (Object.keys(translatedPromptMap).length > 0) {
        const persistRes = await updateCollectionData({
          collection: collectionName,
          prompts: translatedPromptMap,
          promptLang: targetLang,
        });

        if (!persistRes.ok) {
          throw new Error('Failed to persist translated prompts');
        }

        setDirtyIds((prev) => {
          const next = new Set(prev);
          translatedIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (!controller.signal.aborted) {
        toast({
          title: '批量翻译完成',
          description: `成功翻译 ${successCount}/${targets.length} 条提示词。`,
        });
      } else {
        toast({
          title: '翻译已取消',
          description: `已处理 ${successCount} 条后中止。`,
        });
      }
    } catch (error) {
      if (translatedIds.size > 0) {
        setDirtyIds((prev) => {
          const next = new Set(prev);
          translatedIds.forEach((id) => next.add(id));
          return next;
        });
      }
      console.error('Batch translation failed', error);
      toast({
        title: '批量翻译失败',
        variant: 'destructive',
      });
    } finally {
      suppressSyncRef.current = false;
      if (pendingSyncRefreshRef.current) {
        pendingSyncRefreshRef.current = false;
        await fetchImages();
      }
      setIsAutoSavePaused(false);
      setIsProcessing(false);
      setProgress(null);
      cancelRef.current = null;
    }
  };

  const handleGenerateAllPrompts = async () => {
    if (isProcessing) {
      setPendingTask({ type: 'generate_prompt' });
      setIsConflictDialogOpen(true);
      return;
    }
    startGeneratePrompts();
  };

  const handleGenerateSelectedPrompts = async () => {
    if (selectedIds.size === 0) return;
    if (isProcessing) {
      setPendingTask({ type: 'generate_prompt' });
      setIsConflictDialogOpen(true);
      return;
    }
    const targets = images.filter((img) => selectedIds.has(img.id));
    startGeneratePrompts(targets);
  };

  const handleGeneratePrompt = async (img: DatasetImage) => {
    setImages((prev) =>
      prev.map((item) => (item.id === img.id ? { ...item, isOptimizing: true } : item)),
    );

    try {
      const base64 = await fetchImageAsDataUrl(img.url);
      const optimizedText = await requestDatasetLabel({
        imageBase64: base64,
        systemPrompt,
        modelId: datasetLabelModelId,
        callVision,
      });

      let nextPrompt = optimizedText;
      if (batchPrefix?.trim()) {
        const prefix = batchPrefix.trim();
        if (!nextPrompt.toLowerCase().startsWith(prefix.toLowerCase())) {
          nextPrompt = `${prefix}, ${nextPrompt}`;
        }
      }

      handlePromptChange(img.id, nextPrompt);
      toast({
        title: 'Prompt 生成成功',
        description: 'AI 已为这张图片生成 prompt。',
      });
    } catch (error) {
      console.error(error);
      toast({
        title: 'Prompt 生成失败',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setImages((prev) =>
        prev.map((item) =>
          item.id === img.id ? { ...item, isOptimizing: false } : item,
        ),
      );
    }
  };

  const handlePromptLangSwitch = async (targetLang: TranslateLang) => {
    const sourceLang = activePromptLangRef.current;
    if (targetLang === sourceLang) return;

    if (isProcessing) {
      setPendingTask({ type: 'translate', lang: targetLang });
      setIsConflictDialogOpen(true);
      return;
    }

    const scopeTargets = images;

    if (scopeTargets.length === 0) {
      setActivePromptLang(targetLang);
      return;
    }

    setPromptDisplayLangById(() => {
      const next: Record<string, TranslateLang> = {};
      scopeTargets.forEach((img) => {
        next[img.id] = targetLang;
      });
      return next;
    });
    setActivePromptLang(targetLang);

    const hasSourcePrompt = scopeTargets.some(
      (img) => getPromptByLang(img, sourceLang).trim().length > 0,
    );
    if (!hasSourcePrompt) {
      toast({
        title: '已切换语言',
        description:
          targetLang === 'zh'
            ? '当前没有可翻译的英文内容。'
            : '当前没有可翻译的中文内容。',
      });
      return;
    }

    startBatchTranslate(targetLang, scopeTargets);
  };

  const handleImagePromptLangSwitch = async (
    img: DatasetImage,
    targetLang: TranslateLang,
  ) => {
    const sourceLang = getDisplayLangForImage(img.id);
    if (targetLang === sourceLang) return;
    if (img.isOptimizing || img.isTranslating) return;

    const sourceText = getPromptByLang(img, sourceLang).trim();
    const targetText = getPromptByLang(img, targetLang).trim();

    setPromptDisplayLangById((prev) => ({ ...prev, [img.id]: targetLang }));

    if (targetText) {
      setImages((prev) =>
        prev.map((item) =>
          item.id === img.id ? normalizePromptFields(item, targetLang) : item,
        ),
      );
      return;
    }

    if (!sourceText) {
      setImages((prev) =>
        prev.map((item) =>
          item.id === img.id ? normalizePromptFields(item, targetLang) : item,
        ),
      );
      toast({
        title: '已切换语言',
        description:
          targetLang === 'zh'
            ? '当前图片没有可翻译的英文内容。'
            : '当前图片没有可翻译的中文内容。',
      });
      return;
    }

    setImages((prev) =>
      prev.map((item) =>
        item.id === img.id ? { ...item, isTranslating: true } : item,
      ),
    );

    const controller = new AbortController();
    try {
      const translatedTexts = await requestBatchTranslateWithRetry(
        [sourceText],
        targetLang,
        controller.signal,
      );
      const translatedText = (translatedTexts[0] || sourceText).trim() || sourceText;

      setImages((prev) =>
        prev.map((item) => {
          if (item.id !== img.id) return item;
          const next = setPromptByLang(item, targetLang, translatedText, targetLang);
          return {
            ...next,
            isTranslating: false,
          };
        }),
      );

      const persistRes = await updateCollectionData({
        collection: collectionName,
        prompts: { [img.filename]: translatedText },
        promptLang: targetLang,
      });
      if (!persistRes.ok) {
        throw new Error('Failed to persist translated prompt');
      }

      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.delete(img.id);
        return next;
      });
    } catch (error) {
      console.error('Single translation failed', error);
      setPromptDisplayLangById((prev) => ({ ...prev, [img.id]: sourceLang }));
      setImages((prev) =>
        prev.map((item) =>
          item.id === img.id
            ? { ...normalizePromptFields(item, sourceLang), isTranslating: false }
            : item,
        ),
      );
      toast({
        title: '翻译失败',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleKeepCurrentTask = () => {
    setIsConflictDialogOpen(false);
    setPendingTask(null);
  };

  const handleInterruptAndStartPendingTask = () => {
    setIsConflictDialogOpen(false);
    cancelRef.current?.abort();

    setTimeout(() => {
      if (pendingTask?.type === 'generate_prompt') {
        void startGeneratePrompts();
      } else if (pendingTask?.type === 'translate' && pendingTask.lang) {
        void startBatchTranslate(pendingTask.lang);
      }
      setPendingTask(null);
    }, 100);
  };

  return {
    isConflictDialogOpen,
    setIsConflictDialogOpen,
    handleGenerateAllPrompts,
    handleGenerateSelectedPrompts,
    handleGeneratePrompt,
    handlePromptLangSwitch,
    handleImagePromptLangSwitch,
    handleKeepCurrentTask,
    handleInterruptAndStartPendingTask,
  };
}
