'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { StyleStack } from './types';
import { Plus, Sparkles, Trash2, Edit3, Settings2 } from 'lucide-react';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/common/use-toast';
import { formatImageUrl } from '@/lib/api-base';
import { useImageSource } from '@/hooks/common/use-image-source';
import {
    buildShortcutPrompt,
    createShortcutPromptValues,
    getShortcutByMoodboardId,
} from '@/config/playground-shortcuts';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StyleStackCardProps {
    style: StyleStack;
    onClick?: () => void;
    size?: 'sm' | 'md' | 'grid-lg';
}

const StyleCardImage = ({ path }: { path: string }) => {
    const src = useImageSource(path);
    return (
        <NextImage
            src={src || formatImageUrl(path)}
            alt="Style image"
            fill
            className="object-cover group-hover:scale-110 transition-transform duration-700"
            unoptimized={path.startsWith('local:')}
        />
    );
};

export const StyleStackCard: React.FC<StyleStackCardProps> = ({
    style,
    onClick,
    size = 'md'
}) => {
    const { applyPrompt, deleteStyle } = usePlaygroundStore();
    const { toast } = useToast();
    const isSmall = size === 'sm';
    const isGridLg = size === 'grid-lg';
    const [isExpanded, setIsExpanded] = useState(false);
    const linkedShortcut = getShortcutByMoodboardId(style.id);
    const promptTemplate = linkedShortcut
        ? buildShortcutPrompt(linkedShortcut, createShortcutPromptValues(linkedShortcut))
        : '';
    const quickApplyPrompt = style.prompt.trim() || promptTemplate;

    // Get up to 3 images for the stack
    const displayImages = style.imagePaths.slice(-3).reverse();

    // Fallback if no images
    const hasImages = displayImages.length > 0;

    return (
        <div
            className={cn(
                "group relative flex flex-col gap-4 p-4 rounded-[2rem] transition-all cursor-pointer",
                isGridLg && "hover:bg-white/5"
            )}
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            onClick={onClick}
        >
            {/* Quick Actions Hover Buttons */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:-translate-y-1 z-[30] pointer-events-auto">
                <Button
                    size="sm"
                    disabled={!quickApplyPrompt}
                    className="rounded-full bg-neutral-900/90 backdrop-blur-xl border border-white/10 text-white hover:bg-neutral-800 hover:border-[#E8FFB7]/40 gap-1 h-7 px-3 shadow-2xl transition-all active:scale-95 group/btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!quickApplyPrompt) return;
                        applyPrompt(quickApplyPrompt);
                        toast({
                            title: "已快速应用",
                            description: `${style.name} 的 prompt 已应用到输入框`,
                        });
                    }}
                >
                    <Sparkles size={12} className="text-[#E8FFB7] group-hover/btn:animate-pulse" />
                    <span className="text-[10px] font-bold tracking-wider">快速应用</span>
                </Button>
            </div>

            {/* Management Menu */}
            <div className="absolute top-2 right-2 z-[40] opacity-0 group-hover:opacity-100 transition-opacity">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded-full bg-neutral-900/50 backdrop-blur-md border border-white/10 text-white/40 hover:text-white hover:bg-neutral-800"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <Settings2 size={12} />
                        </Button>
                    </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32 bg-neutral-900/90 border-white/10 backdrop-blur-xl rounded-xl">
                            <DropdownMenuItem
                                className="gap-2 text-white/70 focus:text-white focus:bg-white/10 rounded-lg cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClick?.(); // Open detail which serves as edit
                            }}
                            >
                                <Edit3 size={14} />
                                管理
                            </DropdownMenuItem>
                            {!linkedShortcut && (
                                <DropdownMenuItem
                                    className="gap-2 text-red-400 focus:text-red-300 focus:bg-red-400/10 rounded-lg cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm('确定要删除这个情绪板吗？')) {
                                            deleteStyle(style.id);
                                        }
                                    }}
                                >
                                    <Trash2 size={14} />
                                    删除
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

            {/* Image Stack Container */}
            <div className={cn(
                "relative w-full flex items-center justify-center perspective-1000",
                isSmall ? "h-[70px] [@media(max-height:850px)]:h-[50px] [@media(max-height:750px)]:h-[40px]" : "h-[200px]",
                isGridLg && "h-[220px]"
            )}>
                {hasImages ? (
                    displayImages.map((path, index) => (
                        <motion.div
                            key={path}
                            className={cn(
                                "absolute rounded-xl overflow-hidden border-1 border-white/20  bg-neutral-900 shadow-xl",
                                isSmall ? "w-14 h-[70px] [@media(max-height:850px)]:h-[50px] [@media(max-height:850px)]:w-10 [@media(max-height:750px)]:h-[40px] [@media(max-height:750px)]:w-8" : "w-40 h-[200px]",
                                isGridLg && "w-[180px] h-[220px]"
                            )}
                            initial={false}
                            animate={{
                                x: isExpanded
                                    ? (index - (displayImages.length - 1) / 2) * (isSmall ? 50 : isGridLg ? 110 : 160)
                                    : (index - (displayImages.length - 1) / 2) * (isSmall ? 15 : isGridLg ? 35 : 50),
                                y: isExpanded ? (isSmall ? -5 : -20) : index * -2,
                                rotate: isExpanded ? (index - (displayImages.length - 1) / 2) * 10 : (index - (displayImages.length - 1) / 2) * 5,
                                zIndex: 10 - index,
                            }}
                            transition={{
                                type: 'spring',
                                stiffness: 400,
                                damping: 25,
                                mass: 1.2
                            }}
                        >
                            <StyleCardImage path={path} />
                        </motion.div>
                    ))
                ) : (
                    <div className={cn(
                        "rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-1 text-white/40 bg-white/5 transition-all duration-300",
                        isSmall ? "w-14 h-14 [@media(max-height:850px)]:w-10 [@media(max-height:850px)]:h-10 [@media(max-height:750px)]:w-8 [@media(max-height:750px)]:h-8" : "w-40 h-40",
                        isGridLg && "w-[180px] h-[220px]"
                    )}>
                        <Plus size={isSmall ? 12 : 24} />
                        <span className="text-[8px] [@media(max-height:850px)]:hidden">暂无图片</span>
                    </div>
                )}


            </div>

            {/* Info & Actions */}
            <div className="flex flex-col gap-0.5">
                <div className="flex flex-col items-center justify-center">
                    <div className="flex items-center justify-center gap-1 w-full">
                        <h3 className={cn(
                            "font-semibold text-white truncate max-w-full text-center transition-all duration-300",
                            isSmall ? "text-xs [@media(max-height:850px)]:text-[10px]" : "text-lg",
                            isGridLg && "text-xl mt-2"
                        )}>{style.name}</h3>
                    </div>
                    <p className={cn(
                        "text-white/50 line-clamp-1 w-full text-center transition-all duration-300",
                        isSmall ? "text-[8px] min-h-[0.75rem] [@media(max-height:850px)]:hidden" : "text-sm min-h-[2.5rem]"
                    )}>
                        {style.prompt || linkedShortcut?.description || "未设置提示词"}
                    </p>
                </div>

            </div>


            {/* Float Action Button */}

        </div>
    );
};
