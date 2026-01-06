import React, { useRef, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, Link, Unlink, Sparkles, Plus, Minus } from "lucide-react";


import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GenerationConfig } from '@/components/features/playground-v2/types';
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";



interface ControlToolbarProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  config: GenerationConfig;
  onConfigChange: (newConfig: Partial<GenerationConfig>) => void;
  onWidthChange: (width: number) => void;
  onHeightChange: (height: number) => void;
  aspectRatioPresets: { name: string; width: number; height: number }[];
  currentAspectRatio: string;
  isAspectRatioLocked: boolean;
  onToggleAspectRatioLock: () => void;
  onGenerate: () => void;
  isGenerating: boolean;
  loadingText?: string;
  onOpenLoraSelector?: () => void;
  selectedWorkflowName?: string;
  selectedBaseModelName?: string;
  selectedLoraNames?: string[];
  workflows?: IViewComfy[];
  onWorkflowSelect?: (wf: IViewComfy) => void;
  onAspectRatioChange: (ar: string) => void;
  currentImageSize: '1K' | '2K' | '4K';
  onImageSizeChange: (size: '1K' | '2K' | '4K') => void;
  isMockMode?: boolean;
  onMockModeChange?: (val: boolean) => void;
  isSelectorExpanded?: boolean;
  onSelectorExpandedChange?: (expanded: boolean) => void;
  isPresetGridOpen?: boolean;
  onTogglePresetGrid?: () => void;
  batchSize?: number;
  onBatchSizeChange?: (size: number) => void;
}


export default function ControlToolbar({
  selectedModel,
  onModelChange,
  config,
  onConfigChange,
  onWidthChange,
  onHeightChange,
  aspectRatioPresets,
  currentAspectRatio,
  isAspectRatioLocked,
  onToggleAspectRatioLock,
  onGenerate,
  isGenerating,
  loadingText = "生成中...",
  onOpenLoraSelector,
  selectedWorkflowName,
  selectedBaseModelName,
  selectedLoraNames = [],
  workflows = [],
  onWorkflowSelect,
  onAspectRatioChange,
  currentImageSize,
  onImageSizeChange,
  isMockMode,
  onMockModeChange,
  isSelectorExpanded = false,
  onSelectorExpandedChange,
  isPresetGridOpen = false,
  onTogglePresetGrid,
  batchSize = 1,
  onBatchSizeChange,
}: ControlToolbarProps) {


  const [selectValue, setSelectValue] = useState<string | undefined>(undefined);
  const [activeTab] = useState<'model' | 'preset'>('model');


  // 初始化与回填：根据外部选中模型/工作流，映射到 Select 的 value
  React.useEffect(() => {
    let v: string | undefined;
    if (selectedModel === '3D Lemo seed3') v = 'seed3';
    else if (selectedModel === 'Seed 4.0') v = 'seed4';
    else if (selectedModel === 'Nano banana') v = 'nano_banana';
    else if (selectedModel === 'Workflow' && selectedWorkflowName) {
      const wf = (Array.isArray(workflows) ? workflows : []).find(
        (w) => w.viewComfyJSON.title === selectedWorkflowName
      );
      if (wf) v = `wf:${String(wf.viewComfyJSON.id)}`;
    }
    setSelectValue(v);
  }, [selectedModel, selectedWorkflowName, workflows]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isSelectorExpanded && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onSelectorExpandedChange?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSelectorExpanded, onSelectorExpandedChange]);

  const handleUnifiedSelectChange = (val: string) => {
    setSelectValue(val);
    if (val === 'seed3') {
      onModelChange('3D Lemo seed3');
      onConfigChange?.({ base_model: '3D Lemo seed3' });
    }
    else if (val === 'seed4') {
      onModelChange('Seed 4.0');
      onConfigChange?.({ base_model: 'Seed 4.0' });
    }
    else if (val === 'nano_banana') {
      onModelChange('Nano banana');
      onConfigChange?.({ base_model: 'Nano banana' });
    }
    else if (val.startsWith('wf:')) {
      const id = val.slice(3);
      const wf = (Array.isArray(workflows) ? workflows : []).find(
        (w) => String(w.viewComfyJSON.id) === id
      );
      if (wf) {
        onModelChange('Workflow');
        onConfigChange?.({ base_model: 'Workflow' });
        onWorkflowSelect?.(wf);
      }
    }
    onSelectorExpandedChange?.(false);
  };

  const Inputbutton2 = "h-10 w-auto text-white/70 font-normal rounded-2xl bg-black/30  hover:bg-black/50 hover:text-primary  hover:border-primary  transition-colors duration-200";
  const triggerLabel = (() => {
    if (selectValue === 'seed3') return 'Seed 3';
    if (selectValue === 'seed4') return 'Seed 4';
    if (selectValue === 'nano_banana') return 'Nano banana';
    if (selectedModel === 'Workflow') return selectedBaseModelName || 'Base Model';
    return 'Model';
  })();


  const BASE_MODEL_LIST = [
    { name: 'FLUX_fill', cover: '/basemodels/FLUX_fill.jpg' },
    { name: 'flux1-dev-fp8.safetensors', cover: '/basemodels/flux1-dev-fp8.safetensors.jpg' },
    { name: 'Zimage', cover: '/basemodels/Zimage.jpg' },
    { name: 'qwen', cover: '/basemodels/qwen.jpg' },
  ];

  const handleBaseModelSelect = (modelName: string) => {
    onModelChange('Workflow');
    onConfigChange?.({ base_model: modelName });
    onSelectorExpandedChange?.(false);
  };


  const ModelDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(Inputbutton2, isSelectorExpanded && activeTab === 'model' && "bg-white/10")}
        >
          {triggerLabel}
          <ChevronDown className={cn(" h-4 w-4 opacity-50 transition-transform duration-200", isSelectorExpanded && activeTab === 'model' && "rotate-180")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px] p-4 bg-black/90 border-white/10 backdrop-blur-xl rounded-3xl" align="start">
        <DropdownMenuItem
          className="text-white hover:bg-primary rounded-lg cursor-pointer flex items-center gap-2 py-2"
          onClick={() => handleUnifiedSelectChange('nano_banana')}
        >
          <span className={`w-2 h-2 rounded-full ${selectValue === 'nano_banana' ? 'bg-primary' : 'bg-transparent border border-white/30'}`} />
          Nano banana
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-white hover:bg-primary rounded-lg cursor-pointer flex items-center gap-2 py-2"
          onClick={() => handleUnifiedSelectChange('seed3')}
        >
          <span className={`w-2 h-2 rounded-full ${selectValue === 'seed3' ? 'bg-primary' : 'bg-transparent border border-white/30'}`} />
          Seed 3
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-white hover:bg-primary rounded-lg cursor-pointer flex items-center gap-2 py-2"
          onClick={() => handleUnifiedSelectChange('seed4')}
        >
          <span className={`w-2 h-2 rounded-full ${selectValue === 'seed4' ? 'bg-primary' : 'bg-transparent border border-white/30'}`} />
          Seed 4
        </DropdownMenuItem>

        {BASE_MODEL_LIST.map((model) => (
          <DropdownMenuItem
            key={model.name}
            className="text-white hover:bg-white/10 rounded-lg cursor-pointer flex items-center gap-2 py-2"
            onClick={() => handleBaseModelSelect(model.name)}
          >
            <span className={`w-2 h-2 rounded-full ${selectedModel === 'Workflow' && selectedBaseModelName === model.name ? 'bg-emerald-400' : 'bg-transparent border border-white/30'}`} />
            <span className="truncate">{model.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div ref={containerRef} className="w-full flex-col space-y-2">



      <div className="w-full h-12 flex justify-between items-center px-2 py-2 mt-1">
        <div className="flex justify-start items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              className={cn(Inputbutton2, isPresetGridOpen && "bg-white/10")}
              onClick={onTogglePresetGrid}
            >

              Presets
              <ChevronDown className={cn(" h-4 w-4 opacity-50 transition-transform duration-200", isPresetGridOpen && "rotate-180")} />
            </Button>
            <ModelDropdown />



            {selectedModel === 'Workflow' && (
              <Button variant="default" className={Inputbutton2} onClick={() => onOpenLoraSelector?.()}>
                {selectedLoraNames.length > 0 ? `LoRA (${selectedLoraNames.length})` : "LoRA"}
              </Button>
            )}
          </div>

          {/* 尺寸按钮 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="default" className={Inputbutton2}>
                {currentAspectRatio}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[320px] p-6 bg-black/90 border-white/10 backdrop-blur-xl rounded-3xl" align="start">
              <div className="space-y-4">
                {selectedModel === 'Nano banana' && (
                  <div className="space-y-4">
                    <div className="text-xs text-white/70">Resolution</div>
                    <div className="flex gap-2">
                      {(['1K', '2K', '4K'] as const).map(size => (
                        <Button
                          key={size}
                          variant={currentImageSize === size ? "default" : "outline"}
                          className={cn(
                            "flex-1 h-8 rounded-xl transition-all",
                            currentImageSize === size
                              ? "bg-primary border-none text-black"
                              : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                          )}
                          onClick={() => onImageSizeChange(size)}
                        >
                          {size}
                        </Button>
                      ))}
                    </div>
                    <DropdownMenuSeparator className="bg-white/10 mt-2" />
                  </div>
                )}

                <div className="space-y-4">
                  <div className="text-xs text-white/70">Aspect Ratio</div>
                  <div className="grid grid-cols-4 gap-2">
                    {aspectRatioPresets.map(preset => (
                      <Button
                        key={preset.name}
                        variant={currentAspectRatio === preset.name ? "default" : "outline"}
                        className={cn(
                          "h-8 rounded-xl transition-all",
                          currentAspectRatio === preset.name
                            ? "bg-primary border-none text-black"
                            : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                        )}
                        onClick={() => onAspectRatioChange(preset.name)}
                      >
                        {preset.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <DropdownMenuSeparator className="bg-white/10" />

                <div className="flex items-center gap-2">
                  <Label className="text-xs text-white/50">W</Label>
                  <Input
                    className="h-8 w-full text-sm text-white rounded-xl bg-white/5 border border-white/10 shadow-none focus-visible:ring-emerald-500/50"
                    placeholder="2048"
                    value={config.img_width}
                    onChange={(e) => onWidthChange(parseInt(e.target.value) || 1024)}
                  />
                  <Label className="text-xs text-white/50">H</Label>
                  <Input
                    className="h-8 w-full text-sm text-white rounded-xl bg-white/5 border border-white/10 shadow-none focus-visible:ring-emerald-500/50"
                    placeholder="2048"
                    value={config.img_height}
                    onChange={(e) => onHeightChange(parseInt(e.target.value) || 1024)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-white/60"
                    onClick={onToggleAspectRatioLock}
                  >
                    {isAspectRatioLocked ? <Link className="h-4 w-4" /> : <Unlink className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="default"
            size="sm"
            className={cn(Inputbutton2, isMockMode && "bg-amber-500/20 text-amber-500 border-amber-500/50")}
            onClick={() => onMockModeChange?.(!isMockMode)}
            title="Mock Mode"
          >
            <Sparkles className={cn("w-2 h-2", isMockMode && "animate-pulse")} />
            {isMockMode && <span className="ml-1 text-[10px] font-bold">MOCK</span>}
          </Button>
        </div>


        <div className="flex items-center justify-end gap-2">
          {/* Batch Size Selector */}
          <div className="flex items-center bg-black/30 rounded-2xl border border-white/5 h-10 px-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-white/60 hover:text-white"
              onClick={() => onBatchSizeChange?.(Math.max(1, batchSize - 1))}
              disabled={batchSize <= 1 || isGenerating}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <div className="w-8 text-center text-sm font-medium text-white select-none">
              {batchSize}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-white/60 hover:text-white"
              onClick={() => onBatchSizeChange?.(Math.min(10, batchSize + 1))}
              disabled={batchSize >= 10 || isGenerating}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          <div className="relative rounded-xl">
            <Button
              onClick={onGenerate}
              className="relative z-10 w-auto h-10 px-6 rounded-2xl text-sm font-medium text-[#000000] flex items-center bg-[#E6FFD1] justify-center gap-2 border-[2px] border-transparent transition-all duration-300 hover:animate-border-rotate"
              style={{
                // backgroundImage: `
                //   linear-gradient(83deg, rgba(58, 94, 251, 0) 8.11%, rgba(27, 32, 54, 0.5) 100%),
                //   linear-gradient(black, black),
                //  conic-gradient(from var(--angle), #223895 0deg, #93a7fe 17%, #3a5efb 35%, #3a5efb 51%, #93a7ff 68%, #223895 84%) 
                // `,
                backgroundClip: 'padding-box, padding-box, border-box',
                backgroundOrigin: 'border-box',
              }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4  animate-spin" />
                  {loadingText}
                </>
              ) : (
                <>

                  Generate {batchSize > 1 ? `(${batchSize})` : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      <AnimatePresence>

      </AnimatePresence>
    </div >
  );
}

