"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Trash2,
  Edit3,
  List,
  Target
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { UIComponent, ComponentType } from "@/types/features/mapping-editor";

// 复制自 parameter-mapping-panel.tsx，保持一致
const PLAYGROUND_TARGETS = [
  { key: 'prompt', label: 'Prompt', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '📝' },
  { key: 'width', label: 'Width', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '📏' },
  { key: 'height', label: 'Height', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '📏' },
  { key: 'batch_size', label: 'Batch Size', type: 'number' as ComponentType, supportedTypes: ['number', 'string'], icon: '🔢' },
  { key: 'base_model', label: 'Base Model', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🤖' },
  { key: 'lora1', label: 'LoRA 1', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora2', label: 'LoRA 2', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora3', label: 'LoRA 3', type: 'text' as ComponentType, supportedTypes: ['string'], icon: '🧩' },
  { key: 'lora1_strength', label: 'LoRA 1 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
  { key: 'lora2_strength', label: 'LoRA 2 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
  { key: 'lora3_strength', label: 'LoRA 3 Strength', type: 'number' as ComponentType, supportedTypes: ['number'], icon: '⚖️' },
];

interface MappingListProps {
  components: UIComponent[];
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  className?: string;
}

export function MappingList({ components, onEdit, onDelete, className }: MappingListProps) {
  const getComponentTypeIcon = (component: UIComponent) => {
    if (component.properties.paramName) {
      const target = PLAYGROUND_TARGETS.find(t => t.key === component.properties.paramName);
      if (target) return target.icon;
    }
    return "💡";
  };

  if (components.length === 0) return null;

  return (
    <Card className={`bg-white/[0.02] border-white/5 backdrop-blur-3xl overflow-hidden ${className}`}>
      <CardHeader className="py-4 px-6 border-b border-white/5">
        <CardTitle className="text-sm font-medium flex items-center gap-3 text-white/80">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            <List className="w-4 h-4 text-white/60" />
          </div>
          Parameter Mappings
          <Badge variant="secondary" className="bg-white/5 text-white/40 border-0 font-mono ml-auto">
            {components.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 grid grid-cols-1 gap-3">
          <AnimatePresence mode="popLayout">
              {components.map((component, index) => (
                <motion.div
                  key={component.id || index}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/10 transition-all group relative"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="text-xl flex-shrink-0 w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                      {getComponentTypeIcon(component)}
                    </div>
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <div className="font-medium text-[13px] text-white/90 truncate">
                        {component.label}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase tracking-widest font-medium">
                        <span className="truncate max-w-[60px]">N{component.mapping.workflowPath[0]}</span>
                        <ArrowRight className="w-2 h-2 opacity-50" />
                        <span className="truncate">{component.mapping.parameterKey}</span>
                      </div>

                      {component.properties.paramName && (
                        <div className="flex items-center gap-1 mt-1">
                          <Target className="w-3 h-3 text-blue-400/60" />
                          <span className="text-[10px] text-blue-400/80 font-medium">
                            {PLAYGROUND_TARGETS.find(t => t.key === component.properties.paramName)?.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all -mr-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/10"
                      onClick={() => onEdit(index)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-white/20 hover:text-red-400 hover:bg-red-400/10"
                      onClick={() => onDelete(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
      </CardContent>
    </Card>
  );
}
