import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Button } from "@/components/ui/button";
import { Settings, LayoutTemplate } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Preset } from './types';
import GradualBlur from "@/components/common/graphics/GradualBlur";

interface PresetGridOverlayProps {
    onOpenManager: () => void;
    onSelectPreset: (preset: Preset) => void;
}

const CATEGORIES = ["All", "Lemo", "Banner", "Illustrator"];

export const PresetGridOverlay: React.FC<PresetGridOverlayProps> = ({ onOpenManager, onSelectPreset }) => {
    const presets = usePlaygroundStore(s => s.presets);
    const [activeCategory, setActiveCategory] = useState("All");

    // Filter logic (mock for now as per instructions, can be expanded later)
    const filteredPresets = presets;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full max-w-4xl mx-auto mt-6 flex flex-col gap-2"
        >
            {/* Header: Tabs & Manager Entry */}
            <div className="flex items-center justify-between ">
                <div className="flex items-center gap-1 bg-black/20 border border-white/10 rounded-full p-1 backdrop-blur-md">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                "px-3 py-2 rounded-full text-xs font-medium transition-all",
                                activeCategory === cat
                                    ? "bg-white text-black shadow-lg"
                                    : "text-white/50 hover:text-white hover:bg-white/10"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenManager}
                    className="text-white/40 hover:text-white hover:bg-white/10 gap-2"
                >
                    <Settings className="w-4 h-4" />
                    <span className="text-xs">Manage Presets</span>
                </Button>
            </div>

            {/* Preset Grid */}
            <div className="bg-black/20 border border-white/10 rounded-3xl p-2 backdrop-blur-xl">
                {filteredPresets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/30 space-y-3">
                        <LayoutTemplate className="w-10 h-10 opacity-50" />
                        <span className="text-sm">No presets available</span>
                        <Button variant="outline" size="sm" onClick={onOpenManager} className="mt-2 border-white/10 bg-white/5 hover:bg-white/10 text-white/60">
                            Create First Preset
                        </Button>
                    </div>
                ) : (
                    <div className="flex gap-2 overflow-x-auto  snap-x scrollbar-hide">
                        {filteredPresets.map(preset => (
                            <button
                                key={preset.id}
                                className="group relative flex flex-col items-start rounded-2xl overflow-hidden bg-transparent   min-w-[160px] w-[160px] snap-start"
                                onClick={() => onSelectPreset(preset)}
                            >
                                <div className="relative w-full aspect-[1/1] bg-white/5">
                                    {preset.cover ? (
                                        <Image src={preset.cover} alt={preset.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/20">
                                            <LayoutTemplate className="w-6 h-6" />
                                        </div>
                                    )}
                                    
                                    
                                    <div className="absolute inset-0 flex items-start justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                                         <span className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-xs font-medium text-white">
                                            Apply
                                        </span>
                                    </div>
                                     
                                    {/* Title with Gradual Blur */}
                                    <div className="absolute inset-x-0 bottom-0">
                                        <div className="absolute inset-0 pointer-events-none">
                                            <GradualBlur 
                                                position="bottom" 
                                                height="100%"
                                                strength={2} 
                                                opacity={1}
                                                visibleColor="black"
                                                zIndex={1}
                                            />
                                        </div>
                                        <div className="relative flex flex-col items-center p-3 pt-6 z-10">
                                            <h3 className="text-sm font-medium text-white">{preset.title}</h3>
                                            <p className="text-[10px] text-white/70 ">{preset.base_model}</p>
                                           
                                        </div>
                                    </div>
                                </div>
                               
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
};
