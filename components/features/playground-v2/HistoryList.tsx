import React from 'react';
import { motion } from "framer-motion";
import Image from "next/image";
import { Download, Type, Image as ImageIcon, Box, RefreshCw, Loader2, Copy, Layers, Settings2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GenerationResult, GenerationConfig } from '@/components/features/playground-v2/types';
import { TooltipButton } from "@/components/ui/tooltip-button";
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/common/use-toast";


interface HistoryListProps {
  history: GenerationResult[];
  onRegenerate: (result: GenerationResult) => void;
  onDownload: (imageUrl: string) => void;
  onImageClick: (result: GenerationResult, initialRect?: DOMRect) => void;
  isGenerating?: boolean;
  variant?: 'default' | 'sidebar';
  onBatchUse?: (results: GenerationResult[], sourceImage?: string) => void;
  layoutMode?: 'grid' | 'list';
}

interface GroupedHistoryItem {
  type: 'image' | 'text';
  key: string; // prompt for image, sourceImage for text
  items: GenerationResult[];
  sourceImage?: string; // only for text type
}

export default function HistoryList({
  history,
  onRegenerate,
  onDownload,
  onImageClick,
  variant = 'default',
  onBatchUse,
  layoutMode = 'list',
}: HistoryListProps) {

  // Group history by type & key
  const groupedHistory = React.useMemo(() => {
    const groups: GroupedHistoryItem[] = [];

    history.forEach((result) => {
      const type = result.type || 'image';
      const config = result.config || result.metadata;

      // key components for comparison
      const prompt = result.prompt || config?.prompt || "";
      const model = config?.base_model || "";
      const width = config?.img_width || 0;
      const height = config?.img_height || 0;
      const lora = config?.lora || "";
      const refImage = (config as { ref_image?: string })?.ref_image || "";

      // Find existing group for the same type, parameters and within 30s
      const existingGroup = groups.find(g => {
        if (g.type !== type) return false;

        // Time check: within 30s of the first item in the group
        const firstItemTime = new Date(g.items[0].timestamp).getTime();
        const currentTime = new Date(result.timestamp).getTime();
        if (Math.abs(firstItemTime - currentTime) > 30000) return false;

        if (type === 'text') {
          return g.sourceImage === result.sourceImage;
        } else {
          const gConfig = g.items[0].config || g.items[0].metadata;
          return (
            (g.items[0].prompt || gConfig?.prompt || "") === prompt &&
            (gConfig?.base_model || "") === model &&
            (gConfig?.img_width || 0) === width &&
            (gConfig?.img_height || 0) === height &&
            (gConfig?.lora || "") === lora &&
            (gConfig?.ref_image || "") === refImage
          );
        }
      });

      if (existingGroup) {
        existingGroup.items.push(result);
      } else {
        groups.push({
          type,
          key: type === 'text' ? (result.sourceImage || "Unknown") : prompt,
          items: [result],
          sourceImage: type === 'text' ? result.sourceImage : undefined
        });
      }
    });

    return groups;
  }, [history]);

  if (history.length === 0) return null;

  return (
    <div className={cn(
      "relative flex flex-col w-full h-full overflow-y-auto custom-scrollbar px-4 pb-32",
      variant === 'default' ? "mt-80" : "mt-4"
    )}>
      <div className={cn(
        layoutMode === 'list'
          ? "flex flex-col gap-4 w-full mx-auto"
          : "columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4 gap-2 space-y-4 w-full mx-auto",
        variant === 'default' ? "max-w-[1500px]" : "max-w-full"
      )}>
        {groupedHistory.map((group, groupIdx) => (

          // 卡片总背景
          <div key={`group-${groupIdx}`} className="break-inside-avoid flex flex-col bg-transparent  overflow-hidden mb-2">

            {group.type === 'image' ? (
              // Image Generation Group: Standard header + Grid
              <div className="flex flex-col">


                {/* 图片生成分组内容 */}
                {layoutMode === 'list' ? (
                  // List mode: Display the entire group as one single card
                  <HistoryCard
                    result={group.items[0]}
                    allResults={group.items}
                    onRegenerate={onRegenerate}
                    onDownload={onDownload}
                    onImageClick={onImageClick}
                    layoutMode={layoutMode}
                  />
                ) : (
                  // Grid mode: individual cards within a visually unified structure
                  <div className={cn(
                    "p-2 rounded-2xl h-auto w-full gap-2 grid",
                    group.items.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  )}>
                    {group.items.map((result, idx) => (
                      <HistoryCard
                        key={result.id || result.imageUrl || `img-${idx}`}
                        result={result}
                        onRegenerate={onRegenerate}
                        onDownload={onDownload}
                        onImageClick={onImageClick}
                        layoutMode={layoutMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              // Text/Describe Group: Unified Grid for Source Image + Text Cards
              <div className="flex flex-col gap-6 mt-16 group/card">
                {/* Header: Metadata (timestamp and title) */}
                <div className="flex items-center justify-between gap-4 text-[10px] text-white/30 font-mono uppercase tracking-tight px-1">
                  <div className="flex items-center gap-4">
                    <span>{new Date(group.items[0].timestamp).toLocaleString()}</span>
                    <span className="opacity-20">/</span>
                    <span className="text-white/40">Image Analysis</span>
                  </div>
                </div>

                {layoutMode === 'list' ? (
                  <div className="relative bg-transparent grid grid-cols-5 gap-4 items-stretch content-start">
                    {/* Source Image Card */}
                    <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 group/img">
                      {group.sourceImage ? (
                        <img
                          src={group.sourceImage}
                          alt="Source for describe"
                          className="w-full h-auto cursor-pointer transition-transform duration-500 rounded-xl group-hover/img:scale-[1.05]"
                        />
                      ) : (
                        <div className="w-full aspect-square flex items-center justify-center text-white/20">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-[4px] text-[10px] text-white/80 font-medium border border-white/10 z-10">
                        Source
                      </div>

                      {onBatchUse && group.items.length > 0 && (
                        <div className="absolute bottom-2 right-2 z-20 opacity-0 group-hover/img:opacity-100 transition-opacity">
                          <button
                            className="p-1.5 rounded-lg bg-black/60 hover:bg-emerald-500 text-white/80 hover:text-white border border-white/10 transition-colors"
                            onClick={() => onBatchUse(group.items, group.sourceImage)}
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Text Cards */}
                    {group.items.map((result, idx) => (
                      <TextHistoryCard
                        key={result.id || `txt-${idx}`}
                        result={result}
                      />
                    ))}
                  </div>
                ) : (
                  // Grid mode for text: Show as a unified interactive card
                  <div className="w-full">
                    <DescribeInteractiveCard
                      group={group}
                      onImageClick={(result, rect) => {
                        onImageClick(result, rect);
                      }}
                    />
                  </div>
                )}
              </div>
            )}

          </div>
        ))}
      </div>
    </div >
  );
}

function HistoryCard({
  result,
  allResults,
  onRegenerate,
  onDownload,
  onImageClick,
  layoutMode = 'list',
}: {
  result: GenerationResult;
  allResults?: GenerationResult[];
  onRegenerate: (result: GenerationResult) => void;
  onDownload: (imageUrl: string) => void;
  onImageClick: (result: GenerationResult, initialRect?: DOMRect) => void;
  layoutMode?: 'grid' | 'list';
}) {
  const [isHover, setIsHover] = React.useState(false);
  const { applyPrompt, applyModel, applyImage } = usePlaygroundStore();
  const { toast } = useToast();
  const mainImage = result.imageUrl || (result.imageUrls && result.imageUrls[0]);

  const config = result.config || result.metadata;
  const prompt = result.prompt || config?.prompt || '';
  const timeStr = new Date(result.timestamp).toLocaleString();

  if (layoutMode === 'list') {
    const resultsToDisplay = allResults || [result];


    return (
      <div className="flex flex-col w-full bg-transparent transition-all mt-16 group/card gap-6">
        {/* Header: Metadata & Actions */}
        <div className="flex items-center justify-between gap-4 text-[10px] text-white/30 font-mono uppercase tracking-tight px-1">
          <div className="flex items-center gap-4">
            <span>{timeStr}</span>
            <span className="opacity-20">/</span>
            <span className="text-white/40">{config?.base_model || 'Unknown'}</span>
            <span className="opacity-20">/</span>
            <span className="text-white/40">{config?.img_width} x {config?.img_height}</span>
            {config?.lora && (
              <>
                <span className="opacity-20">/</span>
                <span className="text-emerald-500/60 lowercase font-sans font-medium bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10">lora: {config.lora}</span>
              </>
            )}
          </div>


        </div>

        {/* Grid: Prompt Card + Images */}
        <div className={cn(
          "relative bg-transparent grid grid-cols-5 gap-4 content-start"
        )}>
          {/* Prompt slot (styled as a card) */}
          <div
            className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col justify-start"
            style={{ aspectRatio: `${config?.img_width || 1024} / ${config?.img_height || 1024}` }}
          >
            <div className="flex items-center gap-1.5 text-[10px] text-white/20 uppercase font-medium mb-3">
              <span className="block w-1 h-1 rounded-full bg-white/20" />
              Prompt
            </div>
            <p className="text-[11px] text-white/90 leading-relaxed line-clamp-[8]">
              {prompt}
            </p>

            <div className="flex absolute  top-2 right-2 items-center gap-2 ">
              <TooltipButton
                icon={<Copy className="w-3 h-3" />}
                label="Copy Prompt"
                tooltipContent="Copy Prompt"
                className="w-8 h-8 ml-2 text-white/70"
                onClick={() => {
                  navigator.clipboard.writeText(prompt);
                  toast({
                    title: "已复制",
                    description: "提示词已复制到剪贴板",
                  });
                }}
              />


            </div>

            <div className="flex absolute  bottom-2 left-1/2 -translate-x-1/2   gap-2 ">
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg  border-white/10 bg-white/5 text-white/70 hover:bg-emerald-500/10 hover:border-emerald-500/40 gap-1.5 px-3"
                onClick={() => onRegenerate(result)}
              >
                <RefreshCw className="w-3 h-3" />
                <span className="text-[10px]">Remix</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white gap-1.5 px-3"
                onClick={() => {
                  if (config) {
                    applyModel(config.base_model || '', config as GenerationConfig);
                    applyPrompt(prompt);
                    toast({
                      title: "参数已回填",
                      description: "生成参数已应用到当前配置",
                    });
                  }
                }}
              >
                <Settings2 className="w-3 h-3" />
                <span className="text-[10px]">Edit</span>
              </Button>

            </div>
          </div>
          {resultsToDisplay.map((res, idx) => {
            const img = res.imageUrl || (res.imageUrls && res.imageUrls[0]);
            return (


              <div
                key={res.id || idx}
                className="relative w-full overflow-hidden rounded-xl group/img border border-white/5 bg-white/5"
                style={{ aspectRatio: `${config?.img_width || 1024} / ${config?.img_height || 1024}` }}
              >
                {res.isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-white/10" />
                  </div>
                ) : img ? (
                  <Image
                    src={img}
                    alt="Generated image"
                    fill
                    sizes="(max-width: 1536px) 50vw, 800px"
                    className="object-contain cursor-pointer transition-transform duration-500  rounded-xl group-hover/img:scale-[1.05]"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onImageClick(res, rect);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/5">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                )}
                {/* Individual Actions Overlay */}
                {!res.isLoading && img && (
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                    <TooltipButton
                      icon={<Download className="w-3.5 h-3.5" />}
                      label="Download"
                      tooltipContent="Download"
                      className="w-7 h-7 bg-black/60 rounded-lg"
                      onClick={() => onDownload(img)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative w-full overflow-hidden bg-black/15 rounded-2xl border border-white/10 transition-all duration-300 hover:border-white/30"
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-0 w-full h-auto"
      >
        {result.isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-black/20">
            <Loader2 className="w-8 h-8 animate-spin text-white/20" />
          </div>
        ) : mainImage ? (
          <Image
            src={mainImage}
            alt="Generated image"
            width={result.config?.img_width || 1024}
            height={result.config?.img_height || 1024}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
            quality={95}
            className="w-full h-auto cursor-pointer scale-100 group-hover:scale-105 transition-transform duration-500"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onImageClick(result, rect);
            }}
          />
        ) : (
          <div className="w-full h-full bg-black/20 flex items-center justify-center" />
        )}
      </motion.div>

      <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl transition-all duration-50 ${isHover ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
        <TooltipButton
          icon={<Type className="w-4 h-4" />}
          label="Use Prompt"
          tooltipContent="Use Prompt"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => applyPrompt(result.prompt || result.config?.prompt || '')}
        />
        <TooltipButton
          icon={<ImageIcon className="w-4 h-4" />}
          label="Use Image"
          tooltipContent="Use Image"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => mainImage && applyImage(mainImage)}
        />
        <TooltipButton
          icon={<Box className="w-4 h-4" />}
          label="Use Model"
          tooltipContent="Use Model"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => result.config && applyModel(result.config.base_model, result.config)}
        />
        <div className="w-[1px] h-4 bg-white/10 mx-0.5" />
        <TooltipButton
          icon={<RefreshCw className="w-4 h-4" />}
          label="Remix"
          tooltipContent="Recreate"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
          onClick={() => onRegenerate(result)}
        />
        <TooltipButton
          icon={<Download className="w-4 h-4" />}
          label="Download"
          tooltipContent="Download"
          tooltipSide="top"
          className="w-8 h-8 rounded-xl text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => mainImage && onDownload(mainImage)}
        />
      </div>
    </div>
  );
}

function TextHistoryCard({
  result,
}: {
  result: GenerationResult;
}) {
  const { toast } = useToast();
  const { applyPrompt } = usePlaygroundStore();
  const prompt = result.prompt || result.config?.prompt || '';

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    applyPrompt(prompt);
    toast({ title: "提示词已应用", description: "已将描述填充到输入框" });
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col justify-start group/card"
    >
      <div className="flex items-center gap-1.5 text-[10px] text-white/20 uppercase font-medium mb-3">
        <span className="block w-1 h-1 rounded-full bg-white/20" />
        {result.isLoading ? 'Analyzing...' : 'Image Description'}
      </div>

      <div className="flex-1 overflow-hidden">
        {result.isLoading ? (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white/10" />
          </div>
        ) : (
          <p className="text-[11px] text-white/90 leading-relaxed line-clamp-[10]">
            {prompt}
          </p>
        )}
      </div>

      {!result.isLoading && (
        <>
          <div className="flex absolute bottom-3 left-1/2 -translate-x-1/2 gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-lg border-white/10 bg-white/5 text-primary hover:bg-white/20 hover:border-primary/40 gap-1.5 px-3"
              onClick={handleApply}
            >
              <Type className="w-3 h-3" />
              <span className="text-[10px]">Use Prompt</span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function DescribeInteractiveCard({
  group,
  onImageClick,
}: {
  group: GroupedHistoryItem;
  onImageClick: (result: GenerationResult, initialRect?: DOMRect) => void;
}) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const currentItem = group.items[currentIndex];
  const prompt = currentItem?.prompt || currentItem?.config?.prompt || '';
  const { toast } = useToast();
  const { applyPrompt } = usePlaygroundStore();

  const handleApply = (e: React.MouseEvent) => {
    e.stopPropagation();
    applyPrompt(prompt);
    toast({ title: "提示词已应用", description: "已将描述填充到输入框" });
  };

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % group.items.length);
  };

  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + group.items.length) % group.items.length);
  };

  return (
    <div className="group relative w-full overflow-hidden bg-black/15 rounded-2xl border border-white/10 transition-all duration-300 hover:border-white/30 aspect-square">
      {/* Base Image */}
      {group.sourceImage ? (
        <Image
          src={group.sourceImage}
          alt="Source"
          fill
          className="object-cover"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onImageClick(currentItem, rect);
          }}
        />
      ) : (
        <div className="w-full h-full bg-black/40 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-white/20" />
        </div>
      )}

      {/* Overlay Description */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[4px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col p-6 justify-center items-center text-center">
        <div className="flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center w-full px-4">
          <p className="text-[11px] text-white/90 leading-relaxed line-clamp-[8]">
            {prompt}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-xl border-white/10 bg-white/5 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 gap-1.5 px-3"
            onClick={handleApply}
          >
            <Type className="w-3.5 h-3.5" />
            <span className="text-[10px]">Use Prompt</span>
          </Button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {group.items.length > 1 && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <button
            onClick={prev}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all pointer-events-auto"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={next}
            className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-black/60 transition-all pointer-events-auto"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pagination dots */}
      {group.items.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-30 bg-black/30 backdrop-blur-sm px-2.5 py-1.5 rounded-full border border-white/5">
          {group.items.map((_, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(idx);
              }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                currentIndex === idx ? "bg-emerald-400 w-3" : "bg-white/20 hover:bg-white/40"
              )}
            />
          ))}
        </div>
      )}

      {/* Type badge */}
      <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-[4px] text-[10px] text-white/80 font-medium border border-white/10 z-10">
        Analysis
      </div>
    </div>
  );
}
