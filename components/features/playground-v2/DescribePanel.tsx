import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, Upload, Sparkles, Plus } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { RefObject } from "react";
import type { UploadedImage } from "@/components/features/playground-v2/types";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { formatImageUrl } from "@/lib/api-base";
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
  onRemoveImage: (index: number) => void;
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
  onRemoveImage,
  isDescribing,
  isGenerating,
  onDescribe,
}: DescribePanelProps) {
  const { setPreviewImage } = usePlaygroundStore();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.98, flexGrow: 0, height: 0 }}
          animate={{ opacity: 1, scale: 1, flexGrow: 1, height: "auto" }}
          exit={{ opacity: 0, scale: 0.98, flexGrow: 0, height: 0 }}
          className="flex w-full z-20 py-2 overflow-hidden mt-2 mb-20"
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
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-between gap-4 py-2">
                  <div className="flex-1 flex flex-wrap justify-center overflow-y-auto gap-4 scrollbar-hide p-2">
                    {describeImages.map((img, idx) => (
                      <DescribeImageItem
                        key={img.id || idx}
                        img={img}
                        idx={idx}
                        onRemove={onRemoveImage}
                        onPreview={setPreviewImage}
                      />
                    ))}
                    <div className="w-20 h-20 rounded-xl border border-dashed border-white/10 flex items-center justify-center hover:border-primary transition-all">
                      <Plus className="w-5 h-5 text-white/20" />
                    </div>
                  </div>

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
                        <span className="text-sm">描述中...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="text-sm">Describe</span>
                      </div>
                    )}
                  </Button>
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
  onRemove,
  onPreview
}: {
  img: UploadedImage;
  idx: number;
  onRemove: (index: number) => void;
  onPreview: (url: string, layoutId?: string) => void;
}) {
  const src = useImageSource(img.path || img.previewUrl, img.localId);

  return (
    <div className="relative group/img shrink-0">
      <motion.div
        layoutId={`img-input-${img.id || idx}`}
        className="relative cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          if (src) {
            onPreview(src, `img-input-${img.id || idx}`);
          }
        }}
      >
        <Image
          src={src || img.previewUrl}
          alt="Preview"
          width={80}
          height={80}
          className={cn(
            "w-20 h-20 object-cover rounded-xl border-2 border-white/20 transition-all",
            img.isUploading && "opacity-50 grayscale blur-[px]"
          )}
          unoptimized
        />
        {img.isUploading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner size={24} className="text-white" />
          </div>
        )}
      </motion.div>
      {!img.isUploading && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(idx);
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-red-500 shadow-lg"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </div>
  );
}
