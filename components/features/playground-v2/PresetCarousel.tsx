import React, { useRef } from 'react';
import { PresetExtended } from './types';
import { PresetCard } from './PresetCard';
import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PresetCarouselProps {
    presets: PresetExtended[];
    onSelectPreset: (preset: PresetExtended) => void;
    onOpenManager: () => void;
}

export const PresetCarousel: React.FC<PresetCarouselProps> = ({ presets, onSelectPreset, onOpenManager }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (containerRef.current) {
            const scrollAmount = containerRef.current.clientWidth / 2;
            containerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth',
            });
        }
    };

    return (
        <div className="w-full relative group/carousel my-4">
            <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
                    <span className="w-1 h-4 bg-emerald-500 rounded-full" />
                    创意预设
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-white/40 hover:text-white hover:bg-white/10"
                    onClick={onOpenManager}
                >
                    <Settings2 className="w-3 h-3 mr-1" />
                    管理预设
                </Button>
            </div>

            <div className="relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity disabled:opacity-0 backdrop-blur-sm ml-[-12px]"
                    onClick={() => scroll('left')}
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>

                <div
                    ref={containerRef}
                    className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {/* Add New Preset Card (Fixed at start) */}
                    {/* <div className="flex-none w-[calc(20%-12px)] min-w-[120px] aspect-[3/4] snap-start">
                        <motion.button
                            className="w-full h-full rounded-2xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 flex flex-col items-center justify-center gap-2 group transition-colors"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onOpenManager}
                        >
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-emerald-500/20 group-hover:text-emerald-400 transition-colors">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span className="text-xs text-white/60 font-medium">新建预设</span>
                        </motion.button>
                    </div> */}

                    {presets.map((preset) => (
                        <div key={preset.id} className="flex-none w-[calc(20%-12px)] min-w-[120px] snap-start">
                            <PresetCard preset={preset} onClick={onSelectPreset} />
                        </div>
                    ))}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-20 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity disabled:opacity-0 backdrop-blur-sm mr-[-12px]"
                    onClick={() => scroll('right')}
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
