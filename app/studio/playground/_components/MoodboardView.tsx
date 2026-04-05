'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Plus, Upload, X } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getApiBase } from '@/lib/api-base';
import {
  getMoodboardCardByMoodboardId,
  type MoodboardCard as MoodboardCardRecord,
} from '@/config/moodboard-cards';
import { upsertMoodboardAsShortcut } from '@/app/studio/playground/_lib/moodboard-card-gallery';
import { MoodboardCard } from './MoodboardCard';
import { MoodboardDetailDialog } from './MoodboardDetailDialog';
import { usePlaygroundMoodboards } from './hooks/usePlaygroundMoodboards';
import type { StyleStack } from '@/types/database';

interface MoodboardViewProps {
  isDragging?: boolean;
  onShortcutQuickApply?: (moodboardCard: MoodboardCardRecord) => void;
  onMoodboardApply?: () => void;
}

interface SortableMoodboardCardProps {
  moodboard: StyleStack;
  linkedMoodboardCard: MoodboardCardRecord | null;
  disabled: boolean;
  onOpen: () => void;
  onQuickApplyShortcut?: (moodboardCard: MoodboardCardRecord) => void;
  onMoodboardApply?: () => void;
}

function SortableMoodboardCard({
  moodboard,
  linkedMoodboardCard,
  disabled,
  onOpen,
  onQuickApplyShortcut,
  onMoodboardApply,
}: SortableMoodboardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: moodboard.id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MoodboardCard
        style={moodboard}
        shortcut={linkedMoodboardCard}
        onClick={onOpen}
        onQuickApplyShortcut={linkedMoodboardCard ? onQuickApplyShortcut : undefined}
        onMoodboardApply={onMoodboardApply}
        size="sm"
      />
    </div>
  );
}

export const MoodboardView: React.FC<MoodboardViewProps> = ({
  isDragging: isDraggingProp,
  onShortcutQuickApply,
  onMoodboardApply,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPersistingSort, setIsPersistingSort] = useState(false);
  const [orderedMoodboards, setOrderedMoodboards] = useState<StyleStack[] | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedMoodboardId, setSelectedMoodboardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    moodboardCards,
    moodboards,
    refreshMoodboardCards,
    isLoadingMoodboardCards,
  } = usePlaygroundMoodboards();

  React.useEffect(() => {
    setOrderedMoodboards(null);
  }, [moodboards]);

  const baseMoodboards = orderedMoodboards || moodboards;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      const imagePaths = await Promise.all(newImageFiles.map(async (file) => {
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

      await upsertMoodboardAsShortcut({
        name: newName.trim(),
        prompt: newPrompt,
        imagePaths,
      });
      await refreshMoodboardCards();

      handleClose();
    } catch (error) {
      console.error('Upload failed', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragEnd = React.useCallback(async (event: DragEndEvent) => {
    if (searchQuery.trim() || isPersistingSort) {
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = baseMoodboards.findIndex((item) => item.id === String(active.id));
    const newIndex = baseMoodboards.findIndex((item) => item.id === String(over.id));

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reordered = arrayMove(baseMoodboards, oldIndex, newIndex);
    setOrderedMoodboards(reordered);

    const orders = reordered
      .map((item, index) => {
        const linkedMoodboardCard = getMoodboardCardByMoodboardId(item.id, moodboardCards);
        if (!linkedMoodboardCard?.persistedId) {
          return null;
        }

        return {
          id: linkedMoodboardCard.persistedId,
          sortOrder: index,
        };
      })
      .filter((item): item is { id: string; sortOrder: number } => Boolean(item));

    if (orders.length === 0) {
      return;
    }

    setIsPersistingSort(true);
    try {
      const response = await fetch(`${getApiBase()}/moodboard-cards/sort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orders }),
      });

      if (!response.ok) {
        throw new Error(`Sort update failed: ${response.status}`);
      }

      await refreshMoodboardCards();
    } catch (error) {
      console.error('[MoodboardView] Failed to persist moodboard order', error);
      setOrderedMoodboards(null);
    } finally {
      setIsPersistingSort(false);
    }
  }, [baseMoodboards, isPersistingSort, moodboardCards, refreshMoodboardCards, searchQuery]);

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

  const filteredMoodboards = React.useMemo(() => {
    const normalizedQuery = searchQuery.toLowerCase();
    return baseMoodboards.filter((moodboard) => {
      const linkedMoodboardCard = getMoodboardCardByMoodboardId(moodboard.id, moodboardCards);
      const searchTarget = [
        moodboard.name,
        moodboard.prompt,
        linkedMoodboardCard?.description,
        linkedMoodboardCard?.detailDescription,
      ].filter(Boolean).join(' ').toLowerCase();

      return searchTarget.includes(normalizedQuery);
    });
  }, [baseMoodboards, moodboardCards, searchQuery]);

  const selectedMoodboard = selectedMoodboardId
    ? baseMoodboards.find((moodboard) => moodboard.id === selectedMoodboardId) || null
    : null;
  const selectedMoodboardCard = selectedMoodboard
    ? getMoodboardCardByMoodboardId(selectedMoodboard.id, moodboardCards)
    : null;

  return (
    <>
      <div className="relative flex h-full w-full flex-col bg-transparent p-8">
        <AnimatePresence>
          {isDraggingProp && !selectedMoodboard && !isCreating ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 z-50 m-4 flex flex-col items-center justify-center rounded-[3rem] border-4 border-dashed border-purple-400/50 bg-purple-600/20 backdrop-blur-md"
            >
              <div className="flex flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-neutral-900/80 p-10 shadow-2xl">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary animate-bounce">
                  <Upload size={40} className="text-white" />
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white">松开以创建新情绪板</h3>
                  <p className="text-white/60">支持多张图片同时上传</p>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="custom-scrollbar min-h-0 w-full flex-1 overflow-y-auto">
            <div className="flex w-full flex-col gap-8 pb-10">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <span className="flex items-center gap-3 font-serif text-3xl text-white">
                    Moodboards
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="group relative">
                    <Input
                      placeholder="搜索情绪板或提示词..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="h-10 w-64 rounded-2xl border-white/10 bg-white/5 pl-4 pr-10 text-sm transition-all focus:border-purple-500/50 focus:bg-white/10"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 transition-colors group-focus-within:text-purple-400">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsCreating(true)}
                    className="h-10 gap-2 rounded-2xl border border-white/10 bg-primary px-4 text-black hover:bg-white"
                  >
                    <Plus size={18} />
                    New Moodboard
                  </Button>
                </div>
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={searchQuery.trim() ? [] : filteredMoodboards.map((moodboard) => moodboard.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-16 px-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                    {filteredMoodboards.map((moodboard) => {
                      const linkedMoodboardCard = getMoodboardCardByMoodboardId(moodboard.id, moodboardCards);

                      return (
                        <SortableMoodboardCard
                          key={moodboard.id}
                          moodboard={moodboard}
                          linkedMoodboardCard={linkedMoodboardCard}
                          disabled={Boolean(searchQuery.trim()) || isPersistingSort}
                          onOpen={() => setSelectedMoodboardId(moodboard.id)}
                          onQuickApplyShortcut={onShortcutQuickApply}
                          onMoodboardApply={onMoodboardApply}
                        />
                      );
                    })}

                    {filteredMoodboards.length === 0 ? (
                      <div className="col-span-full flex flex-col items-center justify-center rounded-[4rem] border-2 border-dashed border-white/5 bg-white/[0.02] py-32 backdrop-blur-sm">
                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                          <Palette className="text-white/20" size={40} />
                        </div>
                        <p className="text-lg font-medium text-white/40">
                          {isLoadingMoodboardCards && !searchQuery
                            ? 'Moodboard 加载中...'
                            : (searchQuery
                              ? `未找到匹配 "${searchQuery}" 的情绪板`
                              : '点击上方按钮，开始创建你的第一个 moodboard')}
                        </p>
                        {searchQuery ? (
                          <Button
                            variant="link"
                            onClick={() => setSearchQuery('')}
                            className="mt-2 text-purple-400"
                          >
                            清除搜索
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      </div>

      <MoodboardDetailDialog
        open={Boolean(selectedMoodboard)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setSelectedMoodboardId(null);
          }
        }}
        moodboard={selectedMoodboard}
        shortcut={selectedMoodboardCard}
        onShortcutQuickApply={onShortcutQuickApply}
        onMoodboardApply={onMoodboardApply}
        onShortcutsChange={refreshMoodboardCards}
      />

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
                className="rounded-full hover:bg-white/25  bg-white/10  backdrop-blur-md "
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
              <label className="ml-1 text-xs font-bold  text-white/70">Moodboard Name</label>
              <Input
                placeholder="例如：粘土材质、Lemo 角色"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-white/5 px-3 text-xs placeholder:text-white/40 text-white"
              />
            </div>
            <div className="flex flex-col gap-3 w-full min-w-0">
              <label className="ml-1 text-xs font-bold  text-white/70">上传参考图片 (可选)</label>
              <div className="flex flex-col gap-2 w-full min-w-0" onPaste={handlePaste} tabIndex={0}>
                <div className="w-full overflow-hidden">
                  <div className="flex gap-2 overflow-x-auto  overflow-y-hidden ">
                    <button
                      onClick={handleUploadClick}
                      className={`flex flex-col h-24 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 transition-colors focus:outline-none  focus:ring-none ${
                        newImageFiles.length === 0 ? 'w-full' : 'w-24'
                      }`}
                    >
                      <Plus size={20} className="text-white/40 mb-1" />
                      <span className="text-sm text-white/40 text-center leading-tight">
                        {newImageFiles.length === 0 ? '点击上传或直接粘贴图片' : <>点击上传<br />或粘贴</>}
                      </span>
                    </button>
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
              <label className="ml-1 text-xs font-bold  text-white/70">Prompt</label>
              <Input
                placeholder="输入 Moodboard prompt 模版..."
                value={newPrompt}
                onChange={(event) => setNewPrompt(event.target.value)}
                className="h-12 rounded-2xl border-white/10 bg-white/5 px-3 text-xs placeholder:text-white/40 text-white"
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={isUploading || !newName.trim()}
              className="h-12 rounded-2xl bg-white text-black hover:bg-white/90 disabled:opacity-50"
            >
              {isUploading ? '上传中...' : '保存 Moodboard'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
