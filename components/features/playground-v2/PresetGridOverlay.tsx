import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Settings } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PresetExtended, PRESET_CATEGORIES } from './types';

interface PresetGridOverlayProps {
    onOpenManager: () => void;
    onSelectPreset: (preset: PresetExtended) => void;
    externalPresets?: PresetExtended[];
}

const CATEGORIES = ["All", ...PRESET_CATEGORIES];

export const PresetGridOverlay: React.FC<PresetGridOverlayProps> = ({ onOpenManager, onSelectPreset, externalPresets }) => {
    const storePresets = usePlaygroundStore(s => s.presets);
    const presets = (externalPresets || storePresets) as PresetExtended[];
    const [activeCategory, setActiveCategory] = useState("All");

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
            <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-2xl p-1 backdrop-blur-md">
                <div className="flex items-center gap-1 ">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                                "px-3 py-2 rounded-xl text-xs font-medium transition-all",
                                activeCategory === cat
                                    ? "bg-white text-black"
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
            <div className="bg-transparent mt-2 w-full ">
                {filteredPresets.length === 0 ? (
                    <div className="flex flex-col items-center  py-12 text-white/30 space-y-3">
                        <LayoutTemplate className="w-10 h-10 opacity-50" />
                        <span className="text-sm">No presets available</span>
                        <Button variant="outline" size="sm" onClick={onOpenManager} className="mt-2 border-white/10 bg-white/5 hover:bg-white/10 text-white/60">
                            Create First Preset
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto custom-scrollbar p-1">
                        {filteredPresets.map(preset => {
                            const p = preset as any;
                            const cover = p.coverUrl || p.cover;
                            const name = p.name || p.title || "Untitled";

                            return (
                                <button
                                    key={preset.id}
                                    className="group relative flex flex-col items-start overflow-hidden bg-black/5 hover:bg-black/20 transition-colors rounded-3xl p-3 w-full border border-white/20"
                                    onClick={() => onSelectPreset(preset)}
                                >
                                    <div className="relative w-full aspect-[1/1] rounded-2xl bg-white/10  overflow-hidden">
                                        {cover ? (
                                            <Image
                                                src={cover}
                                                alt={name}
                                                fill
                                                className="object-cover transition-transform duration-300 group-hover:scale-105"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-white/20">
                                                <LayoutTemplate className="w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-full flex pt-2 justify-center">
                                        <h3 className="text-xs font-medium text-white line-clamp-1">{name}</h3>
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
