import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { getApiBase } from "@/lib/api-base";
import { Download, Search, Image as ImageIcon, Type, Box, RefreshCw, X, Filter, LayoutGrid, SlidersHorizontal, Trash2, LucideIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import GradualBlur from "@/components/GradualBlur";
import ImagePreviewModal from './Dialogs/ImagePreviewModal';
import ImageEditorModal from './Dialogs/ImageEditorModal';
import { TooltipButton } from "@/components/ui/tooltip-button";
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useToast } from '@/hooks/common/use-toast';
import { useMediaQuery } from '@/hooks/common/use-media-query';
import { Generation } from '@/types/database';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Layers } from 'lucide-react';



export default function GalleryView() {
    const [selectedItem, setSelectedItem] = useState<Generation | null>(null);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingImageUrl, setEditingImageUrl] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [selectedPresets, setSelectedPresets] = useState<string[]>([]);

    const setUploadedImages = usePlaygroundStore(s => s.setUploadedImages);
    const galleryItems = usePlaygroundStore(s => s.galleryItems);
    const fetchGallery = usePlaygroundStore(s => s.fetchGallery);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // Responsive column count
    const isSm = useMediaQuery("(min-width: 640px)");
    const isMd = useMediaQuery("(min-width: 768px)");
    const isLg = useMediaQuery("(min-width: 1024px)");
    const isXl = useMediaQuery("(min-width: 1280px)");
    const is2Xl = useMediaQuery("(min-width: 1536px)");

    const columnsCount = React.useMemo(() => {
        if (is2Xl) return 6;
        if (isXl) return 5;
        if (isLg) return 4;
        if (isMd) return 3;
        if (isSm) return 2;
        return 1;
    }, [isSm, isMd, isLg, isXl, is2Xl]);

    // Available Models & Presets
    const availableModels = useMemo(() => {
        const models = new Set(galleryItems
            .map(item => item.config?.model)
            .filter((m): m is string => !!m)
        );
        return Array.from(models).sort();
    }, [galleryItems]);

    const availablePresets = useMemo(() => {
        const presets = new Set(galleryItems
            .map(item => item.config?.presetName)
            .filter((p): p is string => !!p)
        );
        return Array.from(presets).sort();
    }, [galleryItems]);

    // Combine local history with active generations from store
    const sortedHistory = React.useMemo(() => {
        let filtered = galleryItems;

        // 1. Search Filter
        if (searchQuery.trim() !== "") {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                (item.config?.prompt || "").toLowerCase().includes(query)
            );
        }

        // 2. Model Filter
        if (selectedModels.length > 0) {
            filtered = filtered.filter(item =>
                item.config?.model && selectedModels.includes(item.config.model)
            );
        }

        // 3. Preset Filter
        if (selectedPresets.length > 0) {
            filtered = filtered.filter(item =>
                item.config?.presetName && selectedPresets.includes(item.config.presetName)
            );
        }

        // Files are already sorted in the API, but we might want to re-sort here just in case of local updates
        return [...filtered].sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }, [galleryItems, searchQuery, selectedModels, selectedPresets]);

    const toggleModel = (model: string) => {
        setSelectedModels(prev =>
            prev.includes(model)
                ? prev.filter(m => m !== model)
                : [...prev, model]
        );
    };

    const togglePreset = (preset: string) => {
        setSelectedPresets(prev =>
            prev.includes(preset)
                ? prev.filter(p => p !== preset)
                : [...prev, preset]
        );
    };

    const handleRefresh = useCallback(async () => {
        setLoading(true);
        try {
            await fetchGallery();
        } finally {
            setLoading(false);
        }
    }, [fetchGallery]);

    useEffect(() => {
        if (galleryItems.length === 0) {
            handleRefresh();
        }
    }, [galleryItems.length, handleRefresh]);

    const handleDownload = (e: React.MouseEvent, imageUrl: string, filename: string) => {
        e.stopPropagation();
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEditImage = (result: Generation) => {
        const url = result.outputUrl || "";
        if (url) {
            setEditingImageUrl(url);
            setIsEditorOpen(true);
            setSelectedItem(null);
        }
    };

    const handleSaveEditedImage = async (dataUrl: string, prompt?: string) => {
        try {
            // Apply prompt if provided (from labeling tool)
            if (prompt) {
                usePlaygroundStore.getState().applyPrompt(prompt);
            }

            // 1. Convert dataUrl to Blob/File
            const response = await fetch(dataUrl);
            const blob = await response.blob();
            const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });

            // 2. Upload to server
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fetch(`${getApiBase()}/upload`, {
                method: 'POST',
                body: formData
            });

            if (!uploadRes.ok) throw new Error("Upload failed");
            const { path } = await uploadRes.json();

            // 3. Add to playground state
            const base64Data = dataUrl.split(',')[1];
            setUploadedImages(prev => [
                ...prev,
                { file, base64: base64Data, previewUrl: dataUrl, path }
            ]);

            setIsEditorOpen(false);
            toast({ title: "Image Saved", description: "The edited image has been added to your playground uploads." });
        } catch (error) {
            console.error("Failed to save edited image:", error);
            toast({ title: "Error", description: "Failed to save edited image", variant: "destructive" });
        }
    };

    const scrollRef = useRef<HTMLDivElement>(null);

    const FilterItem = ({ label, isSelected, onClick, icon: Icon }: { label: string, isSelected: boolean, onClick: () => void, icon: LucideIcon }) => (
        <div
            onClick={onClick}
            className={cn(
                "group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                isSelected
                    ? "bg-white/5 text-white border border-white/10"
                    : "text-white/60 hover:bg-black/10 hover:text-white"
            )}
        >
            <Icon className={cn("w-4 h-4 shrink-0", isSelected ? "text-primary" : "text-white/40")} />
            <span className="truncate flex-1 select-none">{label}</span>
        </div>
    );

    return (
        <div className="w-[90%] h-full mt-20 mx-auto  bg-transparent flex flex-col overflow-hidden">
          
                <div className="flex flex-row z-20 pb-4 bg-transparent shrink-0">
                       {/* 搜索框 */}
                   
                </div>

                
                <div className="flex flex-1 overflow-hidden min-h-0">
                  

                    <div className=" w-full space-y-6 min-w-0 flex flex-col">
                      

                        {loading && sortedHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                                    <div className="absolute inset-0 bg-gray-500/20 blur-xl animate-pulse rounded-full" />
                                </div>
                                <p className="text-white/40 font-medium animate-pulse tracking-wide">Syncing Archive...</p>
                            </div>
                        ) : sortedHistory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center bg-white/5 rounded-2xl border border-white/10 border-dashed space-y-1 py-32">
                                <div className="p-6 bg-white/5 rounded-full">
                                    <Search className="w-12 h-12 text-white/20" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-white/60 text-xl font-medium">No masterpieces found yet</p>
                                    <p className="text-white/30">Your generated images will appear here once you start creating.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col space-y-1 ">

                            
                             <div className="relative group flex-1 h-12 w-full ">
                        <Search className=" absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30  group-focus-within:text-white/60 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search prompts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-12 bg-white/5  border border-white/10 rounded-2xl pl-10 pr-10 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:bg-black/80 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/10 text-white/30 hover:text-white/60 transition-all"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}


                   
                    </div>
                            <div className="flex-1 w-full min-h-0 overflow-y-auto rounded-3xl">
                                
                                <MasonryGrid
                                    items={sortedHistory}
                                    columnsCount={columnsCount}
                                    renderItem={(item) => (
                                        <GalleryCard
                                            key={item.id || item.createdAt}
                                            item={item}
                                            onClick={() => item.status !== 'pending' && setSelectedItem(item)}
                                            onDownload={handleDownload}
                                        />
                                    )}
                                />
                            </div>

                            </div>
                        )}
                    </div>
                      {/* Sidebar Filters - Only visible in full gallery mode */}
                        <div className="w-48 flex-none  pb-2 pl-6 flex flex-col min-h-0">
                            <div className="bg-white/5 border border-white/10 rounded-2xl flex-1 flex flex-col min-h-0 relative overflow-hidden">
                                <GradualBlur
                                    target="parent"
                                    position="top"
                                    height="100px"
                                    strength={6}
                                    divCount={5}
                                    curve="bezier"
                                    exponential={true}
                                    zIndex={10}
                                    opacity={1}
                                    borderRadius="1.5rem"
                                    animate={{
                                        type: 'scroll',
                                        targetRef: scrollRef,
                                        startOffset: 0,
                                        endOffset: 80
                                    }}
                                />
                                <div className="p-2 pt-4 flex flex-col gap-4 flex-1 min-h-0">
                                    {/* Header */}
                                    <div className="flex items-center px-2 justify-between z-20 shrink-0">
                                        <span className="text-xl text-white" style={{ fontFamily: "'InstrumentSerif', serif" }}>Filters</span>
                                        {(selectedModels.length > 0 || selectedPresets.length > 0) && (
                                            <button
                                                onClick={() => {
                                                    setSelectedModels([]);
                                                    setSelectedPresets([]);
                                                }}
                                                className="h-7 w-7 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                                                title="Clear Filters"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                                        <div className="flex flex-col gap-6">
                                            {/* Models Section */}
                                            {availableModels.length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="text-sm  text-white/40  ">Models</div>
                                                    <div className="space-y-1">
                                                        {availableModels.map(model => (
                                                            <FilterItem
                                                                key={model}
                                                                label={model}
                                                                isSelected={selectedModels.includes(model)}
                                                                onClick={() => toggleModel(model)}
                                                                icon={Box}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Presets Section */}
                                            {availablePresets.length > 0 && (
                                                <div className="space-y-2">
                                                    <div className="text-sm  text-white/40 ">Presets</div>
                                                    <div className="space-y-1">
                                                        {availablePresets.map(preset => (
                                                            <FilterItem
                                                                key={preset}
                                                                label={preset}
                                                                isSelected={selectedPresets.includes(preset)}
                                                                onClick={() => togglePreset(preset)}
                                                                icon={SlidersHorizontal}
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </div>

                <ImagePreviewModal
                    isOpen={!!selectedItem}
                    onClose={() => setSelectedItem(null)}
                    result={selectedItem || undefined}
                    onEdit={handleEditImage}
                />

                <ImageEditorModal
                    isOpen={isEditorOpen}
                    imageUrl={editingImageUrl}
                    onClose={() => setIsEditorOpen(false)}
                    onSave={handleSaveEditedImage}
                    workflows={[]}
                />
            
        </div >
    );
}

interface MasonryGridProps<T> {
    items: T[];
    columnsCount: number;
    renderItem: (item: T) => React.ReactNode;
}

function MasonryGrid<T extends Generation>({
    items,
    columnsCount,
    renderItem
}: MasonryGridProps<T>) {
    // Distribute items into columns
    const columns = useMemo(() => {
        const cols: T[][] = Array.from({ length: columnsCount }, () => []);
        const colHeights = new Array(columnsCount).fill(0);

        items.forEach((item) => {
            // Find the shortest column
            let targetColIndex = 0;
            let minHeight = colHeights[0];

            for (let i = 1; i < columnsCount; i++) {
                if (colHeights[i] < minHeight) {
                    minHeight = colHeights[i];
                    targetColIndex = i;
                }
            }

            const imgWidth = item.config?.width || 1024;
            const imgHeight = item.config?.height || 1024;
            // Use aspect ratio as proxy for height since width is fixed per column
            const aspectRatio = imgHeight / imgWidth;

            cols[targetColIndex].push(item);
            colHeights[targetColIndex] += aspectRatio;
        });

        return cols;
    }, [items, columnsCount]);


    // 瀑布流布局
    return (

        <div className="flex gap-0 w-full ">
            {columns.map((colItems, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-0 flex-1 min-w-0">
                    {colItems.map((item) => renderItem(item))}
                </div>
            ))}
        </div>
    );
}

function useInView(options?: IntersectionObserverInit) {
    const [isInView, setIsInView] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                observer.disconnect();
            }
        }, options);

        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [options]);

    return { ref, isInView };
}

function GalleryCard({ item, onClick, onDownload }: { item: Generation, onClick: () => void, onDownload: (e: React.MouseEvent, url: string, filename: string) => void }) {
    const [isHover, setIsHover] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const { ref, isInView } = useInView({ rootMargin: '200px' });
    const applyPrompt = usePlaygroundStore(s => s.applyPrompt);
    const applyModel = usePlaygroundStore(s => s.applyModel);
    const remix = usePlaygroundStore(s => s.remix);
    const applyImage = usePlaygroundStore(s => s.applyImage);
    const styles = usePlaygroundStore(s => s.styles);
    const addImageToStyle = usePlaygroundStore(s => s.addImageToStyle);
    const { toast } = useToast();
    const performDownload = () => {
        if (!item.outputUrl) return;
        const fakeEvent = { stopPropagation: () => void 0 } as unknown as React.MouseEvent;
        onDownload(fakeEvent, item.outputUrl, item.id || `img_${new Date(item.createdAt).getTime()}`);
    };

    return (
        <div
            ref={ref}
            className="group relative bg-black border border-black overflow-hidden  hover:border-white/20 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer translate-z-0"
            onClick={onClick}
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
        >
            {/* Image Container */}
            <div className="relative w-full  flex items-center justify-center bg-white/5">
                {item.status === 'pending' ? (
                    <div className="w-full flex flex-col items-center justify-center p-8 space-y-3">
                        <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <span className="text-[10px] text-white/30 font-medium uppercase tracking-widest animate-pulse">Generating</span>
                    </div>
                ) : !isInView ? (
                    <div style={{
                        paddingBottom: `${((item.config?.height || 1024) / (item.config?.width || 1024)) * 100}%`,
                        width: '100%'
                    }} />
                ) : (
                    <Image
                        src={item.outputUrl || ""}
                        alt="Generated masterwork"
                        width={item.config?.width || 1024}
                        height={item.config?.height || 1024}
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 15vw"
                        quality={75}
                        placeholder="blur"
                        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
                        className={cn(
                            "w-full h-auto object-cover transition-all duration-700 group-hover:scale-105",
                            isLoaded ? "opacity-100 blur-0" : "opacity-0 blur-xl"
                        )}
                        onLoad={() => setIsLoaded(true)}
                    />

                )}
                {/* 
                <ProgressiveBlur
                    className='pointer-events-none absolute bottom-0 left-0 h-[75%] w-full'
                    blurIntensity={0.5}
                    direction='bottom'
                    animate={isHover ? 'visible' : 'hidden'}
                    variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1 },
                    }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                /> */}


                {/* Floating Actions - consistent with HistoryList */}
                <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1  bg-black/50 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl transition-all duration-50 ${isHover ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <div>
                                <TooltipButton
                                    icon={<Layers className="w-4 h-4" />}
                                    label="Add to Style"
                                    tooltipContent="添加到风格"
                                    tooltipSide="top"
                                    className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                                />
                            </div>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-black/90 border-white/10 backdrop-blur-2xl rounded-2xl p-2 min-w-[160px]">
                            <DropdownMenuLabel className="text-white/40 text-[10px] uppercase tracking-wider px-2 py-1">选择风格堆叠</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/5" />
                            {styles.length > 0 ? (
                                styles.map(style => (
                                    <DropdownMenuItem
                                        key={style.id}
                                        className="text-white hover:bg-white/10 rounded-xl cursor-pointer"
                                        onClick={() => {
                                            if (item.outputUrl) {
                                                addImageToStyle(style.id, item.outputUrl);
                                                toast({ title: "已添加", description: `已将图片加入风格: ${style.name}` });
                                            }
                                        }}
                                    >
                                        {style.name}
                                    </DropdownMenuItem>
                                ))
                            ) : (
                                <DropdownMenuItem disabled className="text-white/20 text-xs">
                                    暂无可用风格
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
                    <TooltipButton
                        icon={<Type className="w-4 h-4" />}
                        label="Use Prompt"
                        tooltipContent="Use Prompt"
                        tooltipSide="top"
                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => {
                            if (item.config?.prompt) {
                                applyPrompt(item.config.prompt);
                                toast({ title: "Prompt Applied", description: "提示词已应用到输入框" });
                            }
                        }}
                    />
                    <TooltipButton
                        icon={<ImageIcon className="w-4 h-4" />}
                        label="Use Image"
                        tooltipContent="Use Image"
                        tooltipSide="top"
                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => {
                            if (item.outputUrl) {
                                applyImage(item.outputUrl);
                                toast({ title: "Image Applied", description: "图片已应用为参考图" });
                            }
                        }}
                    />
                    {/* <TooltipButton
                        icon={<Box className="w-4 h-4" />}
                        label="Use Model"
                        tooltipContent="Use Model"
                        tooltipSide="top"
                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => {
                            if (item.config) {
                                applyModel(item.config.model, item.config);
                                toast({ title: "Model Selected", description: `已切换模型为: ${item.config.model}` });
                            }
                        }}
                    /> */}
                    <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
                    <TooltipButton
                        icon={<RefreshCw className="w-4 h-4" />}
                        label="Rerun"
                        tooltipContent="Rerun"
                        tooltipSide="top"
                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => {
                            remix({
                                ...item,
                                config: {
                                    prompt: item.config?.prompt || '',
                                    model: item.config?.model || 'Nano banana',
                                    lora: item.config?.lora || '',
                                    loras: item.config?.loras || [],
                                    width: item.config?.width || 1376,
                                    height: item.config?.height || 768,
                                    resolution: item.config?.resolution || '1K'
                                }
                            });
                            toast({ title: "Remixing", description: "正在根据此图片重新生成..." });
                        }}
                    />
                    <TooltipButton
                        icon={<Download className="w-4 h-4" />}
                        label="Download"
                        tooltipContent="Download"
                        tooltipSide="top"
                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                        onClick={performDownload}
                    />
                </div>
            </div>
        </div>
    );
}
