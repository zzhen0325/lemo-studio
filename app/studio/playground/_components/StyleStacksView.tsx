'use client';

import React, { useEffect, useState } from 'react';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { StyleStackCard } from './StyleStackCard';
import { StyleDetailView } from './StyleDetailView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Upload, Palette } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { mergeShortcutMoodboards } from '@/config/playground-shortcuts';


interface StyleStacksViewProps {
    isDragging?: boolean;
}

export const StyleStacksView: React.FC<StyleStacksViewProps> = ({ isDragging: isDraggingProp }) => {
    const { styles, initStyles, addStyle } = usePlaygroundStore();
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrompt, setNewPrompt] = useState('');
    const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        void initStyles();
    }, [initStyles]);

    const handleCreate = () => {
        if (!newName.trim()) return;

        addStyle({
            id: uuidv4(),
            name: newName,
            prompt: newPrompt,
            imagePaths: [],
            updatedAt: new Date().toISOString()
        });

        setNewName('');
        setNewPrompt('');
        setIsCreating(false);
    };

    const moodboards = React.useMemo(() => mergeShortcutMoodboards(styles), [styles]);

    const filteredStyles = moodboards.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.prompt || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedStyleId) {
        const selectedStyle = moodboards.find(s => s.id === selectedStyleId);
        if (selectedStyle) {
            return (
                <StyleDetailView
                    style={selectedStyle}
                    onBack={() => setSelectedStyleId(null)}
                />
            );
        }
    }

    return (
        <div className="w-full h-full p-8  bg-transparent flex flex-col relative">
            <AnimatePresence>
                {isDraggingProp && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-purple-600/20 backdrop-blur-md border-4 border-dashed border-purple-400/50 m-4 rounded-[3rem] pointer-events-none"
                    >
                        <div className="flex flex-col items-center gap-4 bg-neutral-900/80 p-10 rounded-[2rem] shadow-2xl border border-white/10">
                            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center animate-bounce">
                                <Upload size={40} className="text-white" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-2xl font-bold text-white">松开以创建新情绪板</h3>
                                <p className="text-white/60">支持多张图片同时上传</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-1 overflow-hidden min-h-0">
                <div className="flex-1 w-full min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col gap-8 w-full pb-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <span className="text-3xl font-instrument-sans text-white flex items-center gap-3"
                                style={{ fontFamily: "'InstrumentSerif', serif" }}>
                                    Moodboards
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <Input
                                        placeholder="搜索情绪板或提示词..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-64 bg-white/5 border-white/10 rounded-2xl pl-4 pr-10 focus:bg-white/10 focus:border-purple-500/50 transition-all text-sm h-10"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-purple-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setIsCreating(true)}
                                    className="rounded-2xl px-4 bg-primary hover:bg-white text-black gap-2 h-10  border border-white/10"
                                >
                                    <Plus size={18} />
                                    New Moodboard
                                </Button>
                            </div>
                        </div>

                        {/* Creation Dialog/Panel */}
                        <AnimatePresence>
                            {isCreating && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -20 }}
                                    className="p-8  w-full  rounded-2xl bg-black/20 border border-white/10 backdrop-blur-xl  flex flex-col gap-6"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <h3 className="text-2xl font-bold text-white">创建情绪板</h3>
                                            <p className="text-white/40 text-sm">手动上传图片或整理 prompt，做成一个可复用的 moodboard group</p>
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
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="flex flex-col gap-3">
                                            <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-widest">情绪板名称</label>
                                            <Input
                                                placeholder="例如：春季 campaign、Lemo 角色组"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="bg-white/5 border-white/10 rounded-2xl h-14 px-6  "
                                            />
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-widest">当前 Prompt</label>
                                            <Input
                                                placeholder="输入这个 moodboard 当前要复用的 prompt..."
                                                value={newPrompt}
                                                onChange={(e) => setNewPrompt(e.target.value)}
                                                className="bg-white/5 border-white/10 rounded-2xl h-14 px-6 "
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 justify-end mt-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => setIsCreating(false)}
                                            className="rounded-xl px-8 bg-transparent h-12 border border-white/20 text-white/60 hover:text-white hover:bg-white/5"
                                        >
                                            取消
                                        </Button>
                                        <Button
                                            onClick={handleCreate}
                                            className="rounded-xl px-10 h-12 bg-white text-black hover:bg-neutral-200 transition-colors font-bold"
                                        >
                                            确认创建
                                        </Button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Grid of Moodboards */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-4 gap-y-16 px-4">
                            {filteredStyles.map((style) => (
                                <StyleStackCard
                                    key={style.id}
                                    style={style}
                                    onClick={() => setSelectedStyleId(style.id)}
                                    size="sm"
                                />
                            ))}

                            {filteredStyles.length === 0 && (
                                <div className="col-span-full py-32 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[4rem] bg-white/[0.02] backdrop-blur-sm">
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                        <Palette className="text-white/20" size={40} />
                                    </div>
                                    <p className="text-white/40 text-lg font-medium">
                                        {searchQuery ? `未找到匹配 "${searchQuery}" 的情绪板` : "点击上方按钮，开始创建你的第一个 moodboard"}
                                    </p>
                                    {searchQuery && (
                                        <Button
                                            variant="link"
                                            onClick={() => setSearchQuery('')}
                                            className="text-purple-400 mt-2"
                                        >
                                            清除搜索
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
