"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Crop, Eraser, MousePointer2, Pencil, Square } from 'lucide-react';
import { useToast } from '@/hooks/common/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ImageEditConfirmPayload,
  ImageEditDialogProps,
  ImageEditorSessionSnapshot,
  ImageEditorTool,
} from './types';
import { ImageEditCanvasPane } from './ImageEditCanvasPane';
import { ImageEditToolbar } from './ImageEditToolbar';
import { buildImageEditPrompt } from './utils/build-image-edit-prompt';
import ImageEditPromptEditor from './ImageEditPromptEditor';
import { migrateTldrawSnapshot } from './utils/migrate-tldraw-snapshot';
import { useFabricImageEditor } from './hooks/use-fabric-image-editor';
import { useAPIConfigStore } from '@/lib/store/api-config-store';
import { getContextModelOptions } from '@/lib/model-center-ui';
import { normalizeImageSizeToken } from '@/lib/model-center';
import {
  DEFAULT_INFINITE_CANVAS_MODEL_ID,
  INFINITE_CANVAS_MODELS,
  INFINITE_IMAGE_SIZES,
} from '@/app/infinite-canvas/_lib/constants';
import {
  mergePromptWithAnnotationDescriptions,
} from './utils/image-edit-prompt-tokens';
import {
  getClipboardImageFile,
  getFirstImageFile,
  isImageFile,
} from './utils/image-input';

const TOOL_ITEMS: Array<{ id: ImageEditorTool; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'select', label: '选择', icon: MousePointer2 },
  { id: 'annotate', label: '标注', icon: Square },
  { id: 'brush', label: '画笔', icon: Pencil },
  { id: 'eraser', label: '橡皮擦', icon: Eraser },
  // { id: 'crop', label: '裁剪', icon: Crop },
];

const PLAYGROUND_IMAGE_SIZE_OPTIONS = ['1K', '2K', '4K'] as const;
const PLAYGROUND_FALLBACK_MODEL_ID = 'gemini-3-pro-image-preview';
const INFINITE_IMAGE_SIZE_ASPECT_RATIO_MAP: Record<string, string> = {
  '1024x1024': '1:1',
  '896x1152': '3:4',
  '1152x896': '4:3',
  '768x1344': '9:16',
  '1344x768': '16:9',
};

export default function ImageEditDialog(props: ImageEditDialogProps) {
  const {
    open,
    imageUrl,
    initialPrompt,
    initialSession,
    legacyTldrawSnapshot,
    generationContext = 'playground',
    initialModelId,
    initialImageSize,
    initialAspectRatio,
    initialBatchSize,
    onOpenChange,
    onConfirm,
  } = props;

  const { toast } = useToast();
  const providers = useAPIConfigStore((state) => state.providers);
  const getModelEntryById = useAPIConfigStore((state) => state.getModelEntryById);

  const migratedSession = useMemo(() => {
    if (initialSession) return initialSession;
    if (!legacyTldrawSnapshot) return undefined;
    return migrateTldrawSnapshot(legacyTldrawSnapshot, {
      plainPrompt: initialPrompt || '',
    });
  }, [initialPrompt, initialSession, legacyTldrawSnapshot]);

  const fallbackModelId = useMemo(() => {
    if (initialModelId) {
      return initialModelId;
    }
    if (generationContext === 'infinite-canvas') {
      return DEFAULT_INFINITE_CANVAS_MODEL_ID;
    }
    return PLAYGROUND_FALLBACK_MODEL_ID;
  }, [generationContext, initialModelId]);
  const contextModels = useMemo(
    () => getContextModelOptions(providers, generationContext, 'image'),
    [generationContext, providers],
  );
  const modelOptions = useMemo(
    () => (contextModels.length > 0
      ? contextModels
      : (generationContext === 'infinite-canvas'
        ? INFINITE_CANVAS_MODELS.map((item) => ({ id: item.id, displayName: item.label }))
        : [{ id: fallbackModelId, displayName: fallbackModelId }])),
    [contextModels, fallbackModelId, generationContext],
  );
  const [plainPrompt, setPlainPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState((imageUrl || '').trim());
  const [editorSession, setEditorSession] = useState<ImageEditorSessionSnapshot | undefined>(migratedSession);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [pendingInsertTokenQueue, setPendingInsertTokenQueue] = useState<Array<{ requestId: string; annotationId: string }>>([]);
  const [reportedTokenAnnotationIds, setReportedTokenAnnotationIds] = useState<string[] | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(fallbackModelId);
  const [selectedImageSize, setSelectedImageSize] = useState(initialImageSize || '');
  const [selectedBatchSize, setSelectedBatchSize] = useState(Math.max(1, initialBatchSize ?? 4));
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const knownAnnotationIdsRef = useRef<string[]>([]);
  const lastReportedTokenAnnotationIdsRef = useRef<Set<string>>(new Set());
  const didInitializeAnnotationsRef = useRef(false);
  const selectedModelMeta = getModelEntryById(selectedModelId || fallbackModelId);
  const supportsImageSize = selectedModelMeta?.capabilities?.supportsImageSize ?? true;
  const supportsBatch = selectedModelMeta?.capabilities?.supportsBatch ?? true;
  const allowedImageSizes = selectedModelMeta?.capabilities?.allowedImageSizes?.length
    ? selectedModelMeta.capabilities.allowedImageSizes
    : PLAYGROUND_IMAGE_SIZE_OPTIONS;
  const imageSizeOptions = useMemo<string[]>(() => {
    if (generationContext === 'infinite-canvas') {
      const filtered = INFINITE_IMAGE_SIZES.filter((size) => {
        const normalized = normalizeImageSizeToken(size);
        return normalized ? allowedImageSizes.includes(normalized as typeof PLAYGROUND_IMAGE_SIZE_OPTIONS[number]) : false;
      });
      return filtered.length > 0 ? [...filtered] : [...INFINITE_IMAGE_SIZES];
    }

    const filtered = PLAYGROUND_IMAGE_SIZE_OPTIONS.filter((size) => allowedImageSizes.includes(size));
    return filtered.length > 0 ? [...filtered] : [...PLAYGROUND_IMAGE_SIZE_OPTIONS];
  }, [allowedImageSizes, generationContext]);
  const maxBatchSize = Math.max(1, supportsBatch ? (selectedModelMeta?.capabilities?.maxBatchSize || 4) : 1);
  const resolvedAspectRatio = generationContext === 'infinite-canvas'
    ? (INFINITE_IMAGE_SIZE_ASPECT_RATIO_MAP[selectedImageSize] || initialAspectRatio || '1:1')
    : (initialAspectRatio || '1:1');

  useEffect(() => {
    if (!open) return;
    setActiveImageUrl((imageUrl || '').trim());
    setEditorSession(migratedSession);
    const sessionPrompt = migratedSession?.plainPrompt;
    setPlainPrompt(sessionPrompt ? mergePromptWithAnnotationDescriptions(sessionPrompt, migratedSession?.annotations) : '');
    setSelectedModelId(initialModelId || fallbackModelId);
    setSelectedImageSize(initialImageSize || '');
    setSelectedBatchSize(Math.max(1, initialBatchSize ?? 4));
    knownAnnotationIdsRef.current = (migratedSession?.annotations || []).map((annotation) => annotation.id);
    lastReportedTokenAnnotationIdsRef.current = new Set();
    didInitializeAnnotationsRef.current = false;
    setPendingInsertTokenQueue([]);
    setReportedTokenAnnotationIds(null);
  }, [fallbackModelId, imageUrl, initialBatchSize, initialImageSize, initialModelId, migratedSession, open]);

  useEffect(() => {
    if (!imageSizeOptions.includes(selectedImageSize as string)) {
      setSelectedImageSize(imageSizeOptions[0] || '');
    }
  }, [imageSizeOptions, selectedImageSize]);

  useEffect(() => {
    if (selectedBatchSize > maxBatchSize) {
      setSelectedBatchSize(maxBatchSize);
      return;
    }

    if (selectedBatchSize < 1) {
      setSelectedBatchSize(1);
    }
  }, [maxBatchSize, selectedBatchSize]);

  const {
    setCanvasRef,
    isReady,
    loadError,
    imageSize,
    tool,
    setTool,
    brushColor,
    setBrushColor,
    brushWidth,
    setBrushWidth,
    annotations,
    removeAnnotation,
    buildSessionSnapshot,
    exportMergedImageDataUrl,
  } = useFabricImageEditor({
    enabled: open,
    imageUrl: activeImageUrl,
    initialSession: editorSession,
  });

  useEffect(() => {
    if (!open) return;
    setTool('annotate');
  }, [open, setTool]);

  const showUploadPlaceholder = !activeImageUrl || Boolean(loadError);

  useEffect(() => {
    if (!open) {
      return;
    }

    const currentAnnotationIds = annotations.map((annotation) => annotation.id);

    if (!didInitializeAnnotationsRef.current) {
      knownAnnotationIdsRef.current = currentAnnotationIds;
      didInitializeAnnotationsRef.current = true;
      return;
    }

    const knownAnnotationIds = knownAnnotationIdsRef.current;
    const newAnnotationIds = currentAnnotationIds.filter((annotationId) => !knownAnnotationIds.includes(annotationId));

    if (newAnnotationIds.length > 0) {
      setPendingInsertTokenQueue((current) => [
        ...current,
        ...newAnnotationIds.map((annotationId) => ({
          requestId: `${annotationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          annotationId,
        })),
      ]);
    }

    knownAnnotationIdsRef.current = currentAnnotationIds;
  }, [annotations, open]);

  useEffect(() => {
    if (!open || !reportedTokenAnnotationIds) {
      return;
    }

    const previousTokenAnnotationIdSet = lastReportedTokenAnnotationIdsRef.current;
    const tokenAnnotationIdSet = new Set(reportedTokenAnnotationIds);
    const pendingAnnotationIdSet = new Set(pendingInsertTokenQueue.map((item) => item.annotationId));
    const removedTokenAnnotationIds = Array.from(previousTokenAnnotationIdSet)
      .filter((annotationId) => !tokenAnnotationIdSet.has(annotationId) && !pendingAnnotationIdSet.has(annotationId));

    lastReportedTokenAnnotationIdsRef.current = tokenAnnotationIdSet;

    if (removedTokenAnnotationIds.length === 0) {
      return;
    }

    removedTokenAnnotationIds.forEach((annotationId) => {
      removeAnnotation(annotationId);
    });
  }, [annotations, open, pendingInsertTokenQueue, removeAnnotation, reportedTokenAnnotationIds]);

  const readFileAsDataUrl = useCallback((file: File): Promise<string> => (
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    })
  ), []);

  const replaceImageByFile = useCallback(async (
    file: File,
    options?: { requireConfirmOnReplace?: boolean },
  ) => {
    if (!isImageFile(file)) {
      toast({
        title: '上传失败',
        description: '仅支持图片文件',
        variant: 'destructive',
      });
      return;
    }

    if (options?.requireConfirmOnReplace && activeImageUrl) {
      const confirmed = window.confirm('替换图片将清空当前标注、画笔和裁剪，确认继续吗？');
      if (!confirmed) {
        return;
      }
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setActiveImageUrl(dataUrl);
      setEditorSession(undefined);
      setTool('annotate');
    } catch (error) {
      toast({
        title: '处理失败',
        description: error instanceof Error ? error.message : '无法处理选中的图片',
        variant: 'destructive',
      });
    }
  }, [activeImageUrl, readFileAsDataUrl, setTool, toast]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = getFirstImageFile(event.target.files);
    if (file) {
      void replaceImageByFile(file);
    }
    event.target.value = '';
  }, [replaceImageByFile]);

  const handleCanvasDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);

    const file = getFirstImageFile(event.dataTransfer.files);
    if (file) {
      void replaceImageByFile(file, { requireConfirmOnReplace: true });
    }
  }, [replaceImageByFile]);

  const handleDialogPaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const file = getClipboardImageFile(event.clipboardData?.items);
    if (!file) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    void replaceImageByFile(file, { requireConfirmOnReplace: true });
  }, [replaceImageByFile]);

  const handleConfirm = async () => {
    setSubmitting(true);
    let closedByConfirm = false;

    try {
      const sessionSnapshot = buildSessionSnapshot(plainPrompt);
      const promptPayload = buildImageEditPrompt(sessionSnapshot.plainPrompt, sessionSnapshot.annotations);
      const mergedImageDataUrl = exportMergedImageDataUrl();

      const payload: ImageEditConfirmPayload = {
        mergedImageDataUrl,
        plainPrompt: promptPayload.plainPrompt,
        finalPrompt: promptPayload.finalPrompt,
        regionInstructions: promptPayload.regionInstructions,
        modelId: selectedModelId || fallbackModelId,
        imageSize: selectedImageSize || imageSizeOptions[0] || '',
        aspectRatio: resolvedAspectRatio,
        batchSize: Math.min(selectedBatchSize, maxBatchSize),
        sessionSnapshot: {
          ...sessionSnapshot,
          plainPrompt: promptPayload.plainPrompt,
          annotations: promptPayload.orderedAnnotations,
        },
      };

      onOpenChange(false);
      closedByConfirm = true;
      await onConfirm(payload);
    } catch (error) {
      if (closedByConfirm) {
        onOpenChange(true);
      }
      toast({
        title: '编辑确认失败',
        description: error instanceof Error ? error.message : '请检查标注描述与图片导出状态。',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        
        className="h-[90vh] w-[80vw] max-w-[1840px] overflow-hidden bg-[#1C1C1C]/80  text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl  ring-none focus:ring-0 border-white/10 rounded-3xl border p-0"
      
      >
        <DialogTitle className="sr-only">图像编辑</DialogTitle>
        <DialogDescription className="sr-only">标注、画笔、橡皮擦</DialogDescription>

        <div
          className="flex h-full min-h-[640px] w-full min-w-0 flex-col"
          onPaste={handleDialogPaste}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <ImageEditToolbar
            tool={tool}
            toolItems={TOOL_ITEMS}
            onToolChange={setTool}
            onOpenFilePicker={() => fileInputRef.current?.click()}
            brushColor={brushColor}
            brushWidth={brushWidth}
            onBrushColorChange={setBrushColor}
            onBrushWidthChange={setBrushWidth}
            submitting={submitting}
            canConfirm={isReady}
            onCancel={() => onOpenChange(false)}
            onConfirm={handleConfirm}
          />

          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden px-2 py-2 pb-2">
            <ImageEditCanvasPane
              imageSize={imageSize}
              isDraggingFile={isDraggingFile}
              isReady={isReady}
              loadError={loadError}
              showUploadPlaceholder={showUploadPlaceholder}
              onOpenFilePicker={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDraggingFile(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!isDraggingFile) {
                  setIsDraggingFile(true);
                }
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsDraggingFile(false);
              }}
              onDrop={handleCanvasDrop}
            >
              <canvas ref={setCanvasRef} className="block shrink-0" />
            </ImageEditCanvasPane>

            <div
              data-testid="image-edit-sidebar"
              className="ml-2 flex h-full w-[400px] shrink-0 min-h-0 flex-col overflow-hidden rounded-2xl border-none bg-[#0F1017] p-2"
            >
              <div className=" px-4 py-3" >
                <p className="text-md font-semibold text-[#D9D9D9]">Prompt Editor</p>
                <p className="mt-1 text-xs text-[#737373]">
                  在左侧拖拽可框选；标注模式下可直接拖动框体并拖动四角调整大小。
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-0 pb-4">
                

                <div
                  className="rounded-2xl border h-full border-none px-3 py-3 bg-[#2c2d2f]"
                 
                >
                  <ImageEditPromptEditor
                    prompt={plainPrompt}
                    annotations={annotations}
                    onPromptChange={setPlainPrompt}
                    onTokenIdsChange={setReportedTokenAnnotationIds}
                    insertTokenRequest={pendingInsertTokenQueue[0] || null}
                    onInsertTokenRequestHandled={(requestId) => {
                      setPendingInsertTokenQueue((current) => (
                        current.length > 0 && current[0]?.requestId === requestId
                          ? current.slice(1)
                          : current.filter((item) => item.requestId !== requestId)
                      ));
                    }}
                  />

                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                <div className="space-y-1.5">
                  <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger
                      className="h-9 border text-xs border-none bg-[#2c2d2f] text-white"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2c2d2f] border-none text-white">
                      {modelOptions.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {supportsImageSize ? (
                  <div className="space-y-1.5">
                    <Select value={selectedImageSize || imageSizeOptions[0]} onValueChange={setSelectedImageSize}>
                      <SelectTrigger
                        className="h-9 border text-xs border-none bg-[#2c2d2f] text-white"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#2c2d2f] border-none text-white">
                        {imageSizeOptions.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-xs text-white">尺寸</p>
                    <div
                      className="flex h-9 items-center rounded-md border border-none bg-white/20 px-3 text-xs text-white"
                    >
                      当前模型不支持尺寸切换
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
