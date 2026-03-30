'use client';

import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Plus, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import {
  getShortcutByMoodboardId,
  type PlaygroundShortcut,
} from '@/config/playground-shortcuts';
import { StyleStackCard } from './StyleStackCard';
import { MoodboardDetailDialog } from './MoodboardDetailDialog';
import { usePlaygroundMoodboards } from './hooks/usePlaygroundMoodboards';

interface StyleStacksViewProps {
  isDragging?: boolean;
  onShortcutQuickApply?: (shortcut: PlaygroundShortcut) => void;
}

export const StyleStacksView: React.FC<StyleStacksViewProps> = ({
  isDragging: isDraggingProp,
  onShortcutQuickApply,
}) => {
  const addStyle = usePlaygroundStore((state) => state.addStyle);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [selectedMoodboardId, setSelectedMoodboardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const {
    shortcuts,
    moodboards,
    refreshShortcuts,
  } = usePlaygroundMoodboards();

  const handleCreate = () => {
    if (!newName.trim()) return;

    void addStyle({
      id: uuidv4(),
      name: newName.trim(),
      prompt: newPrompt,
      imagePaths: [],
      updatedAt: new Date().toISOString(),
    });

    setNewName('');
    setNewPrompt('');
    setIsCreating(false);
  };

  const filteredMoodboards = moodboards.filter((moodboard) => {
    const linkedShortcut = getShortcutByMoodboardId(moodboard.id, shortcuts);
    const searchTarget = [
      moodboard.name,
      moodboard.prompt,
      linkedShortcut?.description,
      linkedShortcut?.detailDescription,
    ].filter(Boolean).join(' ').toLowerCase();

    return searchTarget.includes(searchQuery.toLowerCase());
  });

  const selectedMoodboard = selectedMoodboardId
    ? moodboards.find((moodboard) => moodboard.id === selectedMoodboardId) || null
    : null;
  const selectedShortcut = selectedMoodboard
    ? getShortcutByMoodboardId(selectedMoodboard.id, shortcuts)
    : null;

  return (
    <>
      <div className="relative flex h-full w-full flex-col bg-transparent p-8">
        <AnimatePresence>
          {isDraggingProp ? (
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
                  <span
                    className="flex items-center gap-3 text-3xl text-white"
                    style={{ fontFamily: "'InstrumentSerif', serif" }}
                  >
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

              <AnimatePresence>
                {isCreating ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                    className="flex w-full flex-col gap-6 rounded-2xl border border-white/10 bg-black/20 p-8 backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-bold text-white">创建情绪板</h3>
                        <p className="text-sm text-white/40">手动上传图片或整理 prompt，做成一个可复用的 moodboard group</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCreating(false)}
                        className="rounded-full hover:bg-white/5"
                      >
                        <X size={20} className="text-white/40" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="flex flex-col gap-3">
                        <label className="ml-1 text-xs font-bold uppercase tracking-widest text-white/40">情绪板名称</label>
                        <Input
                          placeholder="例如：春季 campaign、Lemo 角色组"
                          value={newName}
                          onChange={(event) => setNewName(event.target.value)}
                          className="h-14 rounded-2xl border-white/10 bg-white/5 px-6"
                        />
                      </div>
                      <div className="flex flex-col gap-3">
                        <label className="ml-1 text-xs font-bold uppercase tracking-widest text-white/40">当前 Prompt</label>
                        <Input
                          placeholder="输入这个 moodboard 当前要复用的 prompt..."
                          value={newPrompt}
                          onChange={(event) => setNewPrompt(event.target.value)}
                          className="h-14 rounded-2xl border-white/10 bg-white/5 px-6"
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setIsCreating(false)}
                        className="h-12 rounded-xl border border-white/20 bg-transparent px-8 text-white/60 hover:bg-white/5 hover:text-white"
                      >
                        取消
                      </Button>
                      <Button
                        onClick={handleCreate}
                        className="h-12 rounded-xl bg-white px-10 font-bold text-black transition-colors hover:bg-neutral-200"
                      >
                        确认创建
                      </Button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-16 px-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                {filteredMoodboards.map((moodboard) => {
                  const linkedShortcut = getShortcutByMoodboardId(moodboard.id, shortcuts);

                  return (
                    <StyleStackCard
                      key={moodboard.id}
                      style={moodboard}
                      shortcut={linkedShortcut}
                      onClick={() => setSelectedMoodboardId(moodboard.id)}
                      onQuickApplyShortcut={linkedShortcut ? onShortcutQuickApply : undefined}
                      size="sm"
                    />
                  );
                })}

                {filteredMoodboards.length === 0 ? (
                  <div className="col-span-full flex flex-col items-center justify-center rounded-[4rem] border-2 border-dashed border-white/5 bg-white/[0.02] py-32 backdrop-blur-sm">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                      <Palette className="text-white/20" size={40} />
                    </div>
                    <p className="text-lg font-medium text-white/40">
                      {searchQuery ? `未找到匹配 "${searchQuery}" 的情绪板` : '点击上方按钮，开始创建你的第一个 moodboard'}
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
        shortcut={selectedShortcut}
        onShortcutQuickApply={onShortcutQuickApply}
        onShortcutsChange={refreshShortcuts}
      />
    </>
  );
};
