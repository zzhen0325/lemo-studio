'use client';

import Image from 'next/image';
import { Loader2, Plus, Scissors, Trash2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageZoom } from '@/components/ui/shadcn-io/image-zoom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ImageSizeBadge } from '@/components/features/dataset/collection-detail/ImageSizeBadge';
import { PromptTextarea } from '@/components/features/dataset/collection-detail/PromptTextareas';
import type {
  CropMode,
  DatasetImage,
  TranslateLang,
} from '@/components/features/dataset/collection-detail/types';

interface CollectionDetailListItemProps {
  img: DatasetImage;
  isSelected: boolean;
  isProcessing: boolean;
  cropMode: CropMode;
  targetSize: string;
  imagePromptLang: TranslateLang;
  imagePromptValue: string;
  onSelect: (id: string, shiftKey?: boolean) => void;
  onImagePromptLangSwitch: (img: DatasetImage, targetLang: TranslateLang) => void;
  onOptimizePrompt: (img: DatasetImage) => void;
  onCropModeChange: (mode: CropMode) => void;
  onTargetSizeChange: (size: string) => void;
  onCropImage: (img: DatasetImage) => void;
  onDeleteImage: (img: DatasetImage) => void;
  onPromptChange: (id: string, value: string, lang?: TranslateLang) => void;
  onPromptEditingChange: (editing: boolean) => void;
}

export function CollectionDetailListItem({
  img,
  isSelected,
  isProcessing,
  cropMode,
  targetSize,
  imagePromptLang,
  imagePromptValue,
  onSelect,
  onImagePromptLangSwitch,
  onOptimizePrompt,
  onCropModeChange,
  onTargetSizeChange,
  onCropImage,
  onDeleteImage,
  onPromptChange,
  onPromptEditingChange,
}: CollectionDetailListItemProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row bg-card/40 border rounded-2xl overflow-hidden group transition-all duration-300 hover:shadow-lg ${isSelected
          ? 'border-primary ring-1 ring-primary shadow-[0_0_15px_oklch(var(--primary)/0.15)] bg-primary/5'
          : 'border-white/5 hover:border-white/20'
        }`}
    >
      <div
        className={`w-full sm:w-[320px] lg:w-[400px] shrink-0 relative bg-background/30 sm:min-h-[320px] border-b sm:border-b-0 sm:border-r border-white/5 flex items-center justify-center p-3 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.image-zoom-trigger')) return;
          onSelect(img.id, e.shiftKey);
        }}
      >
        <div className="w-full h-full min-h-[300px] sm:min-h-full relative rounded-xl overflow-hidden bg-muted/20">
          <ImageZoom className="w-full h-full image-zoom-trigger absolute inset-0">
            <Image
              src={img.url}
              alt=""
              fill
              unoptimized
              className={`object-contain transition-transform duration-300 ${isSelected ? 'scale-[0.98]' : ''}`}
              sizes="(max-width: 768px) 100vw, 400px"
            />
          </ImageZoom>
        </div>

        <div
          className={`absolute top-5 left-5 z-10 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <div
            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-md transition-colors ${isSelected
                ? 'bg-primary border-primary'
                : 'bg-black/40 border-white/60 backdrop-blur-sm hover:border-white'
              }`}
          >
            {isSelected && <Plus className="w-4 h-4 text-primary-foreground rotate-45" />}
          </div>
        </div>

        {(img.isOptimizing || img.isTranslating) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <LoadingSpinner size={32} className="text-primary" />
          </div>
        )}
      </div>

      <div className="flex-1 p-4 sm:p-6 flex flex-col gap-4 bg-transparent min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="text-base font-semibold text-foreground/90 tracking-tight truncate"
              title={img.filename}
            >
              {img.filename}
            </span>
            <ImageSizeBadge src={img.url} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-background/60 backdrop-blur-sm rounded-lg p-0.5 border border-white/10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onImagePromptLangSwitch(img, 'zh')}
                disabled={img.isOptimizing || img.isTranslating}
                className={`h-7 px-3 text-[11px] font-medium rounded-md transition-colors ${imagePromptLang === 'zh'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
              >
                中文
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onImagePromptLangSwitch(img, 'en')}
                disabled={img.isOptimizing || img.isTranslating}
                className={`h-7 px-3 text-[11px] font-medium rounded-md transition-colors ${imagePromptLang === 'en'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  }`}
              >
                English
              </Button>
            </div>

            <div className="w-[1px] h-4 bg-white/10 mx-1" />

            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-1.5 bg-white/5 hover:bg-white/15 border border-white/10 text-foreground transition-all duration-200"
              onClick={() => onOptimizePrompt(img)}
              disabled={img.isOptimizing || img.isTranslating}
              title="Optimize with AI"
            >
              <Wand2
                className={`h-3.5 w-3.5 ${img.isOptimizing ? 'animate-pulse text-primary' : 'text-primary/80'}`}
              />
              AI 优化
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-white/5 hover:bg-white/15 border border-white/10 text-muted-foreground hover:text-foreground transition-all duration-200"
                  title="Crop image"
                >
                  <Scissors className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4" align="end">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                      Crop Mode
                    </Label>
                    <Select
                      value={cropMode}
                      onValueChange={(v: CropMode) => onCropModeChange(v)}
                    >
                      <SelectTrigger className="w-full h-8 bg-background border-white/10 text-xs">
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="center">Center Crop (1:1)</SelectItem>
                        <SelectItem value="longest">Scale Longest Side</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-semibold">
                      Target Size
                    </Label>
                    <Select value={targetSize} onValueChange={onTargetSizeChange}>
                      <SelectTrigger className="w-full h-8 bg-background border-white/10 text-xs">
                        <SelectValue placeholder="Size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="512">512px</SelectItem>
                        <SelectItem value="768">768px</SelectItem>
                        <SelectItem value="1024">1024px</SelectItem>
                        <SelectItem value="2048">2048px</SelectItem>
                        <SelectItem value="original">Original Size</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    variant="default"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => onCropImage(img)}
                    className="w-full h-8 text-xs"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Scissors className="h-4 w-4 mr-1" />
                    )}
                    Apply Crop
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-white hover:bg-destructive/80 transition-all duration-200 ml-1"
              onClick={() => onDeleteImage(img)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <PromptTextarea
          imageId={img.id}
          value={imagePromptValue}
          lang={imagePromptLang}
          onCommit={onPromptChange}
          onEditingChange={onPromptEditingChange}
          disabled={img.isOptimizing || img.isTranslating}
        />
      </div>
    </div>
  );
}
