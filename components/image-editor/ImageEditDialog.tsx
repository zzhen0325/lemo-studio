"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { Crop, Eraser, MousePointer2, Pencil, Square, Upload } from 'lucide-react';
import { useToast } from '@/hooks/common/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { AutosizeTextarea } from '@/components/ui/autosize-text-area';
import { Input } from '@/components/ui/input';
import type {
  ImageEditConfirmPayload,
  ImageEditDialogProps,
  ImageEditorSessionSnapshot,
  ImageEditorTool,
} from './types';
import { IMAGE_EDITOR_THEME } from './theme';
import { buildImageEditPrompt } from './utils/build-image-edit-prompt';
import { migrateTldrawSnapshot } from './utils/migrate-tldraw-snapshot';
import { useFabricImageEditor } from './hooks/use-fabric-image-editor';

const TOOL_ITEMS: Array<{ id: ImageEditorTool; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'select', label: '选择', icon: MousePointer2 },
  { id: 'annotate', label: '标注', icon: Square },
  { id: 'brush', label: '画笔', icon: Pencil },
  { id: 'eraser', label: '橡皮擦', icon: Eraser },
  { id: 'crop', label: '裁剪', icon: Crop },
];

export default function ImageEditDialog(props: ImageEditDialogProps) {
  const {
    open,
    imageUrl,
    initialPrompt,
    initialSession,
    legacyTldrawSnapshot,
    onOpenChange,
    onConfirm,
  } = props;

  const { toast } = useToast();

  const migratedSession = useMemo(() => {
    if (initialSession) return initialSession;
    if (!legacyTldrawSnapshot) return undefined;
    return migrateTldrawSnapshot(legacyTldrawSnapshot, {
      plainPrompt: initialPrompt || '',
    });
  }, [initialPrompt, initialSession, legacyTldrawSnapshot]);

  const [plainPrompt, setPlainPrompt] = useState((initialPrompt || '').trim());
  const [submitting, setSubmitting] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState((imageUrl || '').trim());
  const [editorSession, setEditorSession] = useState<ImageEditorSessionSnapshot | undefined>(migratedSession);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveImageUrl((imageUrl || '').trim());
    setEditorSession(migratedSession);
    const sessionPrompt = migratedSession?.plainPrompt;
    setPlainPrompt((sessionPrompt || initialPrompt || '').trim());
  }, [imageUrl, initialPrompt, migratedSession, open]);

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
    crop,
    setAnnotationDescription,
    removeAnnotation,
    clearCrop,
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

  const promptPreview = useMemo(() => {
    try {
      return buildImageEditPrompt(plainPrompt, annotations);
    } catch {
      return null;
    }
  }, [annotations, plainPrompt]);

  const missingDescription = annotations.some((annotation) => !annotation.description.trim());
  const showUploadPlaceholder = !activeImageUrl || Boolean(loadError);

  const readFileAsDataUrl = useCallback((file: File): Promise<string> => (
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    })
  ), []);

  const replaceImageByFile = useCallback(async (file: File, fromDrop: boolean) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: '上传失败',
        description: '仅支持图片文件',
        variant: 'destructive',
      });
      return;
    }

    if (fromDrop && activeImageUrl) {
      const confirmed = window.confirm('拖拽替换将清空当前标注、画笔和裁剪，确认继续吗？');
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
    const file = event.target.files?.[0];
    if (file) {
      void replaceImageByFile(file, false);
    }
    event.target.value = '';
  }, [replaceImageByFile]);

  const handleCanvasDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void replaceImageByFile(file, true);
    }
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
        
        className="max-h-[80vh] w-[80vw] max-w-[1840px] overflow-hidden bg-[#1C1C1C]/80  text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl   border-white/10 rounded-3xl border p-4"
      
      >
        <DialogTitle className="sr-only">图像编辑</DialogTitle>
        <DialogDescription className="sr-only">标注、画笔、橡皮擦、裁剪</DialogDescription>

        <div className="flex h-full min-h-[640px] w-full flex-col">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div
            className="flex flex-wrap items-center justify-between gap-3 border-none px-2 py-2"
           
          >
            <div className="flex flex-wrap items-center gap-2">
              {TOOL_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = tool === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTool(item.id)}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs transition-colors',
                      isActive ? 'font-semibold' : 'font-medium',
                    )}
                    style={{
                      borderColor: isActive ? IMAGE_EDITOR_THEME.action : IMAGE_EDITOR_THEME.border,
                      backgroundColor: isActive ? `${IMAGE_EDITOR_THEME.action}22` : IMAGE_EDITOR_THEME.card,
                      color: isActive ? IMAGE_EDITOR_THEME.action : IMAGE_EDITOR_THEME.textPrimary,
                    }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
              {crop ? (
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 transition-colors"
                  style={{ borderColor: IMAGE_EDITOR_THEME.border, color: IMAGE_EDITOR_THEME.textPrimary }}
                  onClick={clearCrop}
                >
                  清除裁剪
                </button>
              ) : null}
              <button
                type="button"
                className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-medium bg-white/5 hover:bg-white/10 transition-colors hover:text-white transition-colors"
                style={{
                  borderColor: IMAGE_EDITOR_THEME.border,
                  
                  color: IMAGE_EDITOR_THEME.textPrimary,
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                替换图片
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl border"
                style={{
                  borderColor: IMAGE_EDITOR_THEME.border,
                  backgroundColor: IMAGE_EDITOR_THEME.card,
                  color: IMAGE_EDITOR_THEME.textPrimary,
                }}
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                取消
              </Button>
              <Button
                type="button"
                className="rounded-xl border-0 font-semibold"
                style={{
                  backgroundColor: IMAGE_EDITOR_THEME.action,
                  color: IMAGE_EDITOR_THEME.actionText,
                }}
                onClick={handleConfirm}
                disabled={!isReady || submitting}
              >
                {submitting ? '处理中...' : '确认编辑'}
              </Button>
            </div>
          </div>

          <div className=" flex flex-1 min-h-0 pb-2 overflow-hidden px-2 py-2 ">
            <div
              className="relative flex flex-1 min-h-0 items-center justify-center overflow-auto rounded-2xl h-full"
           
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
              {showUploadPlaceholder ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-sm border border-white/10 rounded-2xl bg-black/80" >
                  <button
                    type="button"
                    className={cn(
                      'inline-flex min-h-[120px] min-w-[280px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-5 text-center transition-colors',
                      isDraggingFile && 'scale-[1.01]',
                    )}
                    style={{
                      borderColor: isDraggingFile ? IMAGE_EDITOR_THEME.action : IMAGE_EDITOR_THEME.border,
                      backgroundColor: isDraggingFile ? IMAGE_EDITOR_THEME.actionSurface : IMAGE_EDITOR_THEME.background,
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-5 w-5" style={{ color: IMAGE_EDITOR_THEME.textSecondary }} />
                    <span style={{ color: IMAGE_EDITOR_THEME.textPrimary }}>点击或拖拽上传图片</span>
                    {loadError && activeImageUrl ? (
                      <span className="text-xs" style={{ color: IMAGE_EDITOR_THEME.textMuted }}>{loadError}</span>
                    ) : null}
                  </button>
                </div>
              ) : null}
              {!showUploadPlaceholder && !isReady ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-sm" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>
                  Thinking...
                </div>
              ) : null}
              <canvas ref={setCanvasRef} className="block max-h-full max-w-full" />

              <div
                className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-lg border px-2 py-1 text-[11px]"
                style={{
                  borderColor: IMAGE_EDITOR_THEME.border,
                  backgroundColor: `${IMAGE_EDITOR_THEME.background}CC`,
                  color: IMAGE_EDITOR_THEME.textSecondary,
                }}
              >
                {imageSize.width} x {imageSize.height}
              </div>
            </div>

            <div
              className="ml-2 flex h-full w-[400px] min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black p-2"
              
            >
              <div className="b px-4 py-3" >
                <p className="text-sm font-semibold" style={{ color: IMAGE_EDITOR_THEME.textPrimary }}>编辑指令</p>
                <p className="mt-1 text-xs" style={{ color: IMAGE_EDITOR_THEME.textMuted }}>
                  在左侧拖拽可框选；标注模式下可直接拖动框体并拖动四角调整大小。若存在标注，确认前每条说明必填。
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 ">
                <div
                  className="rounded-2xl border border-white/10 px-3 py-3 bg-[#1c1c1c]"
                 
                >
                  <AutosizeTextarea
                    value={plainPrompt}
                    onChange={(event) => setPlainPrompt(event.target.value)}
                    placeholder="输入基础编辑指令..."
                    minHeight={320}
                    maxHeight={400}
                    className="w-full border-none bg-transparent p-2 text-sm leading-relaxed tracking-wide placeholder:text-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{
                      color: IMAGE_EDITOR_THEME.textPrimary,
                    }}
                  />

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>
                      标注（{annotations.length}）
                    </p>
                    {missingDescription ? (
                      <span className="text-[11px]" style={{ color: '#fca5a5' }}>存在未填写说明</span>
                    ) : null}
                  </div>

                  {annotations.length === 0 ? (
                    <p className="mt-2 rounded-xl border px-3 py-2 text-xs" style={{ color: IMAGE_EDITOR_THEME.textMuted, borderColor: IMAGE_EDITOR_THEME.border }}>
                      使用“标注”工具框选区域后，标注 token 会嵌入到此输入区。
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-col gap-2">
                      {annotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className="inline-flex items-center gap-2 rounded-full border px-2 py-1.5"
                          style={{
                            borderColor: IMAGE_EDITOR_THEME.border,
                            backgroundColor: IMAGE_EDITOR_THEME.card,
                          }}
                        >
                          <span
                            className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
                            style={{
                              borderColor: IMAGE_EDITOR_THEME.border,
                              backgroundColor: `${IMAGE_EDITOR_THEME.action}1A`,
                              color: IMAGE_EDITOR_THEME.textPrimary,
                            }}
                          >
                            {annotation.label}
                          </span>
                          <input
                            value={annotation.description}
                            onChange={(event) => setAnnotationDescription(annotation.id, event.target.value)}
                            placeholder="输入该区域编辑指令..."
                            className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-white/35"
                            style={{ color: IMAGE_EDITOR_THEME.textPrimary }}
                          />
                          <button
                            type="button"
                            onClick={() => removeAnnotation(annotation.id)}
                            className="shrink-0 text-[11px]"
                            style={{ color: IMAGE_EDITOR_THEME.textMuted }}
                          >
                            删除
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {tool === 'brush' ? (
                  <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: IMAGE_EDITOR_THEME.border, backgroundColor: IMAGE_EDITOR_THEME.background }}>
                    <div className="flex items-center gap-2">
                      <label className="text-xs" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>画笔颜色</label>
                      <Input
                        type="color"
                        value={brushColor}
                        onChange={(event) => setBrushColor(event.target.value)}
                        className="h-8 w-12 rounded-lg border p-1"
                        style={{ borderColor: IMAGE_EDITOR_THEME.border, backgroundColor: IMAGE_EDITOR_THEME.background }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>画笔粗细：{brushWidth}px</label>
                      <input
                        type="range"
                        min={1}
                        max={24}
                        value={brushWidth}
                        onChange={(event) => setBrushWidth(Number(event.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                ) : null}

                {promptPreview?.regionInstructions ? (
                  <div className="rounded-xl border p-3" style={{ borderColor: IMAGE_EDITOR_THEME.border, backgroundColor: IMAGE_EDITOR_THEME.background }}>
                    <p className="mb-2 text-xs" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>Region Instructions 预览</p>
                    <pre className="whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: IMAGE_EDITOR_THEME.textMuted }}>
                      {promptPreview.regionInstructions}
                    </pre>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
