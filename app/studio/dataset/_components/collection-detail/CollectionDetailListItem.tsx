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
import { ImageSizeBadge } from './ImageSizeBadge';
import { PromptTextarea } from './PromptTextareas';
import type {
  CropMode,
  DatasetImage,
  TranslateLang,
} from './types';

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
      className={`flex flex-col sm:flex-row min-h-[300px] bg-[#1a1a1a] border rounded-2xl overflow-hidden group transition-all duration-200 shadow-sm ${isSelected
        ? 'border-teal-500 ring-1 ring-teal-500 shadow-[0_0_15px_rgba(20,184,166,0.15)] bg-teal-500/5'
        : 'border-[#2e2e2e] hover:border-[#3a3a3a] hover:bg-[#1f1f1f]'
        }`}
    >
      <div
        className={`w-full sm:w-[280px] lg:w-[320px] shrink-0 relative bg-[#161616] sm:min-h-[240px] border-b sm:border-b-0 sm:border-r border-[#2e2e2e] flex items-center justify-center p-2 cursor-pointer transition-colors ${isSelected ? 'bg-teal-500/5' : ''}`}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.image-zoom-trigger')) return;
          onSelect(img.id, e.shiftKey);
        }}
      >
        <div className="w-full h-full min-h-[240px] sm:min-h-full relative rounded-xl overflow-hidden bg-[#0e0e0e]">
          <ImageZoom className="w-full h-full image-zoom-trigger absolute inset-0">
            <Image
              src={img.url}
              alt=""
              width={1200}
              height={1200}
              unoptimized
              className={`w-full h-full object-contain transition-transform duration-300 ${isSelected ? 'scale-[0.98]' : ''}`}
            />
          </ImageZoom>
        </div>

        <div
          className={`absolute top-4 left-4 z-10 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <div
            className={`w-6 h-6 rounded-full border flex items-center justify-center shadow-md transition-colors ${isSelected
              ? 'bg-teal-500 border-teal-500 text-white'
              : 'bg-black/40 border-white/60 backdrop-blur-sm hover:border-white'
              }`}
          >
            {isSelected && <Plus className="w-4 h-4 text-white rotate-45" />}
          </div>
        </div>

        {(img.isOptimizing || img.isTranslating) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <LoadingSpinner size={32} className="text-primary" />
          </div>
        )}
      </div>

      <div className="flex-1 p-4 flex flex-col gap-3 bg-transparent min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className="text-[15px] font-medium text-zinc-200 tracking-tight truncate"
              title={img.filename}
            >
              {img.filename}
            </span>
            <ImageSizeBadge src={img.url} />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-[#161616] rounded-lg p-1 border border-[#2e2e2e]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onImagePromptLangSwitch(img, 'zh')}
                disabled={img.isOptimizing || img.isTranslating}
                className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${imagePromptLang === 'zh'
                  ? 'bg-[#2a2a2a] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                中文
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onImagePromptLangSwitch(img, 'en')}
                disabled={img.isOptimizing || img.isTranslating}
                className={`h-7 px-3 text-xs font-medium rounded-md transition-colors ${imagePromptLang === 'en'
                  ? 'bg-[#2a2a2a] text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
                  }`}
              >
                English
              </Button>
            </div>

            <div className="w-[1px] h-4 bg-[#2e2e2e] mx-1" />

            <Button
              variant="secondary"
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-1.5 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2e2e2e] text-zinc-300 hover:text-white transition-all duration-200 shadow-sm rounded-lg"
              onClick={() => onOptimizePrompt(img)}
              disabled={img.isOptimizing || img.isTranslating}
              title="Optimize with AI"
            >
              <Wand2
                className={`h-3.5 w-3.5 ${img.isOptimizing ? 'animate-pulse text-primary' : 'text-teal-500'}`}
              />
              AI 优化
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-[#1a1a1a] hover:bg-[#2a2a2a] border border-[#2e2e2e] text-zinc-400 hover:text-white transition-all duration-200 shadow-sm rounded-lg"
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
              className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 ml-1 rounded-lg"
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
