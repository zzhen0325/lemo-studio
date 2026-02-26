'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DescriptionCardsViewProps {
    descriptions: string[];
    onApply: (text: string) => void;
}

export const DescriptionCardsView: React.FC<DescriptionCardsViewProps> = ({
    descriptions,
    onApply
}) => {
    return (
        <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">AI Descriptions</h3>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {descriptions.map((desc, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group relative bg-white/5 border border-white/10 rounded-2xl p-4 hover:bg-white/10 transition-all cursor-default"
                    >
                        <p className="text-sm text-white/80 leading-relaxed mb-4 line-clamp-6">
                            {desc}
                        </p>

                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 gap-1.5 px-3 opacity-0 group-hover:opacity-100 transition-all"
                                onClick={() => onApply(desc)}
                            >
                                <span className="text-[10px] font-bold uppercase">Apply</span>
                                <ArrowRight className="w-3 h-3" />
                            </Button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};
