"use client";

import { } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Trash2,

  
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
  { key: 'sourceImageUrl1', label: 'Reference Image 1', type: 'reference_image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
  { key: 'sourceImageUrl2', label: 'Reference Image 2', type: 'reference_image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
  { key: 'sourceImageUrl3', label: 'Reference Image 3', type: 'reference_image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
  { key: 'sourceImageUrl4', label: 'Reference Image 4', type: 'reference_image' as ComponentType, supportedTypes: ['string'], icon: '🖼️' },
];

interface MappingListProps {
  components: UIComponent[];
  onDelete: (index: number) => void;
  onEdit?: (index: number) => void;
  className?: string;
}

export function MappingList({ components, onDelete, className }: MappingListProps) {


  return (
    <div className={cn("space-y-4 w-full", className)}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3 text-white/80">

          <span className="text-white/90 text-2xl font-black">Parameter Mappings</span>
          <Badge variant="secondary" className=" text-white/40 border-0 font-mono">
            {components.length}
          </Badge>
        </div>
      </div>

      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 w-full"
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
                  "group",
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
                    "group transition-all duration-200 overflow-hidden relative rounded-[24px] h-full p-1.5 border-none",
                    isMapped
                      ? "cursor-pointer bg-gradient-to-b from-[#1079BB] to-[#58B6F1]"
                      : "cursor-default bg-[#2C2D2F] border-[#2a2b2b] hover:border-[#3a3b3b]"
                  )}
                >
                  <CardContent className="p-0 h-full">
                    <div className="flex flex-col gap-[14px] h-full">
                      {/* Header Frame */}
                      <div className={cn(
                        "flex items-center justify-center relative rounded-[24px] min-h-[54px] px-4",
                        isMapped ? "bg-[#132E3E]" : "bg-[#18191B]"
                      )}>
                        <div className="text-[20px] font-serif font-black text-white text-center truncate">
                          {target.label}
                        </div>

                        {isMapped && (
                          <div className="absolute right-2">
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

                      {/* Bottom Row Frame */}
                      <div className="flex items-center gap-1 px-1 pb-1">
                        {isMapped ? (
                          <>
                            {/* Node ID Badge */}
                            <div className="flex-none bg-[#0A649C]/50 border border-[#49AFEF] rounded-[16px] px-3 py-3 h-12 flex items-center justify-center">
                              <span className="text-[14px] font-medium text-white whitespace-nowrap">
                                #{component.mapping.workflowPath[0]}
                              </span>
                            </div>

                            {/* Parameter Key Badge */}
                            <div className="flex-1 bg-[#0A649C]/50 border border-[#49AFEF] rounded-[16px] px-4 py-3 h-12 flex items-center justify-center min-w-0">
                              <span className="text-[14px] font-medium text-white truncate">
                                {component.mapping.parameterKey}
                              </span>
                            </div>

                            {/* Action Button */}
                            <button
                              className="flex-none bg-[#0A649C]/50 border border-[#49AFEF] hover:bg-white hover:text-[#1079BB] text-white rounded-[16px] w-12 h-12 flex items-center justify-center transition-all"
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
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-white/10 text-[11px] font-medium uppercase tracking-widest bg-[#18191B] border border-white/5 rounded-[16px] h-12">
                            No Mapping
                          </div>
                        )}
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
