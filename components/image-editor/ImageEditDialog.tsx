"use client";

import React, { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Crop, Eraser, MousePointer2, Pencil, Square } from 'lucide-react';
import { useToast } from '@/hooks/common/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ImageEditConfirmPayload, ImageEditDialogProps, ImageEditorTool } from './types';
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

  useEffect(() => {
    if (!open) return;
    const sessionPrompt = migratedSession?.plainPrompt;
    setPlainPrompt((sessionPrompt || initialPrompt || '').trim());
  }, [initialPrompt, migratedSession?.plainPrompt, open]);

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
    imageUrl,
    initialSession: migratedSession,
  });

  const promptPreview = useMemo(() => {
    try {
      return buildImageEditPrompt(plainPrompt, annotations);
    } catch {
      return null;
    }
  }, [annotations, plainPrompt]);

  const missingDescription = annotations.some((annotation) => !annotation.description.trim());

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
        className="max-h-[92vh] w-[96vw] max-w-[1440px] overflow-hidden rounded-2xl border p-0"
        style={{
          backgroundColor: IMAGE_EDITOR_THEME.background,
          borderColor: IMAGE_EDITOR_THEME.border,
        }}
      >
        <DialogTitle className="sr-only">图像编辑</DialogTitle>
        <DialogDescription className="sr-only">标注、画笔、橡皮擦、裁剪</DialogDescription>

        <div className="flex h-[84vh] min-h-[640px] w-full flex-col">
          <div
            className="flex items-center justify-between border-b px-5 py-3"
            style={{ borderColor: IMAGE_EDITOR_THEME.border, backgroundColor: IMAGE_EDITOR_THEME.background }}
          >
            <div className="flex items-center gap-2">
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
            </div>

            <div className="flex items-center gap-2 text-xs" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>
              <span>{imageSize.width} x {imageSize.height}</span>
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
            </div>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden px-5 py-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div
              className="relative flex min-h-0 items-center justify-center overflow-auto rounded-2xl border"
              style={{ backgroundColor: IMAGE_EDITOR_THEME.card, borderColor: IMAGE_EDITOR_THEME.border }}
            >
              {isReady ? null : (
                <div className="absolute inset-0 z-10 flex items-center justify-center text-sm" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>
                  {loadError || 'Thinking...'}
                </div>
              )}
              <canvas ref={setCanvasRef} className="block max-h-full max-w-full" />
            </div>

            <div
              className="flex min-h-0 flex-col overflow-hidden rounded-2xl border"
              style={{ backgroundColor: IMAGE_EDITOR_THEME.card, borderColor: IMAGE_EDITOR_THEME.border }}
            >
              <div className="border-b px-4 py-3" style={{ borderColor: IMAGE_EDITOR_THEME.border }}>
                <p className="text-sm font-semibold" style={{ color: IMAGE_EDITOR_THEME.textPrimary }}>编辑指令</p>
                <p className="mt-1 text-xs" style={{ color: IMAGE_EDITOR_THEME.textMuted }}>
                  在左侧拖拽可框选；标注模式下可直接拖动框体并拖动四角调整大小。若存在标注，确认前每条说明必填。
                </p>
              </div>

              <div className="space-y-4 overflow-y-auto p-4">
                <div className="space-y-2">
                  <label className="text-xs" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>Prompt</label>
                  <Textarea
                    value={plainPrompt}
                    onChange={(event) => setPlainPrompt(event.target.value)}
                    placeholder="输入基础编辑指令..."
                    className="min-h-[110px] resize-none rounded-xl border text-sm"
                    style={{
                      borderColor: IMAGE_EDITOR_THEME.border,
                      backgroundColor: IMAGE_EDITOR_THEME.background,
                      color: IMAGE_EDITOR_THEME.textPrimary,
                    }}
                  />
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

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs" style={{ color: IMAGE_EDITOR_THEME.textSecondary }}>
                      标注区域（{annotations.length}）
                    </p>
                    {missingDescription ? (
                      <span className="text-[11px]" style={{ color: '#fca5a5' }}>存在未填写说明</span>
                    ) : null}
                  </div>

                  <ScrollArea className="h-[260px] rounded-xl border px-3 py-2" style={{ borderColor: IMAGE_EDITOR_THEME.border, backgroundColor: IMAGE_EDITOR_THEME.background }}>
                    {annotations.length === 0 ? (
                      <p className="py-3 text-xs" style={{ color: IMAGE_EDITOR_THEME.textMuted }}>
                        使用“标注”工具在画布上框选区域后，在这里填写每个区域的描述。
                      </p>
                    ) : (
                      <div className="space-y-3 py-2">
                        {annotations.map((annotation) => (
                          <div key={annotation.id} className="rounded-xl border p-2" style={{ borderColor: IMAGE_EDITOR_THEME.border, backgroundColor: IMAGE_EDITOR_THEME.card }}>
                            <div className="mb-1 flex items-center justify-between">
                              <span className="text-xs font-semibold" style={{ color: IMAGE_EDITOR_THEME.textPrimary }}>
                                [{annotation.label}]
                              </span>
                              <button
                                type="button"
                                onClick={() => removeAnnotation(annotation.id)}
                                className="text-[11px]"
                                style={{ color: IMAGE_EDITOR_THEME.textMuted }}
                              >
                                删除
                              </button>
                            </div>
                            <Textarea
                              value={annotation.description}
                              onChange={(event) => setAnnotationDescription(annotation.id, event.target.value)}
                              placeholder="填写该区域编辑指令..."
                              className="min-h-[80px] resize-none rounded-lg border text-xs"
                              style={{
                                borderColor: IMAGE_EDITOR_THEME.border,
                                backgroundColor: IMAGE_EDITOR_THEME.background,
                                color: IMAGE_EDITOR_THEME.textPrimary,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

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

          <div className="flex items-center justify-end gap-2 border-t px-5 py-3" style={{ borderColor: IMAGE_EDITOR_THEME.border }}>
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
      </DialogContent>
    </Dialog>
  );
}
