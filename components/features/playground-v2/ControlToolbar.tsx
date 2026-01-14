import React, { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ChevronDown, Link, Unlink, Sparkles, Plus, Minus } from "lucide-react";
import Image from "next/image";


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
import type { SelectedLora } from "@/components/features/playground-v2/Dialogs/LoraSelectorDialog";

// 统一的模型配置：消除重复映射
const MODEL_CONFIG: Record<string, { displayName: string; modelKey: string }> = {
  'seed3': { displayName: 'Seed 3', modelKey: '3D Lemo seed3' },
  'seed4': { displayName: 'Seed 4.0', modelKey: 'Seed 4.0' },
  'seed4_2': { displayName: 'Seed 4.2', modelKey: 'Seed 4.2' },
  'lemoseedt2i': { displayName: 'Seed 4', modelKey: 'Seed 4' },
  'nano_banana': { displayName: 'Nano banana', modelKey: 'Nano banana' },
  'coze_seed4': { displayName: 'Coze Seed 4', modelKey: 'coze_seed4' },
};



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
  selectedLoras?: SelectedLora[];
  selectedLoraNames?: string[];
  selectedPresetName?: string;
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
  onClearPreset?: () => void;
  variant?: 'default' | 'mini';
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
  selectedLoras = [],
  selectedPresetName,
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
  onClearPreset,
  variant = 'default',
}: ControlToolbarProps) {


  const [selectValue, setSelectValue] = useState<string | undefined>(undefined);
  const [activeTab] = useState<'model' | 'preset'>('model');

  // 初始化与回填：根据外部 selectedModel 映射到内部 selectValue
  React.useEffect(() => {
    // 反向查找：根据 modelKey 找到对应的 selectValue
    const entry = Object.entries(MODEL_CONFIG).find(([, cfg]) => cfg.modelKey === selectedModel);
    if (entry) {
      setSelectValue(entry[0]);
    } else if (selectedModel === 'Workflow' && selectedWorkflowName) {
      const wf = (Array.isArray(workflows) ? workflows : []).find(
        (w) => w.viewComfyJSON.title === selectedWorkflowName
      );
      if (wf) setSelectValue(`wf:${String(wf.viewComfyJSON.id)}`);
    } else {
      setSelectValue(undefined);
    }
  }, [selectedModel, selectedWorkflowName, workflows]);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleUnifiedSelectChange = (val: string) => {
    setSelectValue(val);
    onClearPreset?.(); // 切换模型时清除预设选择

    // 使用统一配置处理模型切换
    const cfg = MODEL_CONFIG[val];
    if (cfg) {
      onModelChange(cfg.modelKey);
      onConfigChange?.({ model: cfg.modelKey });

      // Coze Seed 4 默认设置 2K
      if (val === 'coze_seed4') {
        onImageSizeChange('2K');
      }
    } else if (val.startsWith('wf:')) {
      const id = val.slice(3);
      const wf = (Array.isArray(workflows) ? workflows : []).find(
        (w) => String(w.viewComfyJSON.id) === id
      );
      if (wf) {
        onModelChange('Workflow');
        onConfigChange?.({ model: 'Workflow' });
        onWorkflowSelect?.(wf);
      }
    }
  };

  const Inputbutton2 = "h-8 px-3 text-white rounded-xl bg-white/5 border border-white/10  hover:bg-white/5 hover:border-white/10 hover:border hover:text-primary    transition-colors duration-200";

  // 使用统一配置获取显示标签
  const triggerLabel = (() => {
    if (selectValue && MODEL_CONFIG[selectValue]) {
      return MODEL_CONFIG[selectValue].displayName;
    }
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
    onConfigChange?.({ model: modelName });
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
      <DropdownMenuContent className="w-[240px]  bg-black/60 border-white/10 backdrop-blur-xl rounded-2xl" align="start">
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
        <DropdownMenuItem
          className="text-white hover:bg-primary rounded-lg cursor-pointer flex items-center gap-2 py-2"
          onClick={() => handleUnifiedSelectChange('seed4_2')}
        >
          <span className={`w-2 h-2 rounded-full ${selectValue === 'seed4_2' ? 'bg-primary' : 'bg-transparent border border-white/30'}`} />
          Seed 4.2
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-white hover:bg-primary rounded-lg cursor-pointer flex items-center gap-2 py-2"
          onClick={() => handleUnifiedSelectChange('lemoseedt2i')}
        >
          <span className={`w-2 h-2 rounded-full ${selectValue === 'lemoseedt2i' ? 'bg-primary' : 'bg-transparent border border-white/30'}`} />
          Seed 4 (LemoSeed T2I)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-white hover:bg-primary rounded-lg cursor-pointer flex items-center gap-2 py-2"
          onClick={() => handleUnifiedSelectChange('coze_seed4')}
        >
          <span className={`w-2 h-2 rounded-full ${selectValue === 'coze_seed4' ? 'bg-primary' : 'bg-transparent border border-white/30'}`} />
          Coze Seed 4
        </DropdownMenuItem>


        {/* workflow模型 */}
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
          <div className="flex items-center gap-2">
            {variant !== 'mini' && (
              <Button
                className={cn(Inputbutton2, isPresetGridOpen && "bg-white/10")}
                onClick={onTogglePresetGrid}
              >

                {selectedPresetName ? selectedPresetName : 'Presets'}
                <ChevronDown className={cn(" h-4 w-4 opacity-50 transition-transform duration-200", isPresetGridOpen && "rotate-180")} />
              </Button>
            )}
            <ModelDropdown />



            {selectedModel === 'Workflow' && (
              <div className="flex items-center gap-2">
                <Button variant="default" className={Inputbutton2} onClick={() => onOpenLoraSelector?.()}>
                  LoRA
                  {selectedLoras && selectedLoras.length > 0 && (
                    <div className="flex items-center gap-2">
                      {selectedLoras.slice(0, 5).map((lora) => (
                        <div key={lora.model_name} className="relative w-6 h-6 rounded-md overflow-hidden border border-white/20" title={lora.model_name}>
                          {lora.preview_url ? (
                            <Image
                              src={lora.preview_url}
                              alt={lora.model_name}
                              fill
                              sizes="24px"
                              className="object-cover"
                              quality={20}
                            />
                          ) : (
                            <div className="w-full h-full bg-white/10" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Button>

              </div>
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
            <DropdownMenuContent className="w-[320px] p-4 bg-black/60 border-white/10 backdrop-blur-xl rounded-2xl" align="start">
              <div className="space-y-4">
                {(selectedModel === 'Nano banana' || selectedModel === 'Seed 4.2' || selectedModel === 'coze_seed4') && (
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
                    value={config.width}
                    onChange={(e) => onWidthChange(parseInt(e.target.value) || 1024)}
                  />
                  <Label className="text-xs text-white/50">H</Label>
                  <Input
                    className="h-8 w-full text-sm text-white rounded-xl bg-white/5 border border-white/10 shadow-none focus-visible:ring-emerald-500/50"
                    placeholder="2048"
                    value={config.height}
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
              className="relative z-10 w-auto h-10 px-6 rounded-2xl text-sm font-medium text-[#000000] flex items-center bg-[#E6FFD1] justify-center   transition-all duration-300 hover:animate-border-rotate"
            // style={{
            //   backgroundImage: `
            //     linear-gradient(83deg, rgba(58, 94, 251, 0) 8.11%, rgba(27, 32, 54, 0.5) 100%),
            //     linear-gradient(primary, black),
            //    conic-gradient(from var(--angle), #229563ff 0deg, #b0eed6ff 17%, #89d8acff 35%, #569466ff 51%, #87d690ff 68%, #a7d8b4ff 84%) 
            //   `,
            //   backgroundClip: 'padding-box, padding-box, border-box',
            //   backgroundOrigin: 'border-box',
            // }}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4    animate-spin" />
                  {loadingText}
                </>
              ) : (
                <>

                  Generate
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
