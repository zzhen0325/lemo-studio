import React, { useEffect, useState, useRef, useMemo } from 'react';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { formatImageUrl } from "@/lib/api-base";
import { Download, Search, Image as ImageIcon, Type, Box, RefreshCw, X, SlidersHorizontal, Trash2, LucideIcon, Layers } from "lucide-react";
import GradualBlur from "@/components/visual-effects/GradualBlur";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useToast } from '@/hooks/common/use-toast';
import { useMediaQuery } from '@/hooks/common/use-media-query';
import { useImageSource } from '@/hooks/common/use-image-source';
import { useGenerationService } from "@/components/features/playground-v2/hooks/useGenerationService";
import { Generation, GenerationConfig } from '@/types/database';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel
} from "@/components/ui/dropdown-menu";




export default function GalleryView({ onSelectItem }: { onSelectItem?: (item: Generation) => void }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [selectedPresets, setSelectedPresets] = useState<string[]>([]);

    const galleryItems = usePlaygroundStore(s => s.galleryItems);
    const fetchGallery = usePlaygroundStore(s => s.fetchGallery);
    const galleryPage = usePlaygroundStore(s => s.galleryPage);
    const hasMoreGallery = usePlaygroundStore(s => s.hasMoreGallery);
    const isFetchingGallery = usePlaygroundStore(s => s.isFetchingGallery);

    // Responsive column count
    const isSm = useMediaQuery("(min-width: 640px)");
    const isMd = useMediaQuery("(min-width: 768px)");
    const isLg = useMediaQuery("(min-width: 1024px)");
    const isXl = useMediaQuery("(min-width: 1280px)");
    const is2Xl = useMediaQuery("(min-width: 1536px)");

    const columnsCount = React.useMemo(() => {
        if (is2Xl) return 8;
        if (isXl) return 7;
        if (isLg) return 6;
        if (isMd) return 5;
        if (isSm) return 3;
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

    // 初始数据加载现在由 pages/playground.tsx 在页面初始化时统一处理，确保预加载
    // 这里不再需要 useEffect 初始加载

    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMoreGallery && !isFetchingGallery) {
                    fetchGallery(galleryPage + 1);
                }
            },
            { threshold: 0.1, rootMargin: '400px' }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasMoreGallery, isFetchingGallery, galleryPage, fetchGallery]);

    const handleDownload = (e: React.MouseEvent, imageUrl: string, filename: string) => {
        e.stopPropagation();
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Navigation Logic removed as ImagePreviewModal is now global

    // 初始数据加载：如果进入该视图且数据为空，则触发拉取
    useEffect(() => {
        if (galleryItems.length === 0 && !isFetchingGallery) {
            fetchGallery(1);
        }
    }, [galleryItems.length, isFetchingGallery, fetchGallery]);

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
        <div className="w-[95%] h-full mt-10 mx-auto  bg-transparent flex flex-col overflow-hidden">



            <div className="flex flex-1 overflow-hidden min-h-0">


                <div className=" w-full min-w-0 flex flex-col flex-1 overflow-hidden">



                    <div className="flex flex-col space-y-4  overflow-hidden">

                        <div className="flex flex-row items-center h-14 mt-4 justify-between ">
                            <div className="flex mb-0">
                                <span className="text-3xl font-instrument-sans text-white flex items-center "
                                    style={{ fontFamily: "'InstrumentSerif', serif" }}>
                                    Gallery
                                </span>
                            </div>


                            <div className="relative flex items-center group w-64  ">
                                <Search className=" absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30  group-focus-within:text-white/60 " />
                                <input
                                    type="text"
                                    placeholder="Search prompts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full h-12 bg-white/5  border border-white/10 rounded-2xl pl-10 pr-10 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 focus:bg-black/80 "
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
                        </div>


                        <div className="flex-1 w-full min-h-0 overflow-y-auto rounded-t-xl">

                            <MasonryGrid
                                items={sortedHistory}
                                columnsCount={columnsCount}
                                renderItem={(item, index) => (
                                    <GalleryCard
                                        key={`${item.id}-${index}`}
                                        item={item}
                                        onClick={() => item.status !== 'pending' && onSelectItem?.(item)}
                                        onDownload={handleDownload}
                                    />
                                )}
                            />

                            {/* Load More Indicator */}
                            <div ref={loadMoreRef} className="py-12 flex flex-col items-center justify-center gap-4">
                                {isFetchingGallery ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Loading More...</span>
                                    </div>
                                ) : hasMoreGallery ? (
                                    <div className="h-4" />
                                ) : galleryItems.length > 0 && (
                                    <div className="flex flex-col items-center gap-2 opacity-20">
                                        <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
                                        <span className="text-[10px] text-white font-mono uppercase tracking-widest">End of Gallery</span>
                                        <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                </div>
                {/* Sidebar Filters - Only visible in full gallery mode */}
                <div className="w-0 flex-none  pb-2 pl-6 flex flex-col min-h-0">
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
                                                {availableModels.map((model, idx) => (
                                                    <FilterItem
                                                        key={`${model}-${idx}`}
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
                                                {availablePresets.map((preset, idx) => (
                                                    <FilterItem
                                                        key={`${preset}-${idx}`}
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


        </div >
    );
}

interface MasonryGridProps<T> {
    items: T[];
    columnsCount: number;
    renderItem: (item: T, index: number) => React.ReactNode;
}

function MasonryGrid<T extends Generation>({
    items,
    columnsCount,
    renderItem
}: MasonryGridProps<T>) {
    // Distribute items into columns with their original index
    const columns = useMemo(() => {
        const cols: { item: T; index: number }[][] = Array.from({ length: columnsCount }, () => []);
        const colHeights = new Array(columnsCount).fill(0);

        items.forEach((item, index) => {
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

            cols[targetColIndex].push({ item, index });
            colHeights[targetColIndex] += aspectRatio;
        });

        return cols;
    }, [items, columnsCount]);


    // 瀑布流布局
    return (

        <div className="flex gap-0 w-full ">
            {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex flex-col gap-0 flex-1 min-w-0">
                    {col.map(({ item, index }) => (
                        <React.Fragment key={`${item.id}-${index}`}>
                            {renderItem(item, index)}
                        </React.Fragment>
                    ))}
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
    const { applyPrompt, applyModel, applyImages, setUploadedImages, config, setViewMode, setActiveTab, styles, addImageToStyle, applyImage, setSelectedPresetName } = usePlaygroundStore();
    const { handleGenerate } = useGenerationService();
    const { toast } = useToast();

    // 数据已规范化，直接从 config.sourceImageUrls 读取
    const sourceUrls = item.config?.sourceImageUrls || [];
    const firstSourceUrl = sourceUrls[0];
    const sourceImage = useImageSource(firstSourceUrl || undefined);

    const performDownload = () => {
        if (!item.outputUrl) return;
        const fakeEvent = { stopPropagation: () => void 0 } as unknown as React.MouseEvent;
        onDownload(fakeEvent, item.outputUrl, item.id || `img_${new Date(item.createdAt).getTime()}`);
    };

    return (
        <div
            ref={ref}
            className="group relative bg-black/20 border-[0.8px] border-black overflow-hidden  hover:border-white/20 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer translate-z-0"
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
                        src={formatImageUrl(item.outputUrl) || ""}
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

                {/* Reference Image Thumbnail */}
                {sourceImage && (
                    <div className="absolute top-3 left-3 z-10 w-12 h-12 rounded-lg border border-white overflow-hidden shadow-2xl transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:scale-110">
                        <Image
                            src={sourceImage}
                            alt="Reference image"
                            fill
                            className="object-cover"
                            sizes="48px"
                            unoptimized
                        />
                    </div>
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
                                toast({ title: "Image Added", description: "图片已添加为参考图" });
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
                        onClick={async () => {
                            if (!item.config) return;

                            // 1. 同步参考图 - 数据已规范化，直接从 config.sourceImageUrls 读取
                            const sourceUrls = item.config?.sourceImageUrls || [];
                            if (sourceUrls.length > 0) {
                                await applyImages(sourceUrls);
                            } else {
                                setUploadedImages([]);
                            }

                            // 2. 应用模型和参数
                            const fullConfig: GenerationConfig = {
                                ...config,
                                ...item.config,
                                prompt: item.config.prompt || '',
                                width: item.config.width || config.width,
                                height: item.config.height || config.height,
                                model: item.config.model || config.model,
                                isEdit: item.config.isEdit,
                                editConfig: item.config.editConfig,
                                parentId: item.config.parentId,
                                sourceImageUrls: sourceUrls,
                            };

                            applyModel(fullConfig.model, fullConfig);
                            applyPrompt(fullConfig.prompt);
                            setSelectedPresetName(item.config.presetName);

                            // 3. 切换视图并触发生成
                            setViewMode('dock');
                            setActiveTab('history');
                            await handleGenerate({ configOverride: fullConfig });

                            toast({ title: "Rerunning", description: "正在根据此图片重新生成..." });
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
