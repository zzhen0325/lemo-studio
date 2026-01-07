"use client";


import { useState, useEffect, useRef, RefObject } from "react";
import { useToast } from "@/hooks/common/use-toast";
import { Button } from "@/components/ui/button";

import { usePromptOptimization, AIModel } from "@/hooks/features/PlaygroundV2/usePromptOptimization";


import { useGenerationService } from "@/hooks/features/PlaygroundV2/useGenerationService";
import { useAIService } from "@/hooks/ai/useAIService";
import { GoogleApiStatus } from "@/components/features/playground-v2/GoogleApiStatus";
import PromptInput from "@/components/features/playground-v2/PromptInput";
import ControlToolbar from "@/components/features/playground-v2/ControlToolbar";
import HistoryList from "@/components/features/playground-v2/HistoryList";
import GalleryView from "@/components/features/playground-v2/GalleryView";
import ImagePreviewModal from "@/components/features/playground-v2/Dialogs/ImagePreviewModal";
import ImageEditorModal from "@/components/features/playground-v2/Dialogs/ImageEditorModal";
import WorkflowSelectorDialog from "@/components/features/playground-v2/Dialogs/WorkflowSelectorDialog";
import BaseModelSelectorDialog from "@/components/features/playground-v2/Dialogs/BaseModelSelectorDialog";
import LoraSelectorDialog, { SelectedLora } from "@/components/features/playground-v2/Dialogs/LoraSelectorDialog";
import { PresetManagerDialog } from "@/components/features/playground-v2/Dialogs/PresetManagerDialog";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import type { UIComponent } from "@/types/features/mapping-editor";
import type { GenerationConfig, UploadedImage, PresetExtended } from "@/components/features/playground-v2/types";
import { Resolution } from "@/types/database";
import { BASE_SYSTEM_INSTRUCTION, VISION_DESCRIBE_SYSTEM_PROMPT } from "@/components/features/playground-v2/types";
import type { Generation } from "@/types/database";

import { cn } from "@/lib/utils";
import Image from "next/image";
import { X, Plus, Sparkles, History, PanelRightOpen, PanelLeftOpen, LayoutGrid, List, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { StylesMarquee } from "@/components/features/playground-v2/StylesMarquee";
import { PresetGridOverlay } from "@/components/features/playground-v2/PresetGridOverlay";
import { DescribePanel } from "@/components/features/playground-v2/DescribePanel";
import { PlaygroundBackground } from "@/components/features/playground-v2/PlaygroundBackground";
import SplitText from "@/components/ui/split-text";

import gsap from "gsap";
import { Flip } from "gsap/all";
import { useGSAP } from "@gsap/react";
import { observer } from "mobx-react-lite";
import { projectStore } from "@/lib/store/project-store";
import { ProjectSidebar } from "@/components/features/playground-v2/ProjectSection/project-sidebar/ProjectSidebar";
import { AllProjectsView } from "@/components/features/playground-v2/ProjectSection/project-sidebar/AllProjectsView";

gsap.registerPlugin(Flip, useGSAP);

export interface PlaygroundV2PageProps {
  onEditMapping?: (workflow: IViewComfy) => void;
  onGenerate?: () => void;
  onHistoryChange?: (history: Generation[]) => void;
  backgroundRefs?: {
    cloud: RefObject<HTMLDivElement | null>;
    tree: RefObject<HTMLDivElement | null>;
    dog: RefObject<HTMLDivElement | null>;
    man: RefObject<HTMLDivElement | null>;
    front: RefObject<HTMLDivElement | null>;
    bg: RefObject<HTMLDivElement | null>;
  };
}

export const PlaygroundV2Page = observer(function PlaygroundV2Page({
  onEditMapping,
}: PlaygroundV2PageProps) {

  const { toast } = useToast();
  const config = usePlaygroundStore(s => s.config);
  const updateConfig = usePlaygroundStore(s => s.updateConfig);
  const containerRef = useRef<HTMLDivElement>(null);
  const uploadedImages = usePlaygroundStore(s => s.uploadedImages);
  const setUploadedImages = usePlaygroundStore(s => s.setUploadedImages);
  const describeImages = usePlaygroundStore(s => s.describeImages);
  const setDescribeImages = usePlaygroundStore(s => s.setDescribeImages);
  const selectedModel = usePlaygroundStore(s => s.selectedModel);
  const setSelectedModel = usePlaygroundStore(s => s.setSelectedModel);
  const selectedWorkflowConfig = usePlaygroundStore(s => s.selectedWorkflowConfig);
  const setSelectedWorkflowConfig = usePlaygroundStore(s => s.setSelectedWorkflowConfig);
  const selectedLoras = usePlaygroundStore(s => s.selectedLoras);
  const setSelectedLoras = usePlaygroundStore(s => s.setSelectedLoras);
  const initPresets = usePlaygroundStore(s => s.initPresets);
  const generationHistory = usePlaygroundStore(s => s.generationHistory);
  const setGenerationHistory = usePlaygroundStore(s => s.setGenerationHistory);
  const fetchHistory = usePlaygroundStore(s => s.fetchHistory);
  const applyModel = usePlaygroundStore(s => s.applyModel);

  const setConfig = (val: GenerationConfig | ((prev: GenerationConfig) => GenerationConfig)) => {
    const currentConfig = usePlaygroundStore.getState().config;
    if (typeof val === 'function') {
      updateConfig(val(currentConfig));
    } else {
      updateConfig(val);
    }
  };

  // const hasGenerated = usePlaygroundStore(s => s.hasGenerated);
  const setHasGenerated = usePlaygroundStore(s => s.setHasGenerated);
  // const remix = usePlaygroundStore(s => s.remix);
  const isAspectRatioLocked = usePlaygroundStore(s => s.isAspectRatioLocked);
  const setIsAspectRatioLocked = usePlaygroundStore(s => s.setAspectRatioLocked);
  const isMockMode = usePlaygroundStore(s => s.isMockMode);
  const setMockMode = usePlaygroundStore(s => s.setMockMode);
  const isSelectorExpanded = usePlaygroundStore(s => s.isSelectorExpanded);
  const setIsSelectorExpanded = usePlaygroundStore(s => s.setSelectorExpanded);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const describePanelRef = useRef<HTMLDivElement>(null);

  const [showAllProjects, setShowAllProjects] = useState(false);

  const mobxProjectId = projectStore.currentProjectId;

  useEffect(() => {
    const project = projectStore.currentProject;
    if (project) {
      usePlaygroundStore.getState().setGenerationHistory([...project.history]);
    }
  }, [mobxProjectId]);

  useEffect(() => {
    if (mobxProjectId) {
      projectStore.setProjectHistory(mobxProjectId, generationHistory);
    }
  }, [generationHistory, mobxProjectId]);

  const [selectedAIModel, setSelectedAIModel] = useState<AIModel>('gemini');
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isBaseModelDialogOpen, setIsBaseModelDialogOpen] = useState(false);
  const [isLoraDialogOpen, setIsLoraDialogOpen] = useState(false);
  const [workflows, setWorkflows] = useState<IViewComfy[]>([]);
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [isPresetGridOpen, setIsPresetGridOpen] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  const [isDescribeMode, setIsDescribeMode] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverPanel, setIsDraggingOverPanel] = useState(false);
  const [activeGalleryTab, setActiveGalleryTab] = useState<'gallery' | 'styles'>('gallery');
  const showHistory = usePlaygroundStore(s => s.showHistory);
  const setShowHistory = usePlaygroundStore(s => s.setShowHistory);
  const showGallery = usePlaygroundStore(s => s.showGallery);
  const setShowGallery = usePlaygroundStore(s => s.setShowGallery);
  const [historyLayoutMode, setHistoryLayoutMode] = useState<'grid' | 'list'>('list');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [batchSize, setBatchSize] = useState(4); // Default batch size
  const showProjectSidebar = usePlaygroundStore(s => s.showProjectSidebar);
  const setShowProjectSidebar = usePlaygroundStore(s => s.setShowProjectSidebar);

  useEffect(() => {
    projectStore.toggleSidebar(showProjectSidebar);
  }, [showProjectSidebar]);

  // Sync workflow config when workflowName changes (e.g., during backfilling/remix)
  useEffect(() => {
    if (selectedModel === 'Workflow' && config.workflowName && !selectedWorkflowConfig) {
      const wf = workflows.find(w => w.viewComfyJSON.title === config.workflowName);
      if (wf) {
        setSelectedWorkflowConfig(wf);
      }
    }
  }, [config.workflowName, selectedModel, workflows, selectedWorkflowConfig, setSelectedWorkflowConfig]);

  // Handle click outside to close Describe panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isDescribeMode &&
        describePanelRef.current &&
        !describePanelRef.current.contains(event.target as Node)
      ) {
        setIsDescribeMode(false);
      }
    };

    if (isDescribeMode) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDescribeMode]);

  const promptWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    initPresets();
  }, [initPresets]);

  // Helper: save history using unified fields
  const saveHistoryToBackend = async (item: import('@/types/database').Generation) => {
    try {
      const gen = {
        id: item.id,
        userId: item.userId || 'anonymous',
        projectId: item.projectId || 'default',
        outputUrl: item.outputUrl || '',
        config: item.config,
        status: item.status || 'completed',
        sourceImageUrl: item.sourceImageUrl,
        createdAt: item.createdAt || new Date().toISOString(),
      };
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gen),
      });
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  };

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const res = await fetch('/api/view-comfy');
        if (res.ok) {
          const data = await res.json();
          setWorkflows(data.viewComfys || []);
        }
      } catch (error) {
        console.error("Failed to fetch workflows", error);
      }
    };
    fetchWorkflows();
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    const path = uploadedImages[0]?.path;
    updateConfig({ sourceImageUrl: path });
  }, [uploadedImages, updateConfig]);


  const applyWorkflowDefaults = (workflow: IViewComfy) => {
    const mappingConfig = workflow.viewComfyJSON.mappingConfig as { components: UIComponent[] } | undefined;
    const newConfig = { ...config };
    const newLoras: SelectedLora[] = [];

    if (mappingConfig?.components && Array.isArray(mappingConfig.components) && mappingConfig.components.length > 0) {
      const components = mappingConfig.components;
      const workflowApiJSON = workflow.workflowApiJSON as WorkflowApiJSON | undefined;
      components.forEach((comp: UIComponent) => {
        const paramName = comp.properties?.paramName;
        const defaultValue = comp.properties?.defaultValue;
        const workflowPath = comp.mapping?.workflowPath;
        if (!paramName) return;
        const getActualValue = () => {
          if (workflowApiJSON && Array.isArray(workflowPath) && workflowPath.length >= 3) {
            const [nodeId, section, key] = workflowPath;
            if (section === "inputs") {
              return workflowApiJSON[nodeId]?.inputs?.[key];
            }
          }
          return undefined;
        };
        const actualValue = getActualValue();
        if (paramName === 'prompt') {
          if (actualValue && typeof actualValue === 'string') newConfig.prompt = actualValue;
          else if (defaultValue) newConfig.prompt = defaultValue;
        } else if (paramName === 'width') {
          if (actualValue && (typeof actualValue === 'number' || typeof actualValue === 'string')) newConfig.width = Number(actualValue);
          else if (defaultValue) newConfig.width = Number(defaultValue);
        } else if (paramName === 'height') {
          if (actualValue && (typeof actualValue === 'number' || typeof actualValue === 'string')) newConfig.height = Number(actualValue);
          else if (defaultValue) newConfig.height = Number(defaultValue);
        } else if (paramName === 'model' || paramName === 'base_model') {
          if (actualValue && typeof actualValue === 'string') newConfig.model = actualValue;
          else if (defaultValue) newConfig.model = defaultValue;
        } else if (['lora', 'lora1', 'lora2', 'lora3'].includes(paramName)) {
          const val = (actualValue && typeof actualValue === 'string') ? actualValue : defaultValue;
          if (val && typeof val === 'string') {
            newLoras.push({ model_name: val, strength: 1.0 });
          }
        }
      });
    } else {
      const allInputs = [
        ...(workflow.viewComfyJSON.inputs || []),
        ...(workflow.viewComfyJSON.advancedInputs || [])
      ].flatMap(group => group.inputs);
      allInputs.forEach(input => {
        const title = (input.title || "").toLowerCase();
        const val = input.value;
        if (title.includes("prompt") || title.includes("文本") || title.includes("提示")) {
          if (typeof val === "string") newConfig.prompt = val;
        } else if (title === "width" || title.includes("width")) {
          if (typeof val === "number" || typeof val === "string") newConfig.width = Number(val);
        } else if (title === "height" || title.includes("height")) {
          if (typeof val === "number" || typeof val === "string") newConfig.height = Number(val);
        } else if (title.includes("model") || title.includes("模型")) {
          if (!title.includes("lora")) {
            if (typeof val === "string") newConfig.model = val;
          }
        }
        if (title.includes("lora")) {
          if (typeof val === "string" && val) {
            newLoras.push({ model_name: val, strength: 1.0 });
          }
        }
      });
    }
    setConfig({ ...newConfig, loras: newLoras });
    if (selectedModel !== 'Workflow') setSelectedModel('Workflow');
    setSelectedLoras(newLoras);
  };

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Generation | undefined>(undefined);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string>("");

  const { handleGenerate: singleGenerate, isGenerating } = useGenerationService();
  const { callVision } = useAIService();

  // Wrapper for batch generation
  const handleGenerate = async (configOverride?: GenerationConfig) => {
    // Auto-expand history panel
    setShowHistory(true);

    // Create a unified timestamp for the entire batch to ensure grouping
    const startTime = new Date().toISOString();

    // Determine the effective batch size: 1 if overriding config (e.g. regenerate), otherwise current batchSize
    const effectiveBatchSize = configOverride ? 1 : batchSize;

    // Launch multiple generation tasks
    const promises = Array.from({ length: effectiveBatchSize }).map(async (_, index) => {
      // Add a small delay for each task to avoid hitting rate limits or race conditions
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, index * 300));
      }
      return await singleGenerate(configOverride, startTime);
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      console.error("Batch generation failed:", error);
    }
  };
  const { optimizePrompt, isOptimizing } = usePromptOptimization({ systemInstruction: BASE_SYSTEM_INSTRUCTION });

  const handleFilesUpload = async (files: File[] | FileList, target: 'reference' | 'describe' = 'reference') => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    const setImages = target === 'describe' ? setDescribeImages : setUploadedImages;

    for (const file of uploads) {
      const tempId = Math.random().toString(36).substring(7);
      const dataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result));
        reader.readAsDataURL(file);
      });

      // Add placeholder
      setImages((prev: UploadedImage[]) => [...prev, {
        id: tempId,
        file,
        base64: '',
        previewUrl: dataUrl,
        isUploading: true
      }]);

      const form = new FormData();
      form.append('file', file);

      try {
        const resp = await fetch('/api/upload', { method: 'POST', body: form });
        const json = await resp.json();
        const path = resp.ok && json?.path ? String(json.path) : undefined;
        const base64Data = dataUrl.split(',')[1];

        setImages((prev: UploadedImage[]) => prev.map((img: UploadedImage) =>
          img.id === tempId
            ? { ...img, base64: base64Data, path, isUploading: false }
            : img
        ));
      } catch (err) {
        console.error("Upload failed", err);
        const base64Data = dataUrl.split(',')[1];
        setImages((prev: UploadedImage[]) => prev.map((img: UploadedImage) =>
          img.id === tempId
            ? { ...img, base64: base64Data, isUploading: false }
            : img
        ));
      }
    }
  };
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (!files) return;
    // 默认通过 input 上传的归为参考图，除非有特殊逻辑
    await handleFilesUpload(files, isDescribeMode ? 'describe' : 'reference');
  };
  const removeImage = (index: number) => { setUploadedImages(prev => prev.filter((_, i) => i !== index)); };

  const AR_MAP: Record<string, Record<string, { w: number; h: number }>> = {
    '1:1': { '1K': { w: 1024, h: 1024 }, '2K': { w: 2048, h: 2048 }, '4K': { w: 4096, h: 4096 } },
    '2:3': { '1K': { w: 848, h: 1264 }, '2K': { w: 1696, h: 2528 }, '4K': { w: 3392, h: 5056 } },
    '3:2': { '1K': { w: 1264, h: 848 }, '2K': { w: 2528, h: 1696 }, '4K': { w: 5056, h: 3392 } },
    '3:4': { '1K': { w: 896, h: 1200 }, '2K': { w: 1792, h: 2400 }, '4K': { w: 3584, h: 4800 } },
    '4:3': { '1K': { w: 1200, h: 896 }, '2K': { w: 2400, h: 1792 }, '4K': { w: 4800, h: 3584 } },
    '4:5': { '1K': { w: 928, h: 1152 }, '2K': { w: 1856, h: 2304 }, '4K': { w: 3712, h: 4608 } },
    '5:4': { '1K': { w: 1152, h: 928 }, '2K': { w: 2304, h: 1856 }, '4K': { w: 4608, h: 3712 } },
    '9:16': { '1K': { w: 768, h: 1376 }, '2K': { w: 1536, h: 2752 }, '4K': { w: 3072, h: 5504 } },
    '16:9': { '1K': { w: 1376, h: 768 }, '2K': { w: 2752, h: 1536 }, '4K': { w: 5504, h: 3072 } },
    '21:9': { '1K': { w: 1584, h: 672 }, '2K': { w: 3168, h: 1344 }, '4K': { w: 6336, h: 2688 } },
  };

  const aspectRatioPresets = Object.keys(AR_MAP).map(name => ({
    name,
    width: AR_MAP[name]['1K'].w,
    height: AR_MAP[name]['1K'].h
  }));

  const getCurrentAspectRatio = () => {
    const sizeKeys = ['1K', '2K', '4K'];
    for (const [ar, sizes] of Object.entries(AR_MAP)) {
      for (const size of sizeKeys) {
        if (sizes[size].w === config.width && sizes[size].h === config.height) return ar;
      }
    }
    return "16:9";
  };
  const handleWidthChange = (newWidth: number) => { if (isAspectRatioLocked && config.height > 0) { const ratio = config.width / config.height; const newHeight = Math.round(newWidth / ratio); setConfig(prev => ({ ...prev, width: newWidth, height: newHeight })); } else { setConfig(prev => ({ ...prev, width: newWidth })); } };
  const handleHeightChange = (newHeight: number) => { if (isAspectRatioLocked && config.height > 0) { const ratio = config.width / config.height; const newWidth = Math.round(newHeight * ratio); setConfig(prev => ({ ...prev, height: newHeight, width: newWidth })); } else { setConfig(prev => ({ ...prev, height: newHeight })); } };
  const [selectedPresetName, setSelectedPresetName] = useState<string | undefined>(undefined);
  const handlePresetSelect = (p: PresetExtended) => {
    const preset = p as PresetExtended;
    const effectiveConfig = (preset.config as GenerationConfig) || (preset as unknown as GenerationConfig);
    const workflowId = (preset as PresetExtended & { workflow_id?: string }).workflow_id || effectiveConfig.workflowName;
    const presetName = (preset as PresetExtended & { title?: string; name?: string }).title || (preset as PresetExtended & { title?: string; name?: string }).name || effectiveConfig.workflowName || 'Preset';

    // If it's a workflow preset, find and select the workflow first
    if (workflowId) {
      const workflow = workflows.find(w => w.viewComfyJSON.id === workflowId);
      if (workflow) {
        setSelectedWorkflowConfig(workflow);
        setSelectedModel('Workflow');
        // Apply fixed config from preset
        setConfig({
          ...config,
          prompt: effectiveConfig.prompt || '',
          width: effectiveConfig.width || 1024,
          height: effectiveConfig.height || 1024,
          model: effectiveConfig.model || 'Workflow',
          resolution: effectiveConfig.resolution || '1K'
        });
        // Then apply remaining defaults from workflow (loras, etc)
        applyWorkflowDefaults(workflow);
      }
    } else {
      // Regular preset
      setConfig({
        ...config,
        prompt: effectiveConfig.prompt || '',
        width: effectiveConfig.width || 1024,
        height: effectiveConfig.height || 1024,
        model: effectiveConfig.model || 'Nano banana',
        resolution: effectiveConfig.resolution || '1K'
      });
      setSelectedWorkflowConfig(undefined);
      if (effectiveConfig.model && effectiveConfig.model !== config.model) {
        setSelectedModel(effectiveConfig.model);
      }
    }

    setSelectedPresetName(presetName);
    setIsPresetGridOpen(false);
  };
  const handleOptimizePrompt = async () => {
    const optimizedText = await optimizePrompt(config.prompt, selectedAIModel);
    if (optimizedText) setConfig(prev => ({ ...prev, prompt: optimizedText }));
  };

  const handleDescribe = async () => {
    if (describeImages.length === 0) {
      toast({ title: "错误", description: "请先上传图片", variant: "destructive" });
      return;
    }

    setIsDescribing(true);
    setHasGenerated(true); // Trigger split layout immediately like generate
    setShowHistory(true); // Auto-expand history panel

    const startTime = new Date().toISOString();

    // Create a temporary loading card
    const loadingId = `describe-loading-${Date.now()}`;
    const loadingCard: import('@/types/database').Generation = {
      id: loadingId,
      userId: 'anonymous',
      projectId: 'default',
      outputUrl: describeImages[0].previewUrl,
      config: {
        prompt: "Analyzing image...",
        width: config.width,
        height: config.height,
        model: config.model,
        lora: config.lora,
      },
      status: 'pending',
      sourceImageUrl: describeImages[0].previewUrl,
      createdAt: startTime,
    };

    // Insert loading card
    setGenerationHistory((prev: import('@/types/database').Generation[]) => [loadingCard, ...prev]);

    try {
      // 1. Convert the first image to base64 if needed, or use existing base64
      let base64 = describeImages[0].base64;
      if (!base64 && describeImages[0].previewUrl.startsWith('data:')) {
        base64 = describeImages[0].previewUrl.split(',')[1];
      }

      if (!base64) {
        throw new Error("无法获取图片数据");
      }

      // 2. Call unified Vision service
      const result = await callVision({
        image: `data:image/png;base64,${base64}`,
        systemPrompt: VISION_DESCRIBE_SYSTEM_PROMPT
      });

      const text = result?.text || "";
      const results = text.split('|||').map((s: string) => s.trim()).filter(Boolean);

      if (results.length > 0) {
        // Create history cards for each description result
        const newHistoryItems: import('@/types/database').Generation[] = results.map((desc: string, index: number) => ({
          id: `describe-${Date.now()}-${index}`,
          userId: 'anonymous',
          projectId: 'default',
          outputUrl: describeImages[0].previewUrl,
          config: {
            prompt: desc,
            width: config.width,
            height: config.height,
            model: "gemini-1.5-flash",
            lora: config.lora,
          },
          status: 'completed',
          sourceImageUrl: describeImages[0].previewUrl,
          createdAt: startTime,
        }));

        // Remove loading card and add real results
        setGenerationHistory((prev: import('@/types/database').Generation[]) => [...newHistoryItems, ...prev.filter(item => item.id !== loadingId)]);

        // Also save each description to backend
        newHistoryItems.forEach(item => saveHistoryToBackend(item));

        toast({ title: "描述成功", description: `已生成 ${results.length} 组描述卡片` });
      } else {
        throw new Error("解析描述结果失败");
      }
    } catch (error) {
      console.error("Describe Error:", error);
      // Remove loading card on error
      setGenerationHistory((prev: import('@/types/database').Generation[]) => prev.filter(item => item.id !== loadingId));
      toast({ title: "描述失败", description: error instanceof Error ? error.message : "未知错误", variant: "destructive" });
    } finally {
      setIsDescribing(false);
    }
  };

  const handleBatchUse = async (results: Generation[]) => {
    if (!results || results.length === 0) return;
    toast({ title: "批量生成中", description: `即将开始 ${results.length} 个生成任务...` });
    for (const result of results) {
      const newConfig = { ...config, prompt: result.config?.prompt || "" };
      await handleGenerate(newConfig);
      await new Promise(r => setTimeout(r, 200));
    }
  };

  // Removed executeBackgroundGeneration and the old handleGenerate functions.
  // The new handleGenerate from useGenerationService will be used.

  const handleRegenerate = async (result: Generation) => {
    const fullConfig: GenerationConfig = {
      ...config,
      prompt: result.config?.prompt || '',
      width: result.config?.width || config.width,
      height: result.config?.height || config.height,
      model: result.config?.model || config.model,
    };
    await handleGenerate(fullConfig);
  };

  const handleDownload = (imageUrl: string) => { const link = document.createElement("a"); link.href = imageUrl; link.download = `PlaygroundV2-${Date.now()}.png`; document.body.appendChild(link); link.click(); document.body.removeChild(link); };

  const openImageModal = (result: Generation) => {
    setSelectedResult(result);
    setIsImageModalOpen(true);
    // Ensure dashboard mode is active if we're viewing a specific result
    if (!showHistory) {
      setShowHistory(true);
    }
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    // Don't clear selectedResult here to allow exit animation to use the data
  };

  const handleEditImage = (result: import('@/types/database').Generation) => {
    const url = result.outputUrl || "";
    if (url) {
      setEditingImageUrl(url);
      setIsEditorOpen(true);
      setIsImageModalOpen(false);
    }
  };

  const handleSaveEditedImage = async (dataUrl: string) => {
    setIsEditorOpen(false);
    try {
      // 1. Convert dataUrl to Blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `edited-${Date.now()}.png`, { type: 'image/png' });

      // 2. Upload to server to get a path (consistent with standard upload flow)
      const form = new FormData();
      form.append('file', file);
      const uploadResp = await fetch('/api/upload', { method: 'POST', body: form });
      const uploadJson = await uploadResp.json();
      const path = uploadResp.ok && uploadJson?.path ? String(uploadJson.path) : undefined;

      // 3. Add to playground state
      const base64Data = dataUrl.split(',')[1];
      setUploadedImages(prev => [
        ...prev,
        { file, base64: base64Data, previewUrl: dataUrl, path }
      ]);

      toast({ title: "Image Saved", description: "The edited image has been added to your uploads." });
    } catch (error) {
      console.error("Failed to save edited image:", error);
      toast({ title: "Error", description: "Failed to save edited image", variant: "destructive" });
    }
  };




  // Input UI Helper to avoid duplication
  const renderInputUI = () => (
    <div className={cn(
      "flex flex-col items-center w-full pointer-events-auto"
    )}>
      {!showHistory && (
        <div style={{ fontFamily: "'InstrumentSerif', serif" }}>
          <SplitText
            text="✨Turn any idea into a stunning image"
            tag="h1"
            className="text-[2rem] text-white font-medium text-center mb-4 h-auto opacity-100 z-10 whitespace-nowrap"
            duration={0.5}
            delay={30}
            splitType="chars"
            from={{ opacity: 0, y: 40 }}
            to={{ opacity: 1, y: 0 }}
            ease="power3.out"
           
            rootMargin="-100px"
            threshold={0.1}
          />
        </div>
      )}
        

      <div
        className="relative w-full rounded-[10px]"
      >
        <div className={
          cn(
            "relative z-10 flex items-center bg-black/40 justify-center w-full text-black flex-col rounded-[30px] backdrop-blur-xl border border-white/20 p-2 transition-colors duration-100",
            showHistory ? "bg-[#13263161]" : "bg-black/40"
          )}>
          <div className="flex items-start gap-0 bg-black/20 border border-white/10 rounded-3xl w-full pl-4 relative overflow-hidden ">
            <div
              className="flex items-center shrink-0 ml-1 h-14 self-start mt-4 mb-4"
              onMouseEnter={() => setIsStackHovered(true)}
              onMouseLeave={() => setIsStackHovered(false)}
            >
              {/* 图片堆栈 */}
              {uploadedImages.map((image, index) => {
                const rotations = [-6, 4, -2, 3];
                return (
                  <motion.div
                    key={image.id || index}
                    initial={false}
                    animate={{
                      marginLeft: index === 0 ? 0 : (isStackHovered ? 8 : -36),
                      rotate: isStackHovered ? 0 : rotations[index % rotations.length],
                      scale: 1
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    style={{
                      zIndex: (uploadedImages.length - index) + 100,
                      position: 'relative'
                    }}
                  >
                    <div className="relative group ">
                      <div className="relative">
                        <Image
                          src={image.previewUrl}
                          alt={`Uploaded ${index + 1}`}
                          width={56}
                          height={56}
                          className={cn(
                            "w-14 h-14 object-cover rounded-2xl bg-black  border border-primary shadow-xl",
                            image.isUploading && "opacity-50 grayscale blur-[1px]"
                          )}
                        />
                        {image.isUploading && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      {!image.isUploading && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                          className="absolute -top-1 -right-1 bg-white text-black border border-white/40 rounded-full w-4 h-4 flex items-center justify-center scale-0 group-hover:scale-100 transition-transform duration-100 hover:bg-red-500"
                        >
                          <X className="w-2 h-2" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {/* 上传按钮 - 作为堆栈的最后一个元素 */}
              <motion.button
                onClick={() => fileInputRef.current?.click()}
                initial={false}
                animate={{
                  rotate: 3,
                  marginLeft: uploadedImages.length > 0 ? (isStackHovered ? 8 : -36) : 0,
                  scale: 1
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "tween", duration: 0.05 }}
                style={{
                  zIndex: 0,
                  position: 'relative'
                }}
                className={cn(
                  "w-14 h-14 shrink-0 flex items-center justify-center rounded-2xl text-primary border border-white/20 bg-white/5 hover:border-primary hover:shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all group"
                )}
              >
                <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
              </motion.button>
            </div>



            <div className="flex-1 mt-1  flex items-center gap-2">
              <div className="flex-1">
                <PromptInput
                  prompt={config.prompt}
                  onPromptChange={(val) => setConfig(prev => ({ ...prev, prompt: val }))}
                  uploadedImages={uploadedImages}
                  onRemoveImage={removeImage}
                  isOptimizing={isOptimizing}
                  onOptimize={handleOptimizePrompt}
                  selectedAIModel={selectedAIModel}
                  onAIModelChange={setSelectedAIModel}
                  onAddImages={handleFilesUpload}
                  onFocusChange={setIsInputFocused}
                  isDraggingOver={isDraggingOver}
                />
              </div>
              <Button
                variant="default"
                size="sm"
                className="h-4 w-4 absolute right-4 top-4 bg-transparent hover:text-white hover:drop-shadow-[0_0_px_rgba(255,255,255,0.8)] text-white/70 rounded-2xl "
                disabled={isOptimizing}
                onClick={() => {
                  if (!isOptimizing) {
                    handleOptimizePrompt();
                  }
                }}
              >
                <motion.div
                  animate={isOptimizing ? {
                    filter: [
                      "drop-shadow(0 0 2px rgba(255, 255, 255, 0.4))",
                      "drop-shadow(0 0 10px rgba(255, 255, 255, 0.8))",
                      "drop-shadow(0 0 2px rgba(255, 255, 255, 0.4))"
                    ]
                  } : {}}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="flex items-center justify-center"
                >
                  <Sparkles className="w-2 h-2  " />
                </motion.div>
              </Button>
            </div>

            {/* 底部模糊遮罩 - 从 PromptInput 移动到此处以覆盖整个输入区范围 */}
            <div
              className={cn(
                "absolute bottom-0 left-0 right-0 h-10 pointer-events-none bg-gradient-to-t from-black/95 via-black/50 to-transparent transition-opacity duration-300 rounded-b-3xl z-10",
                (!isInputFocused && config.prompt?.length > 0) ? "opacity-40" : "opacity-0"
              )}
            />
          </div>

          <ControlToolbar
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            config={config}
            onConfigChange={(newConf) => setConfig(prev => ({ ...prev, ...newConf }))}
            onWidthChange={handleWidthChange}
            onHeightChange={handleHeightChange}
            aspectRatioPresets={aspectRatioPresets}
            currentAspectRatio={getCurrentAspectRatio()}
            onAspectRatioChange={(ar: string) => {
              const size = (config.model === 'Nano banana') ? (config.resolution || '1K') : '1K';
              const resolution = AR_MAP[ar]?.[size] || AR_MAP[ar]?.['1K'];
              if (resolution) {
                setConfig(prev => ({ ...prev, width: resolution.w, height: resolution.h }));
              }
            }}
            currentImageSize={(config.resolution as '1K' | '2K' | '4K') || '1K'}
            onImageSizeChange={(size: string) => {
              const ar = getCurrentAspectRatio();
              const resolution = AR_MAP[ar]?.[size as '1K' | '2K' | '4K'] || AR_MAP[ar]?.['1K'];
              if (resolution) {
                setConfig({
                  ...config,
                  width: resolution.w,
                  height: resolution.h,
                  resolution: size as Resolution
                });
              }
            }}
            isAspectRatioLocked={isAspectRatioLocked}
            onToggleAspectRatioLock={() => setIsAspectRatioLocked(!isAspectRatioLocked)}
            onGenerate={() => { handleGenerate(); }}
            isGenerating={isGenerating}
            loadingText={selectedModel === "Seed 4.0" ? "Seed 4.0 生成中..." : "生成中..."}
            selectedWorkflowName={selectedWorkflowConfig?.viewComfyJSON.title}
            selectedBaseModelName={config.model}
            workflows={workflows}
            onWorkflowSelect={(wf) => { setSelectedWorkflowConfig(wf); applyWorkflowDefaults(wf); }}
            isMockMode={isMockMode}
            onMockModeChange={setMockMode}
            isSelectorExpanded={isSelectorExpanded}
            onSelectorExpandedChange={setIsSelectorExpanded}
            batchSize={batchSize}
            onBatchSizeChange={setBatchSize}
            onOpenLoraSelector={() => setIsLoraDialogOpen(true)}
            selectedLoras={selectedLoras}
            selectedPresetName={selectedPresetName}
            onTogglePresetGrid={() => setIsPresetGridOpen(!isPresetGridOpen)}
            isPresetGridOpen={isPresetGridOpen}
          />

        </div>
      </div>

      {isDescribeMode && (
        <DescribePanel
          open={isDescribeMode}
          panelRef={describePanelRef}
          describeImages={describeImages}
          isDraggingOverPanel={isDraggingOverPanel}
          setIsDraggingOverPanel={setIsDraggingOverPanel}
          setIsDraggingOver={setIsDraggingOver}
          onUploadClick={() => fileInputRef.current?.click()}
          onDropFiles={(files) => handleFilesUpload(files, 'describe')}
          onClose={() => setIsDescribeMode(false)}
          onRemoveImage={(idx) => setDescribeImages((prev: UploadedImage[]) => prev.filter((_: UploadedImage, i: number) => i !== idx))}
          isDescribing={isDescribing}
          isGenerating={isGenerating}
          onDescribe={handleDescribe}
        />
      )}
    </div>
  );

  return (
    <div
      className="flex-1 relative p-12 pt-16 h-full flex flex-col overflow-hidden"
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
        // 自动展开 Describe 面板
        if (!isDescribeMode) {
          setIsDescribeMode(true);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingOver) setIsDraggingOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Check if we are really leaving the window
        if (e.relatedTarget === null || (e.relatedTarget as Node).nodeName === 'HTML') {
          setIsDraggingOver(false);
          setIsDraggingOverPanel(false);
          // 如果退出且没有图片，自动收起
          if (describeImages.length === 0) {
            setIsDescribeMode(false);
          }
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        setIsDraggingOverPanel(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          const dropY = e.clientY;
          const windowHeight = window.innerHeight;

          // 如果是在 Describe 面板区域附近（或当前面板已展开），上传到 Describe
          if (isDescribeMode || dropY < windowHeight * 0.4) {
            handleFilesUpload(files, 'describe');
          } else {
            toast({ title: "已添加参考图", description: "图片已上传至当前生成配置中" });
            handleFilesUpload(files, 'reference');
          }
        } else {
          // 如果松手时没有文件，则收起面板（如果是误操作）
          if (describeImages.length === 0) {
            setIsDescribeMode(false);
          }
        }
      }}
    >

      <div className="flex-1 bg-transparent border border-white/20 rounded-[2rem] overflow-hidden relative flex flex-col">
        <main className="relative h-full flex bg-transparent overflow-hidden">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
          />

          <div ref={containerRef} className="relative w-full h-full flex flex-col items-center">
            <PlaygroundBackground />
            <div className="relative z-20 flex flex-col items-center justify-center w-full h-full ">
              {/* Project Sidebar Overlay */}
              <div className="absolute left-6 top-6  h-full z-40 pointer-events-none">
                <div className="pointer-events-auto h-full">

                  {showProjectSidebar ? (
                    <div
                      key="project-sidebar"
                      className="relative shrink-0 py-6"
                    >
                      <ProjectSidebar onShowAllProjects={() => setShowAllProjects(true)} />

                    </div>
                  ) : (
                    <div
                      key="project-open-btn"
                      className="py-6 shrink-0"
                    >
                      <button
                        onClick={() => setShowProjectSidebar(true)}
                        className="flex items-center gap-2 group px-4 py-2 rounded-full border border-white/10 bg-black/40 text-white/40 hover:bg-white/10 hover:text-white transition-all"
                        title="展开项目"
                      >
                        <PanelLeftOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Project</span>
                      </button>
                    </div>
                  )}

                </div>
              </div>

              {/* Gallery Overlay */}
              <div className="absolute right-6 top-6 bottom-6 z-40 pointer-events-none">
                <div className="pointer-events-auto h-full">

                  {showGallery ? (
                    <div
                      key="gallery-panel"
                      className="w-[380px] h-full py-6 flex flex-col"
                    >
                      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-3xl h-full flex flex-col overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-4 sticky top-0 z-10">
                          <div className="flex items-center bg-black/40 backdrop-blur-xl p-1 rounded-full border border-white/10">
                            {(['gallery', 'styles'] as const).map(tab => (
                              <button
                                key={tab}
                                onClick={() => setActiveGalleryTab(tab)}
                                className={cn(
                                  "px-4 py-1.5 rounded-full text-[10px] font-medium transition-all duration-300",
                                  activeGalleryTab === tab
                                    ? "bg-primary text-black shadow-lg"
                                    : "text-white/50 hover:text-white hover:bg-white/10"
                                )}
                              >
                                {tab === 'gallery' && "全部作品"}
                                {tab === 'styles' && "Style"}
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setShowGallery(false)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-black/40 text-white/40 hover:bg-white/10 hover:text-white transition-all text-[10px]"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Close</span>
                          </button>
                        </div>
                        <div className="flex-1 min-h-0">
                          <GalleryView variant="sidebar" activeTab={activeGalleryTab} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      key="gallery-open-btn"
                      className="py-6"
                    >
                      <button
                        onClick={() => setShowGallery(true)}
                        className="flex items-center gap-2 group px-4 py-2 rounded-full border border-white/10 bg-black/40 text-white/40 hover:bg-white/10 hover:text-white transition-all shadow-lg"
                        title="展开画廊"
                      >
                        <PanelRightOpen className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">Gallery</span>
                      </button>
                    </div>
                  )}

                </div>
              </div>

              <div className={cn(
                "flex flex-col items-center max-w-4xl w-full relative z-30",
                showHistory ? "w-[55vw] max-w-full h-[85vh] mt-10" : (isPresetGridOpen ? "mt-0" : "-mt-60")
              )}>
                {/* Input UI */}
                <div ref={promptWrapperRef} className="w-full">
                  <div className="w-full">
                    {renderInputUI()}
                  </div>
                </div>

                {/* History/Describe Trigger - Only show if history is NOT visible */}
                {!showHistory && !isDescribeMode && !isPresetGridOpen && (
                  <div className="flex justify-center mt-4 gap-4">
                    <button
                      onClick={() => setIsDescribeMode(!isDescribeMode)}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 rounded-full border backdrop-blur-md transition-all bg-white/5",
                        isDescribeMode
                          ? "text-white bg-black/40 border-white/60"
                          : "border-white/20 text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span className="text-sm font-medium">Describe</span>
                    </button>
                    <button
                      onClick={() => setShowHistory(true)}
                      className={cn(
                        "flex items-center gap-2 px-6 py-2 rounded-full border border-white/20 backdrop-blur-md transition-all bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <History className="w-4 h-4" />
                      <span className="text-sm font-medium">History</span>
                    </button>
                  </div>
                )}

                {!isDescribeMode && isPresetGridOpen && (
                  <PresetGridOverlay
                    onOpenManager={() => setIsPresetManagerOpen(true)}
                    onSelectPreset={handlePresetSelect}
                  />
                )}

                {/* 历史记录区域 */}

                {showHistory && (
                  <div

                    className="mt-6 w-full flex-1 overflow-hidden min-h-0 relative z-10"
                  >
                    <div className="bg-white/5  border border-white/10 rounded-3xl h-full flex flex-col relative">
                      {/* Header Actions: Layout Toggle \u0026 Collapse */}
                      <div className="absolute top-6 left-8 z-30  ">
                        <span>History</span>

                      </div>
                      <div className="absolute top-6 right-8 z-30 flex items-center gap-3">
                        <div className="flex items-center p-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
                          <button
                            onClick={() => setHistoryLayoutMode('grid')}
                            className={cn(
                              "p-1.5 rounded-md transition-all",
                              historyLayoutMode === 'grid'
                                ? "bg-white/10 text-white"
                                : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                            title="Grid View"
                          >
                            <LayoutGrid className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setHistoryLayoutMode('list')}
                            className={cn(
                              "p-1.5 rounded-md transition-all",
                              historyLayoutMode === 'list'
                                ? "bg-white/10 text-white"
                                : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                            title="List View"
                          >
                            <List className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => setShowHistory(false)}
                          className="flex items-center h-8 w-8 justify-center rounded-full border border-white/10 bg-white/5  text-white/40 hover:bg-white/10 hover:text-white transition-all"
                        >
                          <X className="w-4 h-4 hover:drop-shadow(0 0 10px rgba(255, 255, 255, 0.4))" />

                        </button>
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <HistoryList
                          variant="sidebar"
                          history={generationHistory}
                          onRegenerate={(res) => {
                            if (res.config) {
                              applyModel(res.config.model, {
                                ...res.config,
                                loras: res.config.loras || []
                              });
                            }
                            handleRegenerate(res);
                          }}
                          onDownload={handleDownload}
                          onImageClick={openImageModal}
                          onBatchUse={handleBatchUse}
                          layoutMode={historyLayoutMode}
                        />
                      </div>
                    </div>
                  </div>
                )}



              </div>

            </div>

          </div>
          {!isPresetGridOpen && !isPresetManagerOpen && !showHistory && (
            <div className=" absolute bottom-0 w-full  overflow-visible">
              <StylesMarquee />
            </div>

          )}

          <GoogleApiStatus className="fixed bottom-4 right-4 z-[60]" />

          {showAllProjects && <AllProjectsView onClose={() => setShowAllProjects(false)} />}

          <div className="top-0 left-0 right-0 pt-24 pointer-events-none">
            <ImagePreviewModal
              isOpen={isImageModalOpen}
              onClose={closeImageModal}
              result={selectedResult}
              onEdit={handleEditImage}
            />

            <ImageEditorModal
              isOpen={isEditorOpen}
              imageUrl={editingImageUrl}
              onClose={() => setIsEditorOpen(false)}
              onSave={handleSaveEditedImage}
            />
          </div>

          <WorkflowSelectorDialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen} onSelect={(wf) => setSelectedWorkflowConfig(wf)} onEdit={onEditMapping} />
          <BaseModelSelectorDialog open={isBaseModelDialogOpen} onOpenChange={setIsBaseModelDialogOpen} value={config.model || selectedModel} onConfirm={(m) => updateConfig({ model: m })} />
          <LoraSelectorDialog open={isLoraDialogOpen} onOpenChange={setIsLoraDialogOpen} value={selectedLoras} onConfirm={(list) => setSelectedLoras(list)} />
          <PresetManagerDialog
            open={isPresetManagerOpen}
            onOpenChange={setIsPresetManagerOpen}
            workflows={workflows}
          />
        </main>
      </div>
    </div>
  );
});

export default function PlaygroundV2Route() {
  return <PlaygroundV2Page />;
}
