"use client";

import { useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Trash2,

  List
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

import { UIComponent, ComponentType } from "@/types/features/mapping-editor";

// 复制自 parameter-mapping-panel.tsx，保持一致
const PLAYGROUND_TARGETS = [
  { key: 'prompt', label: 'Prompt', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '📝' },
  { key: 'width', label: 'Width', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '📏' },
  { key: 'height', label: 'Height', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '📏' },

  { key: 'base_model', label: 'Base Model', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🤖' },
  { key: 'lora1', label: 'LoRA 1', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora2', label: 'LoRA 2', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora3', label: 'LoRA 3', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora1_strength', label: 'LoRA 1 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
  { key: 'lora2_strength', label: 'LoRA 2 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
  { key: 'lora3_strength', label: 'LoRA 3 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
  { key: 'batch_size', label: 'Batch Size', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '🔢' },
];

interface MappingListProps {
  components: UIComponent[];
  onDelete: (index: number) => void;
  className?: string;
}

export function MappingList({ components, onDelete, className }: MappingListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 使用原生事件监听器，设置 passive: false 以允许 preventDefault
  useEffect(() => {
    const container = containerRef.current;
    const scrollArea = scrollRef.current;
    if (!container || !scrollArea) return;

    const handleWheel = (e: WheelEvent) => {
      // 只有当存在横向滚动空间时才处理
      if (scrollArea.scrollWidth <= scrollArea.clientWidth) return;

      if (e.deltaY !== 0) {
        e.preventDefault();
        // 增加系数 (1.5) 让滚动更灵敏
        scrollArea.scrollLeft += e.deltaY * 1.5;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  if (components.length === 0) return null;


  return (
    <div ref={containerRef} className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3 text-white/80">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            <List className="w-4 h-4 text-white/60" />
          </div>
          <span className="text-sm font-medium">Parameter Mappings</span>
          <Badge variant="secondary" className=" text-white/40 border-0 font-mono">
            {components.length}
          </Badge>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex overflow-x-auto overflow-y-hidden gap-4 pb-4 px-4 -mx-4 no-scrollbar"
      >
        <AnimatePresence mode="popLayout">
          {PLAYGROUND_TARGETS.map((target) => {
            const component = components.find(c => c.properties.paramName === target.key);
            const isMapped = !!component;
            const originalIndex = components.findIndex(c => c.properties.paramName === target.key);

            return (
              <motion.div
                key={target.key}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn(
                  "flex-none w-[220px] group",
                  !isMapped && "opacity-40 grayscale cursor-not-allowed"
                )}
                onClick={() => {
                  if (!isMapped) return;
                  const element = document.getElementById(`node-${component.mapping.workflowPath[0]}`);
                  if (element) {
                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                    element.classList.add("ring-2", "ring-[#E1FFBB]", "ring-offset-2", "ring-offset-black");
                    setTimeout(() => {
                      element.classList.remove("ring-2", "ring-[#E1FFBB]", "ring-offset-2", "ring-offset-black");
                    }, 2000);
                  }
                }}
              >
                <Card
                  className={cn(
                    "group transition-all duration-200 overflow-hidden relative rounded-[32px] h-full",
                    isMapped
                      ? "cursor-pointer bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
                      : "cursor-default bg-[#131414] border-[#2a2b2b] hover:border-[#3a3b3b]"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[14px] font-bold text-white tracking-tight">
                            {target.label}
                          </div>
                        </div>

                        {isMapped && (
                          <div className="flex">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(originalIndex);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="text-[64px] flex items-center justify-center h-16 rounded-2xl ">
                          {target.icon}
                        </div>

                        <div className="flex-row items-center text-[#E1FFBB] flex gap-1.5 min-h-[40px]">
                          {isMapped ? (
                            <>
                              <span className="text-[12px]  p-2 px-2.5 rounded-xl font-mono border border-white/5">
                                #{component.mapping.workflowPath[0]}
                              </span>
                              <div className="flex-1 p-2 px-2.5 rounded-xl text-[12px] font-mono bg-[#2e2e2e] truncate border border-white/5">
                                <span className="text-[12px]">{component.mapping.parameterKey}</span>
                              </div>
                              <button
                                className="p-2 bg-[#2e2e2e] hover:bg-[#3e3e3e] text-white/40 hover:text-[#E1FFBB] rounded-xl transition-all group/btn border border-white/5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const element = document.getElementById(`node-${component.mapping.workflowPath[0]}`);
                                  if (element) {
                                    element.scrollIntoView({ behavior: "smooth", block: "center" });
                                    element.classList.add("ring-2", "ring-[#E1FFBB]", "ring-offset-2", "ring-offset-black");
                                    setTimeout(() => {
                                      element.classList.remove("ring-2", "ring-[#E1FFBB]", "ring-offset-2", "ring-offset-black");
                                    }, 2000);
                                  }
                                }}
                              >
                                <ArrowRight className="w-4 h-4 text-white drop-shadow-[0_0_2px_rgba(255,255,255,0.5)] group-hover/btn:translate-x-0.5 transition-transform" />
                              </button>
                            </>
                          ) : (
                            <div className="flex-1 flex items-center justify-center text-white/10 text-[11px] font-medium uppercase tracking-widest border border-dashed border-white/5 rounded-xl h-10">
                              No Mapping
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
