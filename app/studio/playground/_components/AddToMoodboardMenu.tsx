'use client';

import React, { useRef, useState } from 'react';
import { Plus, X, BookmarkPlus, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useToast } from '@/hooks/common/use-toast';
import {
  getMoodboardCardByMoodboardId,
  type MoodboardCard as MoodboardCardRecord,
} from '@/config/moodboard-cards';
import type { StyleStack } from '@/types/database';
import { getApiBase } from '@/lib/api-base';
import { resolveGalleryImageUrl } from '@/lib/gallery-asset';
import { usePlaygroundMoodboards } from './hooks/usePlaygroundMoodboards';
import {
  persistShortcutGalleryOrder,
  upsertMoodboardAsShortcut,
} from '@/app/studio/playground/_lib/moodboard-card-gallery';

interface AddToMoodboardMenuProps {
  imagePath: string;
  className?: string;
  label?: string;
  tooltipContent?: string;
  tooltipWithProvider?: boolean;
  moodboardsData?: StyleStack[];
  moodboardCardsData?: MoodboardCardRecord[];
  onRefreshMoodboardCards?: () => Promise<void>;
}

interface AddToMoodboardMenuCoreProps {
  imagePath: string;
  className: string;
  label: string;
  tooltipContent: string;
  tooltipWithProvider: boolean;
  moodboards: StyleStack[];
  moodboardCards: MoodboardCardRecord[];
  refreshMoodboardCards: () => Promise<void>;
}

function AddToMoodboardMenuCore({
  imagePath,
  className,
  label,
  tooltipContent,
  tooltipWithProvider,
  moodboards,
  moodboardCards,
  refreshMoodboardCards,
}: AddToMoodboardMenuCoreProps) {
  const deleteStyle = usePlaygroundStore((state) => state.deleteStyle);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setIsCreating(false);
    setNewName('');
    setNewPrompt('');
    setNewImageFiles([]);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setIsUploading(true);
    try {
      const uploadedPaths = await Promise.all(newImageFiles.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${getApiBase()}/upload`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
        const data = await response.json();
        return String(data.path);
      }));

      const imagePaths = [imagePath, ...uploadedPaths];
      await upsertMoodboardAsShortcut({
        name: newName.trim(),
        prompt: newPrompt,
        imagePaths,
      });
      await refreshMoodboardCards();

      toast({
        title: "已创建情绪板",
        description: `情绪板 ${newName} 已创建并包含当前图片。`,
      });

      handleClose();
    } catch (error) {
      console.error("Upload failed", error);
      toast({
        title: "创建失败",
        description: "图片上传失败，请重试。",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setNewImageFiles(prev => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData.items;
    const files: File[] = [];

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      setNewImageFiles(prev => [...prev, ...files]);
    }
  };

  const handleRemoveNewImage = (index: number) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <div>
            <TooltipButton
              icon={<BookmarkPlus className="w-4 h-4" />}
              label={label}
              tooltipContent={tooltipContent}
              tooltipSide="top"
              className={className}
              withProvider={tooltipWithProvider}
            />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="bg-black/90 border-white/10 backdrop-blur-2xl rounded-2xl p-2 min-w-[180px] max-h-[400px] overflow-y-auto custom-scrollbar">
          <DropdownMenuLabel className="text-white/40 text-[10px] uppercase tracking-wider px-2 py-1">
            选择情绪板
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/5" />

          <DropdownMenuItem
            className="flex items-center gap-3 text-white hover:bg-white/10 rounded-xl cursor-pointer font-medium mb-1"
            onClick={() => {
              setIsOpen(false);
              setIsCreating(true);
            }}
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
              <Plus size={12} className="text-white" />
            </div>
            <span>新建情绪板</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-white/5" />

          <div className="pr-1">
            {moodboards.length > 0 ? (
              moodboards.map((moodboard) => {
                const linkedMoodboardCard = getMoodboardCardByMoodboardId(moodboard.id, moodboardCards);
                const isCurrentImageIncluded = moodboard.imagePaths.includes(imagePath);

                return (
                  <DropdownMenuItem
                    key={moodboard.id}
                    className="flex items-center justify-between gap-3 text-white hover:bg-white/10 rounded-xl cursor-pointer my-0.5"
                    onClick={async () => {
                      try {
                        if (linkedMoodboardCard) {
                          const nextImagePaths = moodboard.imagePaths.includes(imagePath)
                            ? moodboard.imagePaths
                            : [...moodboard.imagePaths, imagePath];
                          await persistShortcutGalleryOrder(linkedMoodboardCard, nextImagePaths);
                          await refreshMoodboardCards();
                        } else {
                          const nextImagePaths = moodboard.imagePaths.includes(imagePath)
                            ? moodboard.imagePaths
                            : [...moodboard.imagePaths, imagePath];
                          await upsertMoodboardAsShortcut({
                            name: moodboard.name,
                            prompt: moodboard.prompt || '',
                            imagePaths: nextImagePaths,
                            sourceStyleId: moodboard.id,
                          });
                          await deleteStyle(moodboard.id);
                          await refreshMoodboardCards();
                        }
                        toast({
                          title: "已添加",
                          description: `已将图片加入情绪板: ${moodboard.name}`,
                        });
                      } catch (error) {
                        console.error('Failed to add image to moodboard', error);
                        toast({
                          title: "添加失败",
                          description: "加入情绪板失败，请重试。",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <div className="min-w-0 flex flex-1 items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70">
                        <BookmarkPlus size={14} />
                      </div>
                      <div className="min-w-0 flex flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-white">
                          {moodboard.name}
                        </span>
                        <span className="truncate text-[11px] text-white/35">
                          {moodboard.imagePaths.length} 张参考图
                        </span>
                      </div>
                    </div>
                    {isCurrentImageIncluded ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#E8FFB7]/20 bg-[#E8FFB7]/10 px-2 py-0.5 text-[10px] font-medium text-[#E8FFB7]">
                        <Check size={12} />
                        已包含
                      </span>
                    ) : null}
                  </DropdownMenuItem>
                );
              })
            ) : (
              <div className="text-white/20 text-xs px-2 py-2 text-center">
                暂无可用情绪板
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isCreating} onOpenChange={(open) => {
        if (!open) {
          handleClose();
        } else {
          setIsCreating(true);
        }
      }}>
        <DialogContent className="max-w-[560px] border-white/10 bg-[#1C1C1C]/60 backdrop-blur-xl p-2 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)] rounded-3xl overflow-hidden">
          <div className="mb-1 relative w-full overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/c.png"
              alt="Moodboard Cover"
              className="h-60 w-full object-cover"
            />
            <div className="absolute top-4 right-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="rounded-full hover:bg-white/25 bg-white/10 backdrop-blur-md"
              >
                <X size={10} className="text-white" />
              </Button>
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-serif text-4xl font-normal text-white ">
                Create Moodboard
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-6 px-6 mt-2 w-full min-w-0">
            <div className="flex flex-col gap-3 w-full min-w-0">
              <label className="ml-1 text-xs font-bold text-white/70">Moodboard Name</label>
              <Input
                placeholder="例如：粘土材质、Lemo 角色"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-white/5 px-3 text-xs placeholder:text-white/40 text-white"
              />
            </div>
            <div className="flex flex-col gap-3 w-full min-w-0">
              <label className="ml-1 text-xs font-bold text-white/70">包含的参考图片</label>
              <div className="flex flex-col gap-2 w-full min-w-0" onPaste={handlePaste} tabIndex={0}>
                <div className="w-full overflow-hidden">
                  <div className="flex gap-2 overflow-x-auto overflow-y-hidden">
                    <button
                      onClick={handleUploadClick}
                      className="flex flex-col h-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-colors focus:outline-none focus:ring-none w-24"
                    >
                      <Plus size={20} className="text-white/40 mb-1" />
                      <span className="text-[10px] text-white/40 text-center leading-tight">
                        点击上传<br />或粘贴
                      </span>
                    </button>

                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveGalleryImageUrl(imagePath) || imagePath}
                        alt="Current preview"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          if (e.currentTarget.src !== imagePath) {
                            e.currentTarget.src = imagePath;
                          }
                        }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[9px] text-white">
                        当前图片
                      </div>
                    </div>

                    {newImageFiles.map((file, index) => (
                      <div key={index} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(file)}
                          alt="preview"
                          className="h-full w-full object-cover"
                        />
                        <button
                          onClick={() => handleRemoveNewImage(index)}
                          className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/80"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full min-w-0">
              <label className="ml-1 text-xs font-bold text-white/70">Prompt (可选)</label>
              <Input
                placeholder="输入 Moodboard prompt 模版..."
                value={newPrompt}
                onChange={(event) => setNewPrompt(event.target.value)}
                className="h-14 rounded-2xl border-white/10 bg-white/5 px-3 text-xs placeholder:text-white/40 text-white"
              />
            </div>
          </div>

          <div className="my-4 flex px-6 py-4 justify-end gap-3">
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || isUploading}
              className="h-12 w-full rounded-2xl bg-white font-bold text-black transition-colors hover:bg-neutral-200"
            >
              {isUploading ? '创建中...' : '确认创建'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddToMoodboardMenuWithInternalMoodboards({
  imagePath,
  className,
  label,
  tooltipContent,
  tooltipWithProvider,
}: {
  imagePath: string;
  className: string;
  label: string;
  tooltipContent: string;
  tooltipWithProvider: boolean;
}) {
  const { moodboards, moodboardCards, refreshMoodboardCards } = usePlaygroundMoodboards();

  return (
    <AddToMoodboardMenuCore
      imagePath={imagePath}
      className={className}
      label={label}
      tooltipContent={tooltipContent}
      tooltipWithProvider={tooltipWithProvider}
      moodboards={moodboards}
      moodboardCards={moodboardCards}
      refreshMoodboardCards={refreshMoodboardCards}
    />
  );
}

export function AddToMoodboardMenu({
  imagePath,
  className = "w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10",
  label = "Add to Moodboard",
  tooltipContent = "添加到情绪板",
  tooltipWithProvider = true,
  moodboardsData,
  moodboardCardsData,
  onRefreshMoodboardCards,
}: AddToMoodboardMenuProps) {
  if (moodboardsData && moodboardCardsData && onRefreshMoodboardCards) {
    return (
      <AddToMoodboardMenuCore
        imagePath={imagePath}
        className={className}
        label={label}
        tooltipContent={tooltipContent}
        tooltipWithProvider={tooltipWithProvider}
        moodboards={moodboardsData}
        moodboardCards={moodboardCardsData}
        refreshMoodboardCards={onRefreshMoodboardCards}
      />
    );
  }

  return (
    <AddToMoodboardMenuWithInternalMoodboards
      imagePath={imagePath}
      className={className}
      label={label}
      tooltipContent={tooltipContent}
      tooltipWithProvider={tooltipWithProvider}
    />
  );
}
