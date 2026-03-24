"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { formatImageUrl } from "@/lib/api-base";
import { Download, Search, Image as ImageIcon, Type, Box, RefreshCw, X, SlidersHorizontal, Trash2, LucideIcon, ArrowUpDown, Heart, Star, DownloadIcon, Edit3 } from "lucide-react";
import GradualBlur from "@/components/visual-effects/GradualBlur";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useToast } from '@/hooks/common/use-toast';
import { useMediaQuery } from '@/hooks/common/use-media-query';
import { useGenerationService } from "@studio/playground/_components/hooks/useGenerationService";
import { Generation, GenerationConfig } from '@/types/database';
import { AddToMoodboardMenu } from "@studio/playground/_components/AddToMoodboardMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { SortBy } from '@/lib/server/service/history.service';

const GALLERY_THUMB_QUALITY = 25;




export default function GalleryView({ onSelectItem }: { onSelectItem?: (item: Generation) => void }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [selectedPresets, setSelectedPresets] = useState<string[]>([]);

    const galleryItems = usePlaygroundStore(s => s.galleryItems);
    const fetchGallery = usePlaygroundStore(s => s.fetchGallery);
    const syncGalleryLatest = usePlaygroundStore(s => s.syncGalleryLatest);
    const prefetchGalleryNext = usePlaygroundStore(s => s.prefetchGalleryNext);
    const galleryPage = usePlaygroundStore(s => s.galleryPage);
    const hasMoreGallery = usePlaygroundStore(s => s.hasMoreGallery);
    const isFetchingGallery = usePlaygroundStore(s => s.isFetchingGallery);
    const activeTab = usePlaygroundStore(s => s.activeTab);
    const gallerySortBy = usePlaygroundStore(s => s.gallerySortBy);
    const setGallerySortBy = usePlaygroundStore(s => s.setGallerySortBy);
    const { handleGenerate } = useGenerationService();

    // Sort options configuration (excluding interactionPriority which is internal)
    const sortOptions: { value: Exclude<SortBy, 'interactionPriority'>; label: string; icon: LucideIcon }[] = [
        { value: 'recent', label: '最新', icon: RefreshCw },
        { value: 'likes', label: '点赞最多', icon: Heart },
        { value: 'favorites', label: '收藏最多', icon: Star },
        { value: 'downloads', label: '下载最多', icon: DownloadIcon },
        { value: 'edits', label: '编辑最多', icon: Edit3 },
    ];

    const currentSortOption = sortOptions.find(opt => opt.value === gallerySortBy) || sortOptions[0];

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

        // Keep API/store order to avoid expensive re-sort on every render.
        return filtered;
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

    // 初始数据加载现在由 app/page.tsx 在页面初始化时统一处理，确保预加载
    // 这里不再需要 useEffect 初始加载

    const galleryScrollRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (activeTab !== 'gallery') return;

        const scrollRoot = galleryScrollRef.current;
        if (!scrollRoot) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMoreGallery && !isFetchingGallery) {
                    fetchGallery(galleryPage + 1);
                }
            },
            { threshold: 0, rootMargin: '1400px 0px', root: scrollRoot }
        );

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [activeTab, hasMoreGallery, isFetchingGallery, galleryPage, fetchGallery]);

    const handleDownload = useCallback((e: React.MouseEvent, imageUrl: string, filename: string) => {
        e.stopPropagation();
        const link = document.createElement("a");
        link.href = imageUrl;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    // Navigation Logic removed as ImagePreviewModal is now global

    // 数据加载逻辑：
    // 进入 Gallery 且数据为空时拉取第一页，避免重复刷新造成额外阻塞。
    useEffect(() => {
        if (activeTab !== 'gallery') return;
        if (galleryItems.length === 0 && !isFetchingGallery) {
            fetchGallery(1).catch(err => console.error("Gallery initial load failed:", err));
        }
    }, [activeTab, fetchGallery, isFetchingGallery, galleryItems.length]);

    // If gallery cache already exists, silently sync latest page-1 items in background.
    useEffect(() => {
        if (activeTab !== 'gallery') return;
        if (galleryItems.length === 0) return;

        const timer = window.setTimeout(() => {
            syncGalleryLatest().catch(err => console.error("Gallery latest sync failed:", err));
        }, 80);

        return () => window.clearTimeout(timer);
    }, [activeTab, galleryItems.length, syncGalleryLatest]);

    useEffect(() => {
        if (activeTab !== 'gallery') return;
        if (galleryItems.length === 0 || !hasMoreGallery || isFetchingGallery) return;

        const timer = window.setTimeout(() => {
            prefetchGalleryNext().catch(err => console.error("Gallery prefetch failed:", err));
        }, 120);

        return () => window.clearTimeout(timer);
    }, [activeTab, galleryItems.length, hasMoreGallery, isFetchingGallery, galleryPage, prefetchGalleryNext]);

    const handleSelectItem = useCallback((item: Generation) => {
        if (item.status !== 'pending') {
            onSelectItem?.(item);
        }
    }, [onSelectItem]);

    const isInitialLoading = activeTab === 'gallery' && isFetchingGallery && galleryItems.length === 0;

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

                        <div className="flex flex-row items-center h-14 mt-4 justify-between gap-4">
                            <div className="flex mb-0">
                                <span className="text-3xl font-instrument-sans text-white flex items-center "
                                    style={{ fontFamily: "'InstrumentSerif', serif" }}>
                                    Gallery
                                </span>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Sort Dropdown */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button 
                                            variant="outline" 
                                            className="h-10 bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white gap-2"
                                        >
                                            <currentSortOption.icon className="w-4 h-4" />
                                            <span className="text-sm">{currentSortOption.label}</span>
                                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40 bg-black/90 border-white/10">
                                        {sortOptions.map((option) => (
                                            <DropdownMenuItem
                                                key={option.value}
                                                onClick={() => setGallerySortBy(option.value)}
                                                className={cn(
                                                    "flex items-center gap-2 cursor-pointer text-white/70 hover:text-white hover:bg-white/10",
                                                    gallerySortBy === option.value && "bg-white/10 text-white"
                                                )}
                                            >
                                                <option.icon className="w-4 h-4" />
                                                <span>{option.label}</span>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Search Input */}
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
                        </div>


                        <div ref={galleryScrollRef} className="flex-1 w-full min-h-0 overflow-y-auto rounded-t-xl">

                            {isInitialLoading ? (
                                <GallerySkeletonGrid columnsCount={columnsCount} />
                            ) : (
                                <MasonryGrid
                                    items={sortedHistory}
                                    columnsCount={columnsCount}
                                    scrollContainerRef={galleryScrollRef}
                                    renderItem={(item, index) => (
                                        <GalleryCard
                                            key={`${item.id}-${index}`}
                                            item={item}
                                            onSelectItem={handleSelectItem}
                                            onDownload={handleDownload}
                                            onGenerate={handleGenerate}
                                        />
                                    )}
                                />
                            )}

                            {/* Load More Indicator */}
                            <div ref={loadMoreRef} className="py-12 flex flex-col items-center justify-center gap-4">
                                {isFetchingGallery ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                        <span className="text-[10px] text-white/20 font-mono uppercase tracking-widest">Thinking...</span>
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
                                                        key={`filter-model-${model}-${idx}`}
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
                                                        key={`filter-preset-${preset}-${idx}`}
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
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    overscan?: number;
    gap?: number;
    renderItem: (item: T, index: number) => React.ReactNode;
}

function MasonryGrid<T extends Generation>({
    items,
    columnsCount,
    scrollContainerRef,
    overscan = 600,
    gap = 0,
    renderItem
}: MasonryGridProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    const [viewport, setViewport] = useState({ scrollTop: 0, height: 900 });
    const safeColumnsCount = Math.max(columnsCount, 1);

    useEffect(() => {
        const updateContainerWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.clientWidth);
            }
        };

        updateContainerWidth();

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
            resizeObserver = new ResizeObserver(updateContainerWidth);
            resizeObserver.observe(containerRef.current);
        }

        window.addEventListener('resize', updateContainerWidth);

        return () => {
            window.removeEventListener('resize', updateContainerWidth);
            resizeObserver?.disconnect();
        };
    }, []);

    useEffect(() => {
        const scrollNode = scrollContainerRef.current;
        if (!scrollNode) return;

        const updateViewport = () => {
            setViewport({
                scrollTop: scrollNode.scrollTop,
                height: scrollNode.clientHeight || 900
            });
        };

        updateViewport();
        scrollNode.addEventListener('scroll', updateViewport, { passive: true });
        window.addEventListener('resize', updateViewport);

        return () => {
            scrollNode.removeEventListener('scroll', updateViewport);
            window.removeEventListener('resize', updateViewport);
        };
    }, [scrollContainerRef]);

    const layout = useMemo(() => {
        if (items.length === 0) {
            return { positionedItems: [] as Array<{ item: T; index: number; key: string; top: number; left: number; width: number; height: number }>, totalHeight: 0 };
        }

        const usableWidth = Math.max(containerWidth, 1);
        const columnWidth = (usableWidth - gap * (safeColumnsCount - 1)) / safeColumnsCount;
        const colHeights = new Array(safeColumnsCount).fill(0);

        const positionedItems = items.map((item, index) => {
            let targetColIndex = 0;
            let minHeight = colHeights[0];

            for (let i = 1; i < safeColumnsCount; i++) {
                if (colHeights[i] < minHeight) {
                    minHeight = colHeights[i];
                    targetColIndex = i;
                }
            }

            const imgWidth = Math.max(1, Number(item.config?.width) || 1024);
            const imgHeight = Math.max(1, Number(item.config?.height) || 1024);
            const estimatedHeight = columnWidth * (imgHeight / imgWidth);
            const top = colHeights[targetColIndex];
            const left = targetColIndex * (columnWidth + gap);
            const normalizedId = (item.id || '').trim();

            colHeights[targetColIndex] += estimatedHeight + gap;

            return {
                item,
                index,
                key: normalizedId || `gallery-item-${item.createdAt || 'unknown'}-${index}`,
                top,
                left,
                width: columnWidth,
                height: estimatedHeight
            };
        });

        const totalHeight = Math.max(...colHeights, 0);

        return { positionedItems, totalHeight };
    }, [items, safeColumnsCount, containerWidth, gap]);

    const startY = Math.max(0, viewport.scrollTop - overscan);
    const endY = viewport.scrollTop + viewport.height + overscan;

    const visibleItems = useMemo(() => {
        return layout.positionedItems.filter(({ top, height }) => {
            const bottom = top + height;
            return bottom >= startY && top <= endY;
        });
    }, [layout.positionedItems, startY, endY]);

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative w-full" style={{ height: `${layout.totalHeight}px` }}>
                {visibleItems.map(({ item, index, key, top, left, width }) => (
                    <div
                        key={key}
                        className="absolute"
                        style={{ top, left, width }}
                    >
                        {renderItem(item, index)}
                    </div>
                ))}
            </div>
        </div>
    );
}

function useInView(rootMargin = '200px') {
    const [isInView, setIsInView] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!ref.current) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true);
                observer.disconnect();
            }
        }, { rootMargin });

        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, [rootMargin]);

    return { ref, isInView };
}

type HandleGenerateFn = ReturnType<typeof useGenerationService>['handleGenerate'];

interface GalleryCardProps {
    item: Generation;
    onSelectItem?: (item: Generation) => void;
    onDownload: (e: React.MouseEvent, url: string, filename: string) => void;
    onGenerate: HandleGenerateFn;
}

function GalleryCard({ item, onSelectItem, onDownload, onGenerate }: GalleryCardProps) {
    const [isHover, setIsHover] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const { ref, isInView } = useInView('200px');
    const { toast } = useToast();

    // 数据已规范化，直接从 config.sourceImageUrls 读取
    const sourceUrls = item.config?.sourceImageUrls || [];
    const firstSourceUrl = sourceUrls[0];
    const sourceImage = useMemo(
        () => (firstSourceUrl ? formatImageUrl(firstSourceUrl) : undefined),
        [firstSourceUrl]
    );
    const mainImageUrl = useMemo(
        () => (item.outputUrl ? formatImageUrl(item.outputUrl) : ""),
        [item.outputUrl]
    );
    const isExternalMainImage = useMemo(
        () => /^https?:\/\//i.test(mainImageUrl),
        [mainImageUrl]
    );

    const handleCardClick = useCallback(() => {
        onSelectItem?.(item);
    }, [onSelectItem, item]);

    const performDownload = useCallback(() => {
        if (!item.outputUrl) return;
        const fakeEvent = { stopPropagation: () => void 0 } as unknown as React.MouseEvent;
        onDownload(fakeEvent, item.outputUrl, item.id || `img_${new Date(item.createdAt).getTime()}`);
    }, [item.createdAt, item.id, item.outputUrl, onDownload]);

    return (
        <div
            ref={ref}
            className="group relative bg-black/20 border-[0.8px] border-black overflow-hidden  hover:border-white/20 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] cursor-pointer translate-z-0"
            onClick={handleCardClick}
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
                        src={mainImageUrl}
                        alt="Generated masterwork"
                        width={item.config?.width || 1024}
                        height={item.config?.height || 1024}
                        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, (max-width: 1536px) 20vw, 15vw"
                        quality={GALLERY_THUMB_QUALITY}
                        unoptimized={isExternalMainImage}
                        loading="lazy"
                        fetchPriority="low"
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
                    <AddToMoodboardMenu imagePath={item.outputUrl} />

                    <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
                    <TooltipButton
                        icon={<Type className="w-4 h-4" />}
                        label="Use Prompt"
                        tooltipContent="Use Prompt"
                        tooltipSide="top"
                        className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
                        onClick={() => {
                            if (item.config?.prompt) {
                                usePlaygroundStore.getState().applyPrompt(item.config.prompt);
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
                                usePlaygroundStore.getState().applyImage(item.outputUrl);
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
                            const store = usePlaygroundStore.getState();
                            const {
                                applyImages,
                                setUploadedImages,
                                applyModel,
                                applyPrompt,
                                setSelectedPresetName,
                                setViewMode,
                                setActiveTab,
                                config: currentConfig
                            } = store;

                            // 1. 同步参考图 - 数据已规范化，直接从 config.sourceImageUrls 读取
                            const sourceUrls = item.config?.sourceImageUrls || [];
                            if (sourceUrls.length > 0) {
                                await applyImages(sourceUrls);
                            } else {
                                setUploadedImages([]);
                            }

                            // 2. 应用模型和参数
                            const fullConfig: GenerationConfig = {
                                ...currentConfig,
                                ...item.config,
                                prompt: item.config.prompt || '',
                                width: item.config.width || currentConfig.width,
                                height: item.config.height || currentConfig.height,
                                model: item.config.model || currentConfig.model,
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
                            await onGenerate({ configOverride: fullConfig });

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

function GallerySkeletonGrid({ columnsCount }: { columnsCount: number }) {
    const cols = Math.max(columnsCount, 1);

    return (
        <div className="flex gap-3 w-full">
            {Array.from({ length: cols }).map((_, colIdx) => (
                <div key={`gallery-skeleton-col-${colIdx}`} className="flex flex-col gap-3 flex-1 min-w-0">
                    {Array.from({ length: 3 }).map((__, itemIdx) => (
                        <div
                            key={`gallery-skeleton-item-${colIdx}-${itemIdx}`}
                            className="w-full rounded-xl bg-white/5 border border-white/10 animate-pulse"
                            style={{
                                paddingBottom: `${(itemIdx % 3 === 0 ? 140 : itemIdx % 3 === 1 ? 120 : 160)}%`
                            }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
