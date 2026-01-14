'use client';

import React, { useEffect, useState } from 'react';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { StyleStackCard } from './StyleStackCard';
import { StyleDetailView } from './StyleDetailView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Upload } from 'lucide-react';
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
                            <div className="w-20 h-20 rounded-full bg-purple-600 flex items-center justify-center animate-bounce">
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
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-bold text-white flex items-center gap-3">
                                   
                                    Moodboards
                                </h2>
                               
                            </div>

                            <Button
                                onClick={() => setIsCreating(true)}
                                className="rounded-full px-6 bg-white text-black hover:bg-white/90 gap-2"
                            >
                                <Plus size={18} />
                                创建新风格
                            </Button>
                        </div>

                        {/* Creation Dialog/Panel */}
                        <AnimatePresence>
                            {isCreating && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-2xl flex flex-col gap-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-semibold text-white">定义新风格</h3>
                                        <Button variant="ghost" size="icon" onClick={() => setIsCreating(false)}>
                                            <X size={20} />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm text-white/60 ml-1">风格名称</label>
                                            <Input
                                                placeholder="例如：赛博朋克深红"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                className="bg-white/5 border-white/10 rounded-xl h-12"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm text-white/60 ml-1">关联提示词 (Prompt)</label>
                                            <Input
                                                placeholder="输入该风格的核心 prompt..."
                                                value={newPrompt}
                                                onChange={(e) => setNewPrompt(e.target.value)}
                                                className="bg-white/5 border-white/10 rounded-xl h-12"
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleCreate}
                                        className="w-full md:w-40 self-end rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                                    >
                                        确认创建
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Grid of Styles */}
                        <div className=" mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-x-2 gap-y-12 px-4">
                            {styles.map((style) => (
                                <StyleStackCard
                                    key={style.id}
                                    style={style}
                                    onClick={() => setSelectedStyleId(style.id)}
                                    size="sm"
                                />
                            ))}

                            {styles.length === 0 && !isCreating && (
                                <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
                                    <p className="text-white/20 text-md italic">点击上方按钮，开始构建您的第一个风格堆叠</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
