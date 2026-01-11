import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Settings } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PresetExtended } from './types';

interface PresetGridOverlayProps {
    onOpenManager: () => void;
    onSelectPreset: (preset: PresetExtended) => void;
    externalPresets?: PresetExtended[];
}

export const PresetGridOverlay: React.FC<PresetGridOverlayProps> = ({ onOpenManager, onSelectPreset, externalPresets }) => {
    const storePresets = usePlaygroundStore(s => s.presets);
    const presetCategories = usePlaygroundStore(s => s.presetCategories);
    const CATEGORIES = ["All", ...presetCategories];
    const presets = (externalPresets || storePresets) as PresetExtended[];
    const [activeCategory, setActiveCategory] = useState("All");
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filter logic
    const filteredPresets = activeCategory === "All"
        ? presets
        : presets.filter(p => (p.category || 'General') === activeCategory);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="w-full mt-6 flex flex-col gap-2"
        >
            {/* Header: Tabs & Manager Entry */}
            <div className="flex items-center justify-between bg-black/20 border  border-white/10 rounded-2xl p-1 backdrop-blur-md">
                <div className="flex items-center gap-1 ">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                "px-3 py-2 rounded-xl text-xs font-medium transition-all",
                                activeCategory === cat
                                    ? "bg-white/20 text-white"
                                    : "text-white/50 hover:text-white hover:bg-white/10"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <Button
                    variant="default"
                    size="sm"
                    onClick={onOpenManager}
                    className="text-white/40 hover:text-white hover:bg-white/10  bg-white/5 rounded-xl gap-2"
                >
                    <Settings className="w-4 h-4" />
                    <span className="text-xs">Manage</span>
                </Button>
            </div>

            {/* Preset Grid */}
            <div className="bg-transparent  w-full ">
                {filteredPresets.length === 0 ? (
                    <div className="flex flex-col items-center  py-12 text-white/30 space-y-3">
                        <LayoutTemplate className="w-10 h-10 opacity-50" />
                        <span className="text-sm">No presets available</span>
                        <Button variant="outline" size="sm" onClick={onOpenManager} className="mt-2 border-white/10 bg-white/5 hover:bg-white/10 text-white/60">
                            Create First Preset
                        </Button>
                    </div>
                ) : (
                    <div
                        ref={scrollRef}
                        className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[500px] overflow-y-auto p-1 "
                    >
                        {filteredPresets.map(preset => {
                            const cover = preset.coverUrl || preset.cover;
                            const name = preset.name || preset.title || "Untitled";

                            return (
                                <button
                                    key={preset.id}
                                    className="group relative flex flex-col items-start overflow-hidden bg-black/20 hover:bg-black/20 transition-colors rounded-2xl p-1 w-full h-30 "
                                    onClick={() => onSelectPreset(preset)}
                                >
                                    <div className="relative w-full  aspect-[1/1] rounded-xl bg-white/10  overflow-hidden">
                                        {cover ? (
                                            <Image
                                                src={cover}
                                                alt={name}
                                                fill
                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center bg-white/5 justify-center text-white/20">
                                                <LayoutTemplate className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full flex pt-2  pb-1 px-4 justify-center">
                                        <h3 className="text-xs  text-white line-clamp-1">{name}</h3>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );
};
