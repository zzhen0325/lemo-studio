import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Button } from "@/components/ui/button";
import { Settings, LayoutTemplate } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Preset } from './types';

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
            className="w-full mt-6 flex flex-col gap-4"
        >
            {/* Header: Tabs & Manager Entry */}
            <div className="flex items-center justify-between px-4">
                <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-full p-1 backdrop-blur-md">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                "px-4 py-1.5 rounded-full text-xs font-medium transition-all",
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
            <div className="bg-black/20 border border-white/10 rounded-3xl p-6 backdrop-blur-xl">
                {filteredPresets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-white/30 space-y-3">
                        <LayoutTemplate className="w-10 h-10 opacity-50" />
                        <span className="text-sm">No presets available</span>
                        <Button variant="outline" size="sm" onClick={onOpenManager} className="mt-2 border-white/10 bg-white/5 hover:bg-white/10 text-white/60">
                            Create First Preset
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredPresets.map(preset => (
                            <button
                                key={preset.id}
                                className="group relative flex flex-col items-start rounded-2xl overflow-hidden bg-black/40 border border-white/10 hover:border-white/30 transition-all text-left hover:shadow-xl hover:-translate-y-1 duration-300"
                                onClick={() => onSelectPreset(preset)}
                            >
                                <div className="relative w-full aspect-[3/2] bg-white/5">
                                    {preset.cover ? (
                                        <Image src={preset.cover} alt={preset.title} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white/20">
                                            <LayoutTemplate className="w-6 h-6" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                    
                                    {/* Quick Apply Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <span className="bg-white/10 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full text-xs font-medium text-white">
                                            Apply
                                        </span>
                                    </div>
                                </div>
                                <div className="p-3 w-full bg-white/[0.02] group-hover:bg-white/[0.05] transition-colors">
                                    <h3 className="text-sm font-medium text-white/90 truncate">{preset.title}</h3>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                                            <p className="text-[10px] text-white/40 truncate max-w-[80px]">{preset.base_model}</p>
                                        </div>
                                        <span className="text-[10px] text-white/30 font-mono bg-white/5 px-1.5 py-0.5 rounded">{preset.width}x{preset.height}</span>
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
