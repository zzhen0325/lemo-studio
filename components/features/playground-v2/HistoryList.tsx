import React from 'react';
import { motion } from "framer-motion";
import Image from "next/image";
import { Download, Type, Image as ImageIcon, Box, RefreshCw, Loader2, Copy, Check, Layers, Calendar, Maximize, Cpu } from "lucide-react";
import { GenerationResult } from '@/components/features/playground-v2/types';
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
  layoutMode?: 'grid' | 'list';
  onBatchUse?: (results: GenerationResult[], sourceImage?: string) => void;
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
  layoutMode = 'grid',
  onBatchUse,
}: HistoryListProps) {

  // Group history by type & key
  const groupedHistory = React.useMemo(() => {
    const groups: GroupedHistoryItem[] = [];

    history.forEach((result) => {
      const type = result.type || 'image';
      // Support both flat prompt (from history.json) and config.prompt (live generation)
      const promptValue = result.prompt || result.config?.prompt || "未知分组";
      const key = type === 'text' ? (result.sourceImage || "Unknown") : promptValue;

      // Find existing group for the same type (image/text), key and within a small time window (e.g. 1m)
      const existingGroup = groups.find(g =>
        g.type === type &&
        g.key === key &&
        Math.abs(new Date(g.items[0].timestamp).getTime() - new Date(result.timestamp).getTime()) < 60000
      );

      if (existingGroup) {
        existingGroup.items.push(result);
      } else {
        groups.push({
          type,
          key,
          items: [result],
          sourceImage: type === 'text' ? result.sourceImage : undefined
        });
      }
    });

    return groups;
  }, [history]);

  if (history.length === 0) return null;

  if (layoutMode === 'list') {
    return (
      <div className={cn(
        "relative flex flex-col w-full h-full overflow-y-auto custom-scrollbar px-4 pb-32",
        variant === 'default' ? "mt-80" : "mt-4"
      )}>
        <div className={cn(
          "flex flex-col gap-4 w-full mx-auto",
          variant === 'default' ? "max-w-[1500px]" : "max-w-full"
        )}>
          {groupedHistory.map((group, groupIdx) => (
            <div key={`group-${groupIdx}`} className="bg-[#1f2b494b] border border-white/5 rounded-xl p-4 overflow-hidden">
              {group.type === 'image' ? (
                <div className="grid grid-cols-5 gap-6 w-full">
                  {/* Left 4 cols: Images */}
                  <div className="col-span-4 grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, idx) => {
                      const result = group.items[idx];
                      return (
                        <div key={idx} className="aspect-square w-full">
                          {result ? (
                            <HistoryCard
                              result={result}
                              onRegenerate={onRegenerate}
                              onDownload={onDownload}
                              onImageClick={onImageClick}
                            />
                          ) : (
                            <div className="w-full h-full bg-white/5 rounded-sm border border-white/5" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Right 1 col: Metadata */}
                  <div className="col-span-1 flex flex-col gap-4 min-w-0">
                    {/* Time */}
                    <div className="flex items-center gap-2 text-white/40 text-xs">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{new Date(group.items[0].timestamp).toLocaleString()}</span>
                    </div>

                    {/* Size */}
                    <div className="flex items-center gap-2 text-white/40 text-xs">
                      <Maximize className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{group.items[0].config?.img_width || 1024} x {group.items[0].config?.img_height || 1024}</span>
                    </div>

                    {/* Model */}
                    <div className="flex items-center gap-2 text-white/40 text-xs">
                      <Cpu className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate" title={group.items[0].config?.base_model}>{group.items[0].config?.base_model || 'Unknown Model'}</span>
                    </div>

                    {/* Prompt */}
                    <div className="mt-2 p-3 bg-black/20 rounded-lg border border-white/5 flex-1 overflow-hidden flex flex-col">
                      <div className="flex items-center gap-2 mb-2 shrink-0">
                        <Type className="w-3 h-3 text-white/40" />
                        <span className="text-[10px] text-white/40 uppercase tracking-wider">Prompt</span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed line-clamp-[6] break-words" title={group.items[0].prompt || group.items[0].config?.prompt}>
                        {group.items[0].prompt || group.items[0].config?.prompt || "No prompt"}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Text/Describe Fallback
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <span className="text-xs text-white/40 uppercase tracking-wider">Image Analysis</span>
                  </div>
                  <div className="grid grid-cols-5 gap-6">
                    <div className="col-span-1">
                      {group.sourceImage && (
                        <div className="relative aspect-square rounded-sm overflow-hidden border border-white/10 bg-black/15">
                          <Image
                            src={group.sourceImage}
                            alt="Source"
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                    </div>
                    <div className="col-span-4 flex flex-col gap-2">
                      {group.items.map((result, idx) => (
                        <TextHistoryCard
                          key={result.id || `txt-${idx}`}
                          result={result}
                          onRegenerate={onRegenerate}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative flex flex-col w-full h-full overflow-y-auto custom-scrollbar px-4 pb-32",
      variant === 'default' ? "mt-80" : "mt-4"
    )}>
      <div className={cn(
        "columns-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4 gap-1 space-y-1 w-full mx-auto",
        variant === 'default' ? "max-w-[1500px]" : "max-w-full"
      )}>
        {groupedHistory.map((group, groupIdx) => (

          // 卡片总背景
          <div key={`group-${groupIdx}`} className="break-inside-avoid flex flex-col bg-[#1f2b494b]   overflow-hidden ">

                {group.type === 'image' ? (
                  // Image Generation Group: Standard header + Grid
                  <div className="flex flex-col">
                    {/* 文字区域 - 提示词在上方 */}
                    {/* <div className="p-4 bg-black/20  m-2 mb-0 rounded-2xl">
                      <p className="text-sm text-white line-clamp-4 transition-colors cursor-default" title={group.items[0].prompt || group.items[0].config?.prompt}>
                        {group.items[0].prompt || group.items[0].config?.prompt}
                      </p>
                    </div> */}

                    {/* 图片区域 - 在下方显示，根据数量决定网格 */}
                    <div className={cn(
                      "grid  rounded-sm h-auto w-full gap-1",
                      group.items.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    )}>
                      {group.items.map((result, idx) => (
                        <HistoryCard
                          key={result.id || result.imageUrl || `img-${idx}`}
                          result={result}
                          onRegenerate={onRegenerate}
                          onDownload={onDownload}
                          onImageClick={onImageClick}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  // Text/Describe Group: Unified Grid for Source Image + Text Cards
                  <div className="flex flex-col">
                    {/* Describe Group Header */}
                    <div className="p-4 bg-black/20 border-b border-white/5">
                      <p className="text-xs text-white/40 uppercase tracking-tighter">Image Analysis</p>
                    </div>

                    <div className="p-3 flex flex-col gap-3">
                      {/* Source Image Card */}
                      <div className="relative aspect-square rounded-sm overflow-hidden border border-white/10 bg-black/15 group">
                        {group.sourceImage ? (
                          <Image
                            src={group.sourceImage}
                            alt="Source for describe"
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
                            className="object-cover"
                            quality={75}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-[4px] text-[10px] text-white/80 font-medium border border-white/10 z-10">
                          Source
                        </div>

                        {onBatchUse && group.items.length > 0 && (
                          <div className="absolute bottom-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <div className="flex flex-col gap-2">
                        {group.items.map((result, idx) => (
                          <TextHistoryCard
                            key={result.id || `txt-${idx}`}
                            result={result}
                            onRegenerate={onRegenerate}
                          />
                        ))}
                      </div>
                    </div>
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
  onRegenerate,
  onDownload,
  onImageClick,
}: {
  result: GenerationResult;
  onRegenerate: (result: GenerationResult) => void;
  onDownload: (imageUrl: string) => void;
  onImageClick: (result: GenerationResult, initialRect?: DOMRect) => void;
}) {
  const [isHover, setIsHover] = React.useState(false);
  const applyPrompt = usePlaygroundStore(s => s.applyPrompt);
  const applyModel = usePlaygroundStore(s => s.applyModel);
  const applyImage = usePlaygroundStore(s => s.applyImage);
  const mainImage = result.imageUrl || (result.imageUrls && result.imageUrls[0]);

  return (
    <div
      className="group relative w-full overflow-hidden bg-black/15 rounded-sm border border-white/10 transition-all duration-300 hover:border-white/30"
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

      <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10  transition-all duration-50 ${isHover ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
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
  onRegenerate
}: {
  result: GenerationResult;
  onRegenerate: (result: GenerationResult) => void;
}) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    const promptValue = result.prompt || result.config?.prompt || '';
    navigator.clipboard.writeText(promptValue);
    setCopied(true);
    toast({ title: "Copied", description: "Prompt copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    // 文字卡片
    <div className="group relative flex flex-col p-4 bg-white/5 border border-white/10 rounded-lg hover:border-white/30 hover:bg-white/10 transition-all aspect-[3/4]">
      <div className="flex items-start gap-2 mb-2">
        <div className="p-1.5 rounded-md bg-white/10 text-white/60">
          <Type className="w-3.5 h-3.5" />
        </div>
        <div className="text-xs text-white/40 font-mono mt-1">
          Generated Description
        </div>
      </div>

      <p className="text-sm text-white/80 leading-relaxed font-light line-clamp-[8] flex-1">
        {result.prompt || result.config?.prompt}
      </p>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRegenerate(result)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg text-xs font-medium text-emerald-400 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Remix
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition-colors ml-auto"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div >
  );
}
