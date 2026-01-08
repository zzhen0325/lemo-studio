import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RefreshCw, Pencil, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { motion, AnimatePresence } from 'framer-motion';
import { Generation } from '@/types/database';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  result?: Generation;
  onEdit?: (result: Generation) => void;
}

export default function ImagePreviewModal({ isOpen, onClose, result, onEdit }: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!result) return null;

  const imageUrl = result.outputUrl || "";
  const config = result.config;

  const handleZoomIn = (e: React.MouseEvent) => { e.stopPropagation(); setScale(prev => Math.min(prev * 1.2, 5)); };
  const handleZoomOut = (e: React.MouseEvent) => { e.stopPropagation(); setScale(prev => Math.max(prev / 1.2, 0.1)); };
  const handleReset = (e: React.MouseEvent) => { e.stopPropagation(); setScale(1); setPosition({ x: 0, y: 0 }); };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasMoved(false);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - (dragStart.x + position.x));
    const dy = Math.abs(e.clientY - (dragStart.y + position.y));
    if (dx > 5 || dy > 5) setHasMoved(true);
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => { setIsDragging(false); };

  const handleBackgroundClick = () => {
    if (!hasMoved) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            onClick={handleBackgroundClick}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          />

          {/* Main Content */}
          <div className="relative flex-1 h-full flex items-center justify-center overflow-hidden pointer-events-none">
            {/* Image Viewport */}
            <div
              className="w-full h-full flex items-center justify-center cursor-move pointer-events-auto"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleBackgroundClick}
            >
              <motion.div
                layoutId={`image-${result.id}`}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{
                  x: position.x,
                  y: position.y,
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
                  className="max-w-none select-none w-auto h-auto max-h-[90vh] rounded-xl shadow-2xl"
                  style={{ pointerEvents: 'auto' }}
                  draggable={false}
                />
              </motion.div>
            </div>

            {/* Control Bar - Moved after image container to be on top */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.2 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-3 rounded-full bg-black/60 backdrop-blur-2xl border border-white/20 shadow-2xl pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10" onClick={handleZoomOut}>
                <ZoomOut className="w-5 h-5" />
              </Button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10" onClick={handleReset}>
                <RefreshCw className="w-5 h-5" />
              </Button>
              <div className="w-px h-4 bg-white/10 mx-1" />
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10" onClick={handleZoomIn}>
                <ZoomIn className="w-5 h-5" />
              </Button>
              <div className="w-px h-8 bg-white/10 mx-2" />
              <Button
                variant="ghost"
                size="sm"
                className="h-10 px-4 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition-all font-bold gap-2 shadow-lg shadow-emerald-500/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(result);
                }}
              >
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <div className="w-px h-8 bg-white/10 mx-2" />
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-full bg-white/10 text-white hover:bg-red-500 hover:text-white transition-colors" onClick={onClose}
              >
                <X className="w-5 h-5" />
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="absolute top-4 left-4 z-[100] px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 text-white/40 text-xs font-medium"
            >
              Esc to close
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-4 right-4 md:hidden z-[100] p-3 rounded-full bg-black/60 backdrop-blur-xl border border-white/20 text-white hover:bg-white/10 transition-colors"
              onClick={() => setShowSidebar(!showSidebar)}
            >
              <Info className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Sidebar */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`w-[360px] h-full bg-black/40 backdrop-blur-xl border-l border-white/10 flex-col z-50 ${showSidebar ? 'flex' : 'hidden md:flex'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white tracking-tight">Image Details</h3>
              <Button variant="ghost" size="icon" className="rounded-full text-white/40 hover:text-white hover:bg-white/10" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-6 space-y-8">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Prompt</h4>
                  <div className="p-5 bg-white/5 rounded-[2rem] border border-white/5 group hover:border-white/10 transition-colors duration-300">
                    <p className="text-white/80 text-sm leading-relaxed font-light italic">
                      &ldquo;{config?.prompt}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Model</h4>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-4 py-2 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20 uppercase tracking-wider">
                      {config?.model || "Standard"}
                    </span>
                    {config?.loras && config.loras.length > 0 && (
                      config.loras.map((l, idx) => (
                        <span key={idx} className="px-4 py-2 bg-white/5 text-white/60 text-xs font-bold rounded-full border border-white/5 uppercase tracking-wider">
                          {l.model_name.replace('.safetensors', '')} ({l.strength})
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Parameters</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-black/20 rounded-3xl border border-white/5 flex flex-col space-y-1">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Width</span>
                      <span className="text-white text-lg font-medium tabular-nums">{config?.width}</span>
                    </div>
                    <div className="p-5 bg-black/20 rounded-3xl border border-white/5 flex flex-col space-y-1">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Height</span>
                      <span className="text-white text-lg font-medium tabular-nums">{config?.height}</span>
                    </div>
                    <div className="p-5 bg-black/20 rounded-3xl border border-white/5 flex flex-col space-y-1">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Count</span>
                      <span className="text-white text-lg font-medium tabular-nums">{1}</span>
                    </div>
                    <div className="p-5 bg-black/20 rounded-3xl border border-white/5 flex flex-col space-y-1">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Model</span>
                      <span className="text-white text-xs font-medium tabular-nums truncate">{config?.model || 'Standard'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
