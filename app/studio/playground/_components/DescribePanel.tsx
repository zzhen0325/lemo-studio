import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, Upload } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useCallback, useEffect, type ClipboardEvent, type RefObject } from "react";
import type { UploadedImage } from "@/lib/playground/types";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { useImageSource } from "@/hooks/common/use-image-source";

export interface DescribePanelProps {
  open: boolean;
  panelRef: RefObject<HTMLDivElement>;
  describeImages: UploadedImage[];
  isDraggingOverPanel: boolean;
  setIsDraggingOverPanel: (val: boolean) => void;
  setIsDraggingOver: (val: boolean) => void;
  onUploadClick: () => void;
  onDropFiles: (files: File[]) => void;
  onClose: () => void;
  onRemoveImage?: (index: number) => void;
  isDescribing: boolean;
  isGenerating: boolean;
  onDescribe: () => void;
}

export function DescribePanel({
  open,
  panelRef,
  describeImages,
  isDraggingOverPanel,
  setIsDraggingOverPanel,
  setIsDraggingOver,
  onUploadClick,
  onDropFiles,
  onClose,
  isDescribing,
  isGenerating,
  onDescribe,
}: DescribePanelProps) {
  const { setPreviewImage } = usePlaygroundStore();
  const handlePaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    const files: File[] = [];
    const items = event.clipboardData?.items;

    if (!items) {
      return;
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    onDropFiles(files);
  }, [onDropFiles]);

  useEffect(() => {
    if (!open) {
      return;
    }

    panelRef.current?.focus({ preventScroll: true });
  }, [open, panelRef]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          role="region"
          aria-label="Describe 图片面板"
          tabIndex={-1}
          initial={{ opacity: 0, scale: 0.98, flexGrow: 0, height: 0 }}
          animate={{ opacity: 1, scale: 1, flexGrow: 1, height: "100%" }}
          exit={{ opacity: 0, scale: 0.98, flexGrow: 0, height: 0 }}
          onPaste={handlePaste}
          className="flex w-full h-full z-20 py-2 overflow-hidden mt-2 mb-20"
        >
          <div className="w-full h-full flex flex-col items-center p-2 bg-white/10 border border-white/20 rounded-[30px]">
            <div
              className={cn(
                "w-full h-full flex flex-col items-center p-4 rounded-3xl border transition-all cursor-pointer group relative",
                isDraggingOverPanel
                  ? "bg-white/10 border-primary border-dashed shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                  : "bg-white/5 border-white/40 border-dashed"
              )}
              onClick={() => onUploadClick()}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverPanel(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverPanel(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverPanel(false);
                setIsDraggingOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onDropFiles(Array.from(e.dataTransfer.files));
                }
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="absolute right-4 top-4 z-30 p-1.5 rounded-full bg-black/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              {describeImages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center py-2 justify-center gap-3 opacity-70 group-hover/overlay:opacity-100 transition-opacity">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-full border flex items-center justify-center transition-all",
                      isDraggingOverPanel ? "bg-black/5 border-primary" : "bg-black/5 border-white/20"
                    )}
                  >
                    <Upload className={cn("w-4 h-4", isDraggingOverPanel ? "text-primary" : "text-white")} />
                  </div>
                  <div className="text-center">
                    <p className={cn("text-sm font-normal", isDraggingOverPanel ? "text-primary" : "text-white")}>
                      {isDraggingOverPanel ? "松开以开始图像分析" : "拖动图片到此处 或 点击选择图片"}
                    </p>
                    {!isDraggingOverPanel && (
                      <p className="mt-1 text-xs text-white/50">
                        支持直接粘贴截图或剪贴板图片
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-between gap-4 py-2">
                  <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden p-2">
                    {describeImages[0] && (
                      <DescribeImageItem
                        key={describeImages[0].id || 0}
                        img={describeImages[0]}
                        idx={0}
                        onPreview={setPreviewImage}
                        className="w-full h-full"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDescribe();
                      }}
                      disabled={isDescribing || isGenerating}
                      className="h-10 px-8 rounded-xl bg-primary text-black font-normal hover:bg-primary/90 transition-all shadow-[0_0_20px_oklch(var(--primary)/0.3)] active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      {isDescribing ? (
                        <div className="flex items-center gap-2">
                          <LoadingSpinner size={14} />
                          <span className="text-sm">Describeing...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          
                          <span className="text-sm">Describe</span>
                        </div>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DescribeImageItem({
  img,
  idx,
  onPreview,
  className
}: {
  img: UploadedImage;
  idx: number;
  onPreview: (url: string | null, layoutId?: string | null) => void;
  className?: string;
}) {
  const src = useImageSource(img.path || img.previewUrl);
  const imageWidth = img.width || 1920;
  const imageHeight = img.height || 1080;

  return (
    <div
      className={cn(
        "relative flex w-full h-full min-h-0 min-w-0 items-center justify-center",
        className
      )}
    >
      <motion.div
        layoutId={`img-input-${img.id || idx}`}
        className="relative inline-flex max-h-full max-w-full cursor-pointer rounded-2xl border-none transition-all hover:border-white/20"
        onClick={(e) => {
          e.stopPropagation();
          if (src) {
            onPreview(src, `img-input-${img.id || idx}`);
          }
        }}
      >
        <div className="relative items-center justify-center overflow-hidden rounded-2xl">
            {/* {!img.isUploading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(idx);
            }}
            className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white  transition-all hover:bg-red-500/80 hover:scale-110"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )} */}
          <div className="relative h-full w-full shadow-md">
             <Image
            src={src || img.previewUrl}
            alt="Preview"
            width={imageWidth}
            height={imageHeight}
            unoptimized
            className={cn(
              "block max-h-full max-w-full h-auto w-auto mx-auto object-contain rounded-2xl",
              img.isUploading && "opacity-50 grayscale blur-[2px]"
            )}
          />
         

          </div>
         
        </div>

        {img.isUploading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner size={24} className="text-white" />
          </div>
        )}

       
      </motion.div>
    </div>
  );
}
