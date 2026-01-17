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


interface StyleStacksViewProps {
    isDragging?: boolean;
}

export const StyleStacksView: React.FC<StyleStacksViewProps> = ({ isDragging: isDraggingProp }) => {
    const { styles, initStyles, addStyle, applyPrompt } = usePlaygroundStore();
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrompt, setNewPrompt] = useState('');
    const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        initStyles();
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

    const filteredStyles = styles.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.prompt || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (selectedStyleId) {
        const selectedStyle = styles.find(s => s.id === selectedStyleId);
        if (selectedStyle) {
            return (
                <StyleDetailView
                    style={selectedStyle}
                    onBack={() => setSelectedStyleId(null)}
                    onApply={applyPrompt}
                />
            );
        }
    }

    return (
        <div className="w-full h-full p-8 pt-16 bg-transparent flex flex-col relative">
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
                                <h3 className="text-2xl font-bold text-white">松开以创建新风格</h3>
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
                                <h2 className="text-3xl font-instrument-sans text-white flex items-center gap-3">
                                    Moodboards
                                </h2>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <Input
                                        placeholder="搜索风格或提示词..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-64 bg-white/5 border-white/10 rounded-full pl-6 pr-10 focus:bg-white/10 focus:border-purple-500/50 transition-all text-sm h-10"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-purple-400 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setIsCreating(true)}
                                    className="rounded-full px-6 bg-primary hover:bg-white text-black gap-2 h-10 shadow-lg shadow-purple-900/20 border border-purple-400/20"
                                >
                                    <Plus size={18} />
                                    创建新风格
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
                                            <h3 className="text-2xl font-bold text-white">定义新风格</h3>
                                            <p className="text-white/40 text-sm">为你的风格堆叠设置一个响亮的名称和核心提示词</p>
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
                                            <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-widest">风格名称</label>
                                            <Input
                                                placeholder="例如：赛博朋克深红"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="bg-white/5 border-white/10 rounded-2xl h-14 px-6  "
                                            />
                                        </div>
                                        <div className="flex flex-col gap-3">
                                            <label className="text-xs font-bold text-white/40 ml-1 uppercase tracking-widest">关联提示词 (Prompt)</label>
                                            <Input
                                                placeholder="输入该风格的核心 prompt..."
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

                        {/* Grid of Styles */}
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
                                        {searchQuery ? `未找到匹配 "${searchQuery}" 的风格` : "点击上方按钮，开始构建您的第一个风格堆叠"}
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
