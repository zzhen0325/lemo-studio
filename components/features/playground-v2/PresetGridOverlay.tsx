import React, { useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { Button } from "@/components/ui/button";
import { LayoutTemplate, Settings } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PresetExtended } from './types';

import { Badge } from "@/components/ui/badge";

interface PresetGridOverlayProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onOpenManager: () => void;
    onSelectPreset: (preset: PresetExtended) => void;
    externalPresets?: PresetExtended[];
}

export const PresetGridOverlay: React.FC<PresetGridOverlayProps> = ({
    open = false,
    onOpenChange,
    onOpenManager,
    onSelectPreset,
    externalPresets
}) => {
    const storePresets = usePlaygroundStore(s => s.presets);
    const presetCategories = usePlaygroundStore(s => s.presetCategories);
    const CATEGORIES = ["All", ...presetCategories];
    const presets = (externalPresets || storePresets) as PresetExtended[];
    const [activeCategory, setActiveCategory] = useState("All");

    const filteredPresets = activeCategory === "All"
        ? presets
        : presets.filter(p => (p.category || 'General') === activeCategory);

    const handlePresetSelect = (preset: PresetExtended) => {
        onSelectPreset(preset);
        onOpenChange?.(false);
    };

    const handleOpenManager = () => {
        onOpenManager();
        onOpenChange?.(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl z-[10001] h-[70vh] p-0 bg-white border-white/10 rounded-3xl shadow-2xl shadow-black/10 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between pt-6 px-6 shrink-0 ">
                    <div className="flex items-center gap-3">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                                    activeCategory === cat
                                        ? "bg-[#0F0F15] text-white"
                                        : "text-black/50 bg-black/0 border border-black/5 hover:text-black hover:bg-black/5"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <Button
                        variant="default"
                        size="sm"
                        onClick={handleOpenManager}
                        className="text-black/60 hover:text-black hover:bg-black/5 rounded-xl gap-4  bg-black/0 border border-black/5"
                    >
                        <Settings className="w-4 h-4 " />
                        <span className="text-xs -ml-2">Manage</span>
                    </Button>
                </div>

                <ScrollArea className="flex bg-[#f5f5f5] rounded-2xl pt-6 px-4 pb-0 mx-2 mb-2">
                    <div className="">
                        {filteredPresets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-black/30 space-y-4">
                                <LayoutTemplate className="w-16 h-16 opacity-30" />
                                <span className="text-sm font-medium">No presets available</span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOpenManager}
                                    className="mt-2 border-white/10 bg-white/5 hover:bg-white/10 text-white/60"
                                >
                                    Create First Preset
                                </Button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-6 gap-4 mx-2">
                                {filteredPresets.map(preset => {
                                    const cover = preset.coverUrl || preset.cover;
                                    const name = preset.name || preset.title || "Untitled";

                                    return (
                                        <button
                                            key={preset.id}
                                            className="group relative flex flex-col items-start overflow-hidden bg-white hover:shadow-[#e7e7e7]  hover:shadow-2xl  border-gray-150 hover:border-gray-400 transition-all rounded-2xl border  p-2 w-full"
                                            onClick={() => handlePresetSelect(preset)}
                                        >
                                            <div className="relative w-full aspect-[1/1] rounded-lg bg-black/15 overflow-hidden">
                                                {cover ? (
                                                    <Image
                                                        src={cover}
                                                        alt={name}
                                                        fill
                                                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center bg-black/5 justify-center text-white/20">
                                                        <LayoutTemplate className="w-6 h-6" />
                                                    </div>
                                                )}
                                                {preset.editConfig && (
                                                    <div className="absolute top-1 right-2">
                                                        <Badge className="bg-black/40 backdrop-blur-md text-white text-[9px] px-1.5 py-1.5 h-4 border-none ">
                                                            Edit
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="w-full pt-2 pb-1 px-1">
                                                <span className="text-xs text-black/90 text-center  font-normal">{name}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};
