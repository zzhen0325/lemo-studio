import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RefreshCw, Pencil, Info, Copy, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { Generation } from '@/types/database';
import { useToast } from '@/hooks/common/use-toast';

import { formatImageUrl } from '@/lib/api-base';
import { usePlaygroundStore } from '@/lib/store/playground-store';
import { useImageSource } from '@/hooks/common/use-image-source';
import { downloadImage } from '@/lib/utils/download';

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
  const [mounted, setMounted] = useState(false);

  // 数据已规范化，直接从 config.sourceImageUrls 读取
  const sourceUrls = result?.config?.sourceImageUrls || [];


  useEffect(() => {
    setMounted(true);
  }, []);

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

  const imageUrl = formatImageUrl(result.outputUrl || "");
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
      downloadImage(imageUrl, `image-${result.id || Date.now()}.png`);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[10000] flex overflow-hidden pointer-events-auto"
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
          {/* Main Content Area */}
          <div className="relative flex flex-1 h-full overflow-hidden">

            {/* Image Viewport - Container for scaling image and fixed control bar */}
            <div
              className="relative flex-1 h-full flex flex-col items-center justify-center overflow-auto p-12 transition-all duration-300"
              onWheel={handleWheel}
              onClick={handleBackgroundClick}
            >
              {/* Scalable Image Container */}
              <motion.div
                layoutId={`image-${result.id}`}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ scale: scale }}
                className="relative shrink-0"
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
              </motion.div>

              {/* Fixed Control Bar - sibling to scaled image */}
              <div className='flex justify-center w-full mt-10 shrink-0'>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ delay: 0.2 }}
                  className="flex w-fit items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl"
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

              {/* Reference Image Thumbnails - absolute to Viewport */}
              {sourceUrls.length > 0 && (
                <div className="absolute top-10 left-6 z-[110] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                  {sourceUrls.map((url, idx) => (
                    <ReferenceImageItem
                      key={`${result.id}-${idx}`}
                      url={url}
                      localId={idx === 0 ? result.config?.localSourceId : undefined}
                      generationId={result.id}
                      index={idx}
                    />
                  ))}
                </div>
              )}

              {/* Sidebar toggle */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute top-4 right-4 z-[100] p-2.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <Info className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Sidebar */}

            {/* Sidebar */}
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

                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-4 space-y-6">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Prompt</span>
                          <button
                            onClick={handleCopyPrompt}
                            className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/10 transition-all"
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

                      <div className="space-y-3">
                        <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Model</span>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-full border border-primary/20">
                            {config?.model || "Standard"}
                          </span>
                          {config?.loras?.map((l, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-white/5 text-white/60 text-xs font-medium rounded-full border border-white/10 truncate max-w-full">
                              {l.model_name.replace('.safetensors', '')} ({l.strength})
                            </span>
                          ))}
                        </div>
                      </div>

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

                      {config?.presetName && (
                        <div className="space-y-3">
                          <span className="text-[10px] text-white/30 uppercase font-mono tracking-wider">Preset</span>
                          <div className="px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-white/80 text-sm">{config.presetName}</span>
                          </div>
                        </div>
                      )}

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
    </AnimatePresence>,
    document.body
  );
}

function ReferenceImageItem({
  url,
  localId,
  generationId,
  index
}: {
  url: string;
  localId?: string;
  generationId: string;
  index: number;
}) {
  const setPreviewImage = usePlaygroundStore(s => s.setPreviewImage);
  const sourceImage = useImageSource(url);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        delay: index * 0.1,
        type: "spring",
        stiffness: 400,
        damping: 25
      }}
      className="group/ref relative flex flex-col items-center"
    >
      <div
        className="w-20 h-20 rounded-xl border-2 border-white overflow-hidden shadow-2xl cursor-zoom-in relative"
        onClick={(e) => {
          e.stopPropagation();
          setPreviewImage(sourceImage || url || null, `ref-${generationId}-${index}`);
        }}
      >
        <Image
          src={sourceImage || formatImageUrl(url)}
          alt={`Reference ${index + 1}`}
          fill
          className="object-cover"
          sizes="80px"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/20 group-hover/ref:bg-transparent transition-colors flex items-center justify-center">
          <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/ref:opacity-100 transition-opacity" />
        </div>
      </div>
      <div className="mt-2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-[9px] text-white/90 uppercase font-bold tracking-tight text-center shadow-lg">
        Ref {index + 1}
      </div>
    </motion.div>
  );
}
