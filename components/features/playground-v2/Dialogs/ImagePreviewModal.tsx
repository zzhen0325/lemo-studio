import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RefreshCw, Pencil, Info, Copy, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { Generation } from '@/types/database';
import { useToast } from '@/hooks/common/use-toast';
import { cn } from '@/lib/utils';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  result?: Generation;
  onEdit?: (result: Generation) => void;
}

export default function ImagePreviewModal({ isOpen, onClose, result, onEdit }: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [showSidebar, setShowSidebar] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setScale(1);
    }
  }, [isOpen]);

  if (!result) return null;

  const imageUrl = result.outputUrl || "";
  const config = result.config;
  const prompt = config?.prompt || "";

  const handleZoomIn = (e?: React.MouseEvent) => { e?.stopPropagation(); setScale(prev => Math.min(prev * 1.2, 5)); };
  const handleZoomOut = (e?: React.MouseEvent) => { e?.stopPropagation(); setScale(prev => Math.max(prev / 1.2, 0.1)); };
  const handleReset = (e?: React.MouseEvent) => { e?.stopPropagation(); setScale(1); };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  const handleBackgroundClick = () => {
    onClose();
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    toast({ title: "已复制", description: "提示词已复制到剪贴板" });
  };

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `image-${result.id || Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex overflow-hidden pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            onClick={handleBackgroundClick}
            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
          />

          {/* Main Content Area */}
          <div className="relative flex flex-1 h-full overflow-hidden">

            {/* Image Viewport - 占据剩余空间 */}
            <div className={cn(
              "relative flex-1 h-full flex items-center justify-center overflow-hidden transition-all duration-300",
              showSidebar ? "mr-0" : "mr-0"
            )}>
              <div
                className="w-full h-full flex flex-col items-center justify-center"
                onWheel={handleWheel}
                onClick={handleBackgroundClick}
              >
                <motion.div
                  layoutId={`image-${result.id}`}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  style={{
                    scale: scale,
                  }}
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Image
                    src={imageUrl}
                    alt="Preview"
                    width={1200}
                    height={1200}
                    unoptimized
                    className="max-w-[95%] select-none w-auto h-auto max-h-[75vh] rounded-2xl shadow-2xl border border-white/10"
                    style={{ pointerEvents: 'auto' }}
                    draggable={false}
                  />


                  {/* Control Bar - 底部居中 */}
                  <div className='flex justify-center w-full mt-10'>


                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ delay: 0.2 }}
                      className=" flex  w-fit  items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-white/60 hover:text-white hover:bg-white/10" onClick={handleZoomOut}>
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-white/40 font-mono min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
                      <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-white/60 hover:text-white hover:bg-white/10" onClick={handleZoomIn}>
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      <div className="w-px h-4 bg-white/10 mx-1" />
                      <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-white/60 hover:text-white hover:bg-white/10" onClick={handleReset}>
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <div className="w-px h-4 bg-white/10 mx-1" />
                      <Button variant="ghost" size="icon" className="w-9 h-9 rounded-full text-white/60 hover:text-white hover:bg-white/10" onClick={handleDownload}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="act"
                        size="sm"
                        className="h-9 px-4 rounded-full transition-all font-medium gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(result);
                        }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </motion.div>
                  </div>

                </motion.div>


              </div>



              {/* ESC 提示 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="absolute top-4 left-4 z-[100] px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/30 text-[10px] font-mono uppercase tracking-wider"
              >
                ESC to close
              </motion.div>

              {/* 侧边栏切换按钮 */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-4 right-4 z-[100] p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <Info className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Sidebar - 固定宽度，不会超出屏幕 */}
            <AnimatePresence>
              {showSidebar && (
                <motion.div
                  initial={{ x: "100%", opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "100%", opacity: 0 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="relative w-[20vw] shrink-0 h-full bg-black/60 backdrop-blur-2xl border-l border-white/10 flex flex-col z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
                    <h3 className="text-lg text-white" style={{ fontFamily: "'InstrumentSerif', serif" }}>Details</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 rounded-full text-white/40 hover:text-white hover:bg-white/10"
                      onClick={onClose}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Content - 可滚动区域 */}
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4 space-y-6">
                      {/* Prompt Section */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Prompt</span>
                          <button
                            onClick={handleCopyPrompt}
                            className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-all"
                            title="复制提示词"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                          <p className="text-white/80 text-sm leading-relaxed break-words">
                            {prompt || "No prompt available"}
                          </p>
                        </div>
                      </div>

                      {/* Model Section */}
                      <div className="space-y-3">
                        <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Model</span>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
                            {config?.model || "Standard"}
                          </span>
                          {config?.loras && config.loras.length > 0 && (
                            config.loras.map((l, idx) => (
                              <span
                                key={idx}
                                className="px-3 py-1.5 bg-white/5 text-white/60 text-xs font-medium rounded-full border border-white/10 truncate max-w-full"
                              >
                                {l.model_name.replace('.safetensors', '')} ({l.strength})
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Parameters Section */}
                      <div className="space-y-3">
                        <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Parameters</span>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] text-white/30 uppercase font-mono">Width</span>
                            <span className="text-white text-sm font-medium tabular-nums">{config?.width || '-'}</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-1">
                            <span className="text-[9px] text-white/30 uppercase font-mono">Height</span>
                            <span className="text-white text-sm font-medium tabular-nums">{config?.height || '-'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Preset Section */}
                      {config?.presetName && (
                        <div className="space-y-3">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Preset</span>
                          <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-white/80 text-sm">{config.presetName}</span>
                          </div>
                        </div>
                      )}

                      {/* Timestamp */}
                      {result.createdAt && (
                        <div className="space-y-3">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Created</span>
                          <div className="text-white/50 text-xs font-mono">
                            {new Date(result.createdAt).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
