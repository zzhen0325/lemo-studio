import React, { useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AnimatedButton } from "@/components/ui/animated-gradient-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Link, Unlink, Plus, Minus, X } from "lucide-react";
import Image from "next/image";


import { cn } from "@/lib/utils";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { GenerationConfig, ImageSize } from "@/types/database";
import type { UploadedImage } from "@/lib/playground/types";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { SelectedLora } from "@/lib/playground/types";
import { usePlaygroundAvailableModels } from "@studio/playground/_components/hooks/useGenerationService";
import { MODEL_ID_FLUX_KLEIN, MODEL_ID_WORKFLOW } from "@/lib/constants/models";
import { isWorkflowModel } from "@/lib/utils/model-utils";
import { useAPIConfigStore } from "@/lib/store/api-config-store";



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
  selectedBaseModelName?: string;
  selectedLoras?: SelectedLora[];
  selectedLoraNames?: string[];
  selectedPresetName?: string;
  workflows?: IViewComfy[];
  onWorkflowSelect?: (wf: IViewComfy) => void;
  onAspectRatioChange: (ar: string) => void;
  currentImageSize: ImageSize;
  onImageSizeChange: (size: ImageSize) => void;
  isSelectorExpanded?: boolean;
  onSelectorExpandedChange?: (expanded: boolean) => void;
  isPresetGridOpen?: boolean;
  onTogglePresetGrid?: () => void;
  batchSize?: number;
  onBatchSizeChange?: (size: number) => void;
  onClearPreset?: () => void;
  variant?: 'default' | 'edit';
  customAspectRatioLabel?: string;
  uploadedImages?: UploadedImage[];
  disableModelSelection?: boolean;
  selectedWorkflowName?: string;
  activeShortcutName?: string;
  onClearShortcutTemplate?: () => void;
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
  loadingText = "Thinking...",
  onOpenLoraSelector,
  selectedBaseModelName,
  selectedLoras = [],
  selectedPresetName,
  workflows = [],
  onWorkflowSelect,
  onAspectRatioChange,
  currentImageSize,
  onImageSizeChange,

  isSelectorExpanded = false,
  isPresetGridOpen = false,
  onTogglePresetGrid,
  batchSize = 4,
  onBatchSizeChange,
  onClearPreset,
  variant = 'default',
  customAspectRatioLabel,
  uploadedImages = [],
  disableModelSelection = false,
  activeShortcutName,
  onClearShortcutTemplate,
}: ControlToolbarProps) {


  const [selectValue, setSelectValue] = useState<string | undefined>(undefined);
  const [activeTab] = useState<'model' | 'preset'>('model');
  const availableModels = usePlaygroundAvailableModels();
  const getModelEntryById = useAPIConfigStore(state => state.getModelEntryById);
  const isEditMode = Boolean(config.isEdit) || variant === 'edit';
  const selectableModels = React.useMemo(() => {
    // If not in edit mode, or if there are no images uploaded, show all models.
    // This prevents models being hidden when isEdit is accidentally true but no images are present.
    if (!isEditMode || uploadedImages.length === 0) return availableModels;
    return availableModels.filter((model) => {
      const meta = getModelEntryById(model.id);
      const supportsImageEdit = meta?.capabilities?.supportsImageEdit
        ?? (meta?.capabilities?.supportsMultiImage ?? true);
      return supportsImageEdit;
    });
  }, [availableModels, getModelEntryById, isEditMode, uploadedImages.length]);
  const selectedModelMeta = getModelEntryById(selectedModel);
  const selectedSupportsImageSize = selectedModelMeta?.capabilities?.supportsImageSize
    ?? ['gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image', 'seed4_v2_0226lemo', 'coze_seedream4_5'].includes(selectedModel);
  const selectedAllowedImageSizes = selectedModelMeta?.capabilities?.allowedImageSizes?.length
    ? selectedModelMeta.capabilities.allowedImageSizes
    : (['1K', '2K', '4K'] as const);
  const selectedSupportsBatch = selectedModelMeta?.capabilities?.supportsBatch ?? true;
  const selectedMaxBatchSize = selectedSupportsBatch ? Math.max(1, selectedModelMeta?.capabilities?.maxBatchSize ?? 10) : 1;
  const allowsContinuousGenerate = selectedModel === 'coze_seedream4_5';
  const shouldLockGenerateControls = isGenerating && !allowsContinuousGenerate;
  const generateButtonLabel = isGenerating
    ? (allowsContinuousGenerate ? 'Generate Again' : loadingText)
    : 'Generate';

  // 初始化与回填：根据外部 selectedModel 映射到内部 selectValue
  React.useEffect(() => {
    // 简化映射：直接匹配 id 或 Workflow
    const entry = selectableModels.find((cfg) => cfg.id === selectedModel);
    if (entry) {
      setSelectValue(entry.id);
    } else if (isWorkflowModel(selectedModel) && selectedPresetName) {
      // 通过 presetName 寻找对应的 workflow
      const wf = (Array.isArray(workflows) ? workflows : []).find(
        (w) => w.viewComfyJSON.title === selectedPresetName
      );
      if (wf) setSelectValue(`wf:${String(wf.viewComfyJSON.id)}`);
    } else {
      setSelectValue(undefined);
    }
  }, [selectedModel, selectedPresetName, workflows, selectableModels]);

  React.useEffect(() => {
    if (!isEditMode || selectableModels.length === 0) return;
    if (selectableModels.some((item) => item.id === selectedModel)) return;
    const fallback = selectableModels[0].id;
    setSelectValue(fallback);
    onModelChange(fallback);
    onConfigChange?.({ model: fallback });
  }, [isEditMode, onConfigChange, onModelChange, selectableModels, selectedModel]);

  React.useEffect(() => {
    if (!onBatchSizeChange) return;
    if (!selectedSupportsBatch && batchSize !== 1) {
      onBatchSizeChange(1);
      return;
    }
    if (selectedSupportsBatch && batchSize > selectedMaxBatchSize) {
      onBatchSizeChange(selectedMaxBatchSize);
    }
  }, [batchSize, onBatchSizeChange, selectedMaxBatchSize, selectedSupportsBatch]);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleUnifiedSelectChange = (val: string) => {
    setSelectValue(val);
    onClearPreset?.(); // 切换模型时清除预设选择

    // 使用统一配置处理模型切换gemini-2.5-flash-image
    const cfg = selectableModels.find(m => m.id === val);
    if (cfg) {
      onModelChange(cfg.id);

      const modelMeta = getModelEntryById(val);
      const supportsImageEdit = modelMeta?.capabilities?.supportsImageEdit ?? true;

      // If switching to a model that doesn't support edit, auto-exit edit mode
      if (config.isEdit && !supportsImageEdit) {
        onConfigChange?.({ model: cfg.id, isEdit: false });
      } else {
        onConfigChange?.({ model: cfg.id });
      }

      const supportsImageSize = modelMeta?.capabilities?.supportsImageSize
        ?? ['coze_seedream4_5', 'seed4_v2_0226lemo', 'gemini-3-pro-image-preview', 'gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'].includes(val);

      if (supportsImageSize) {
        const allowed = modelMeta?.capabilities?.allowedImageSizes?.length
          ? modelMeta.capabilities.allowedImageSizes
          : ['1K', '2K', '4K'];
        const defaultSize = allowed.includes('2K') ? '2K' : (allowed[0] as ImageSize);
        onImageSizeChange(defaultSize as ImageSize);
      }
    } else if (val.startsWith('wf:')) {
      const id = val.slice(3);
      const wf = (Array.isArray(workflows) ? workflows : []).find(
        (w) => String(w.viewComfyJSON.id) === id
      );
      if (wf) {
        onModelChange(MODEL_ID_WORKFLOW);
        onConfigChange?.({ model: MODEL_ID_WORKFLOW });
        onWorkflowSelect?.(wf);
      }
    }
  };

  const Inputbutton2 = "h-8 px-3 text-white rounded-xl bg-white/5 border border-white/10  hover:bg-white/5 hover:border-white/10 hover:border hover:text-primary    transition-colors duration-200";

  // 使用统一配置获取显示标签
  const modelTriggerLabel = (() => {
    const activeModel = selectableModels.find(m => m.id === selectValue);
    return activeModel ? activeModel.displayName : 'Model';
  })();


  const BASE_MODEL_LIST = [
    { name: 'FLUX_fill', cover: '/basemodels/FLUX_fill.jpg' },
    { name: 'flux1-dev-fp8.safetensors', cover: '/basemodels/flux1-dev-fp8.safetensors.jpg' },
    { name: 'Zimage', cover: '/basemodels/Zimage.jpg' },
    { name: 'qwen', cover: '/basemodels/qwen.jpg' },
  ];

  const handleBaseModelSelect = (modelName: string) => {
    onConfigChange?.({ model: modelName });
  };

  const BaseModelDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(Inputbutton2)}
        >
          {selectedBaseModelName || 'Base Model'}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[180px] bg-black/60 border-white/10 backdrop-blur-xl rounded-2xl" align="start">
        {BASE_MODEL_LIST.map((model) => (
          <DropdownMenuItem
            key={model.name}
            className="text-white hover:bg-white/10 rounded-lg cursor-pointer flex items-center gap-2 py-2"
            onClick={() => handleBaseModelSelect(model.name)}
          >
            <span className={`w-2 h-2 rounded-full ${selectedBaseModelName === model.name ? 'bg-emerald-400' : 'bg-transparent border border-white/30'}`} />
            <span className="truncate">{model.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  // 模型信息映射：包含 logo 和描述
  const MODEL_INFO: Record<string, { logo: string; description: string }> = {
    'gemini-3-pro-image-preview': {
      logo: '/images/logos/google.png',
      description: 'Google 最强图像生成模型 pro版 谷歌老挂'
    },
    'gemini-3.1-flash-image-preview': {
      logo: '/images/logos/google.png',
      description: 'Google 图像生成模型 Nano banana 2'
    },
    'gemini-2.5-flash-image': {
      logo: '/images/logos/google.png',
      description: '普通版，pro版备胎'
    },
    'coze_seedream4_5': {
      logo: '/images/logos/seed.png',
      description: '扣子工作流版 Seedream 4.5'
    },
    'seed4_v2_0226lemo': {
      logo: '/images/logos/seed.png',
      description: 'Seed 4.2 高质量生成模型'
    },
    [MODEL_ID_FLUX_KLEIN]: {
      logo: '/images/logos/flux.png',
      description: 'ComfyUI Flux.2 Klein'
    }
  };

  const ModelDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={cn(Inputbutton2, isSelectorExpanded && activeTab === 'model' && "bg-white/10")}
        >
          {modelTriggerLabel}
          <ChevronDown className={cn(" h-4 w-4 opacity-50 transition-transform duration-200", isSelectorExpanded && activeTab === 'model' && "rotate-180")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] bg-black/60 border-white/10 backdrop-blur-xl rounded-2xl p-1" align="start">
        {selectableModels.map((model) => {
          const info = MODEL_INFO[model.id] || { logo: '/models/default.svg', description: '' };
          return (
            <DropdownMenuItem
              key={model.id}
              className="text-white hover:bg-primary/20 rounded-lg cursor-pointer flex items-center gap-3 py-3 px-3"
              onClick={() => handleUnifiedSelectChange(model.id)}
            >
              {/* 选中指示器 */}
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${selectValue === model.id ? 'bg-primary' : 'bg-transparent border border-white/30'}`} />
              {/* 模型 Logo */}
              <div className="relative w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                <Image
                  src={info.logo}
                  alt={model.displayName}
                  fill
                  sizes="32px"
                  className="object-cover"
                  onError={(e) => {
                    // 如果图片加载失败，使用首字母作为占位
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement!.innerHTML = `<span class="text-white/60 text-sm font-medium">${model.displayName.charAt(0)}</span>`;
                  }}
                />
              </div>
              {/* 模型名称和描述 */}
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-medium text-white truncate">{model.displayName}</span>
                <span className="text-xs text-white/50 truncate">{info.description}</span>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const hasBaseModelMapping = React.useMemo(() => {
    if (!selectedPresetName || !workflows) return true;
    const currentWorkflow = workflows.find(w => w.viewComfyJSON.title === selectedPresetName);
    if (!currentWorkflow?.viewComfyJSON.mappingConfig?.components) return false;
    const components = currentWorkflow.viewComfyJSON.mappingConfig.components as Array<{ id?: string }>;
    return components.some(
      c => c.id === 'base_model'
    );
  }, [selectedPresetName, workflows]);

  const hasLoraMapping = React.useMemo(() => {
    if (!selectedPresetName || !workflows) return true;
    const currentWorkflow = workflows.find(w => w.viewComfyJSON.title === selectedPresetName);
    if (!currentWorkflow?.viewComfyJSON.mappingConfig?.components) return false;
    const components = currentWorkflow.viewComfyJSON.mappingConfig.components as Array<{ id?: string }>;
    return components.some(
      c => typeof c.id === 'string' && c.id.startsWith('lora')
    );
  }, [selectedPresetName, workflows]);

  return (
    <div ref={containerRef} className="w-full flex-col space-y-2">



      <div className="w-full h-12 flex justify-between items-center px-2 py-2 mt-1">
        <div className="flex justify-start items-center gap-2">
          <div className="flex items-center gap-2">
            {activeShortcutName ? (
              <div className="flex items-center rounded-xl border border-white/30 bg-white/15 px-3 h-8">
                <span className="text-[12px] font-medium pr-1 text-[#F4FFCE]">
                  {activeShortcutName}
                </span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-[#F4FFCE]/70 transition-colors hover:bg-[#E8FFB7]/12 hover:text-[#F4FFCE]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearShortcutTemplate?.();
                  }}
                  aria-label="清空快捷模板"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {variant !== 'edit' && (
              <Button
                className={cn(
                  "hidden",
                  Inputbutton2,
                  isPresetGridOpen && "bg-white/10",
                  selectedPresetName && "bg-primary/20 text-primary border-primary/20"
                )}
                onClick={onTogglePresetGrid}
              >

                {selectedPresetName ? selectedPresetName : 'Presets'}
                {selectedPresetName ? (
                  <div
                    className=" p-0.5 rounded-full hover:bg-primary/20 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearPreset?.();
                    }}
                  >
                    <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
                  </div>
                ) : (
                  <ChevronDown className={cn(" h-4 w-4 opacity-50 transition-transform duration-200", isPresetGridOpen && "rotate-180")} />
                )}
              </Button>
            )}
            {!disableModelSelection && (
              <>
                {(!isWorkflowModel(selectedModel) || !selectedPresetName) && <ModelDropdown />}
                {isWorkflowModel(selectedModel) && selectedPresetName && hasBaseModelMapping && <BaseModelDropdown />}
              </>
            )}
            {isWorkflowModel(selectedModel) && selectedPresetName && hasLoraMapping && (
              <div className="flex items-center gap-2">
                <Button variant="default" className={Inputbutton2} onClick={() => onOpenLoraSelector?.()}>
                  LoRA
                  {selectedLoras && selectedLoras.length > 0 && (
                    <div className="flex items-center gap-2">
                      {selectedLoras.slice(0, 5).map((lora) => (
                        <div key={lora.model_name} className="relative w-6 h-6 rounded-md overflow-hidden border border-white/20" title={lora.model_name}>
                          {lora.preview_url ? (
                            <Image
                              src={encodeURI(lora.preview_url)}
                              alt={lora.model_name}
                              fill
                              sizes="24px"
                              className="object-cover"
                              quality={20}
                              unoptimized
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
                {customAspectRatioLabel ?? currentAspectRatio}
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[320px] p-4 bg-black/60 border-white/10 backdrop-blur-xl rounded-2xl" align="start">
              <div className="space-y-4">
                {selectedSupportsImageSize && (
                  <div className="space-y-4">
                    <div className="text-xs text-white/70">Image Size</div>
                    <div className="flex gap-2">
                      {selectedAllowedImageSizes.map(size => (
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
                    <Button
                      variant={currentAspectRatio === 'auto' ? "default" : "outline"}
                      disabled={uploadedImages.length === 0 && variant !== 'edit'}
                      className={cn(
                        "h-8 rounded-xl transition-all",
                        currentAspectRatio === 'auto'
                          ? "bg-primary border-none text-black"
                          : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10",
                        uploadedImages.length === 0 && variant !== 'edit' && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => onAspectRatioChange('auto')}
                    >
                      Auto
                    </Button>
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

        </div>


        <div className="flex items-center justify-end gap-2">
          {/* Batch Size Selector */}
          {selectedSupportsBatch && (
            <div className="flex items-center bg-black/30 rounded-2xl border border-white/5 h-10 px-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-white/60 hover:text-white"
                onClick={() => onBatchSizeChange?.(Math.max(1, batchSize - 1))}
                disabled={batchSize <= 1 || shouldLockGenerateControls}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <div className="w-8 text-center text-sm font-medium text-white select-none">
                {Math.min(batchSize, selectedMaxBatchSize)}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-white/60 hover:text-white"
                onClick={() => onBatchSizeChange?.(Math.min(selectedMaxBatchSize, batchSize + 1))}
                disabled={batchSize >= selectedMaxBatchSize || shouldLockGenerateControls}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          )}

          <div className="relative rounded-xl">
            <AnimatedButton
              onClick={onGenerate}
              disabled={shouldLockGenerateControls}
              loading={isGenerating}
              disableWhileLoading={!allowsContinuousGenerate}
              label={generateButtonLabel}
              size="md"
              variant="default"
              className="relative z-10 rounded-2xl px-6 font-semibold text-black"
            />
          </div>
        </div>
      </div>
      <AnimatePresence>

      </AnimatePresence>
    </div >
  );
}
