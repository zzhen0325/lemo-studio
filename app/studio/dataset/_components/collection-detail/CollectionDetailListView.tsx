'use client';

import { Plus, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CollectionDetailListItem } from './CollectionDetailListItem';
import { getPromptByLang } from './collection-detail.utils';
import type {
  CropMode,
  DatasetImage,
  TranslateLang,
} from './types';

interface CollectionDetailListViewProps {
  images: DatasetImage[];
  selectedIds: Set<string>;
  activePromptLang: TranslateLang;
  promptDisplayLangById: Record<string, TranslateLang>;
  isProcessing: boolean;
  isConflictDialogOpen: boolean;
  cropMode: CropMode;
  targetSize: string;
  onConflictDialogOpenChange: (open: boolean) => void;
  onKeepCurrentTask: () => void;
  onInterruptAndStartPendingTask: () => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
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

export function CollectionDetailListView({
  images,
  selectedIds,
  activePromptLang,
  promptDisplayLangById,
  isProcessing,
  isConflictDialogOpen,
  cropMode,
  targetSize,
  onConflictDialogOpenChange,
  onKeepCurrentTask,
  onInterruptAndStartPendingTask,
  onUpload,
  onSelect,
  onImagePromptLangSwitch,
  onOptimizePrompt,
  onCropModeChange,
  onTargetSizeChange,
  onCropImage,
  onDeleteImage,
  onPromptChange,
  onPromptEditingChange,
}: CollectionDetailListViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
      <Dialog
        open={isConflictDialogOpen}
        onOpenChange={onConflictDialogOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              任务正在运行中
            </DialogTitle>
            <DialogDescription className="py-2 text-muted-foreground leading-relaxed">
              当前已有一个批量处理任务正在执行。您可以选择<b>中断</b>当前任务并启动新任务，或者
              <b>继续</b>等待当前任务完成。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={onKeepCurrentTask}
              className="sm:flex-1"
            >
              继续当前任务
            </Button>
            <Button
              variant="destructive"
              onClick={onInterruptAndStartPendingTask}
              className="sm:flex-1"
            >
              中断并开启新任务
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-white/10 bg-card/40 rounded-2xl p-10 hover:border-primary/50 hover:bg-primary/5 transition-all group min-h-[300px]">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all">
          <Plus className="h-8 w-8 text-muted-foreground group-hover:text-primary" />
        </div>
        <span className="mt-4 text-white text-xl font-medium group-hover:text-primary transition-colors">
          Add
        </span>
        <p className="mt-2 text-sm text-muted-foreground/70 text-center">
          Support multiple JPG, PNGfiles
        </p>
        <input
          type="file"
          multiple
          accept="image/*,.txt"
          className="hidden"
          onChange={onUpload}
        />
      </label>

      {images.map((img) => {
        const imagePromptLang = promptDisplayLangById[img.id] ?? activePromptLang;
        const imagePromptValue = getPromptByLang(img, imagePromptLang);

        return (
          <CollectionDetailListItem
            key={img.id}
            img={img}
            isSelected={selectedIds.has(img.id)}
            isProcessing={isProcessing}
            cropMode={cropMode}
            targetSize={targetSize}
            imagePromptLang={imagePromptLang}
            imagePromptValue={imagePromptValue}
            onSelect={onSelect}
            onImagePromptLangSwitch={onImagePromptLangSwitch}
            onOptimizePrompt={onOptimizePrompt}
            onCropModeChange={onCropModeChange}
            onTargetSizeChange={onTargetSizeChange}
            onCropImage={onCropImage}
            onDeleteImage={onDeleteImage}
            onPromptChange={onPromptChange}
            onPromptEditingChange={onPromptEditingChange}
          />
        );
      })}
    </div>
  );
}
