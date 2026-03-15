import React from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface HistoryLoadingSkeletonProps {
    layoutMode?: 'grid' | 'list';
    count?: number;
}

export function HistoryLoadingSkeleton({ layoutMode = 'list', count = 3 }: HistoryLoadingSkeletonProps) {
    if (layoutMode === 'grid') {
        return (
            <div className="w-full columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                {Array.from({ length: count * 2 }).map((_, i) => (
                    <div key={i} className="break-inside-avoid mb-4">
                        {/* Aspect Ratio simulation */}
                        <Skeleton
                            className={cn(
                                "w-full rounded-2xl",
                                i % 3 === 0 ? "aspect-[9/16]" : i % 2 === 0 ? "aspect-square" : "aspect-[16/9]"
                            )}
                        />
                    </div>
                ))}
            </div>
        );
    }

    // list layout
    return (
        <div className="flex flex-col gap-8 w-full mt-4 mx-auto max-w-[1600px]">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex items-center gap-4 text-[10px] uppercase">
                        <Skeleton className="h-4 w-32 rounded bg-white/5" />
                        <Skeleton className="h-4 w-24 rounded bg-white/5" />
                    </div>

                    <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,4fr)] gap-2">
                        {/* Source/Left Panel */}
                        <div className="relative w-full aspect-square rounded-xl bg-white/5 border border-white/10 p-2">
                            <Skeleton className="w-full h-full rounded-lg bg-white/5" />
                        </div>

                        {/* Items Grid */}
                        <div className="grid grid-cols-2 gap-4">
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div key={j} className="flex flex-col gap-2 p-4 rounded-2xl border border-white/5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Skeleton className="h-4 w-20 rounded bg-white/5" />
                                        <Skeleton className="h-4 w-12 rounded bg-white/5" />
                                    </div>
                                    {/* Prompt/Content area */}
                                    <Skeleton className="w-full h-24 rounded-lg bg-white/5" />
                                    <div className="flex gap-2 mt-2">
                                        <Skeleton className="w-12 h-12 rounded-lg bg-white/5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
