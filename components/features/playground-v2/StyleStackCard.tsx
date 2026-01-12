'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { StyleStack } from './types';
import { Plus, Sparkles, Image as ImageIcon } from 'lucide-react';
import NextImage from 'next/image';
import { cn } from '@/lib/utils';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Button } from '@/components/ui/button';

interface StyleStackCardProps {
    style: StyleStack;
    onClick?: () => void;
    size?: 'sm' | 'md';
}

export const StyleStackCard: React.FC<StyleStackCardProps> = ({
    style,
    onClick,
    size = 'md'
}) => {
    const { applyPrompt, applyImage } = usePlaygroundStore();
    const isSmall = size === 'sm';
    const [isExpanded, setIsExpanded] = useState(false);

    // Get up to 3 images for the stack
    const displayImages = style.imagePaths.slice(-3).reverse();

    // Fallback if no images
    const hasImages = displayImages.length > 0;

    return (
        <div
            className="group relative flex flex-col gap-4 p-4 rounded-[2rem] transition-all cursor-pointer"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            onClick={onClick}
        >
            {/* Quick Actions Hover Buttons */}
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:-translate-y-2 z-[30] pointer-events-auto">
                <Button
                    size="sm"
                    className="rounded-full bg-neutral-900/80 backdrop-blur-xl border border-white/10 text-white hover:bg-neutral-800 hover:border-white/30 gap-1.5 h-8 px-3 shadow-2xl transition-all active:scale-95"
                    onClick={(e) => {
                        e.stopPropagation();
                        applyPrompt(style.prompt);
                    }}
                >
                    <Sparkles size={12} className="text-purple-400" />
                    <span className="text-[10px] uppercase tracking-wider font-bold">Use Prompt</span>
                </Button>
                {style.imagePaths.length > 0 && (
                    <Button
                        size="sm"
                        className="rounded-full bg-neutral-900/80 backdrop-blur-xl border border-white/10 text-white hover:bg-neutral-800 hover:border-white/30 gap-1.5 h-8 px-3 shadow-2xl transition-all active:scale-95"
                        onClick={(e) => {
                            e.stopPropagation();
                            applyImage(style.imagePaths[0]);
                        }}
                    >
                        <ImageIcon size={12} className="text-blue-400" />
                        <span className="text-[10px] uppercase tracking-wider font-bold">Use Image</span>
                    </Button>
                )}
            </div>

            {/* Image Stack Container */}
            <div className={cn(
                "relative w-full flex items-center justify-center perspective-1000",
                isSmall ? "h-[140px]" : "h-[200px]"
            )}>
                {hasImages ? (
                    displayImages.map((path, index) => (
                        <motion.div
                            key={path}
                            className={cn(
                                "absolute rounded-2xl overflow-hidden border-1 border-white/20  bg-neutral-900",
                                isSmall ? "w-28 h-[140px]" : "w-40 h-[200px]"
                            )}
                            initial={false}
                            animate={{
                                x: isExpanded ? (index - (displayImages.length - 1) / 2) * (isSmall ? 100 : 160) : (index - (displayImages.length - 1) / 2) * (isSmall ? 30 : 50),
                                y: isExpanded ? (isSmall ? -10 : -20) : index * -4,
                                rotate: isExpanded ? (index - (displayImages.length - 1) / 2) * 10 : (index - (displayImages.length - 1) / 2) * 5,
                                zIndex: 10 - index,
                            }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        >
                            <NextImage
                                src={path}
                                alt={`Style thumb ${index}`}
                                fill
                                className="object-cover"
                                sizes="160px"
                            />
                        </motion.div>
                    ))
                ) : (
                    <div className={cn(
                        "rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-white/40 bg-white/5",
                        isSmall ? "w-28 h-28" : "w-40 h-40"
                    )}>
                        <Plus size={isSmall ? 18 : 24} />
                        <span className="text-xs">暂无图片</span>
                    </div>
                )}


            </div>

            {/* Info & Actions */}
            <div className="flex flex-col gap-1">
                <div className="flex flex-col items-center justify-center">
                    <h3 className={cn(
                        "font-semibold text-white truncate w-full text-center",
                        isSmall ? "text-base" : "text-lg"
                    )}>{style.name}</h3>
                    <p className={cn(
                        "text-white/50 line-clamp-2 w-full text-center",
                        isSmall ? "text-[10px] min-h-[1.5rem]" : "text-sm min-h-[2.5rem]"
                    )}>
                        {style.prompt || "未设置提示词"}
                    </p>
                </div>

            </div>


            {/* Float Action Button */}

        </div>
    );
};
