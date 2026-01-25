"use client";


import React, { useState, useEffect, useRef, useMemo, Suspense, useCallback } from "react";
import NextImage from "next/image";
import { useToast } from "@/hooks/common/use-toast";

import { usePromptOptimization, AIModel } from "@/hooks/features/PlaygroundV2/usePromptOptimization";


import { useGenerationService, type GenerateOptions } from "@/hooks/features/PlaygroundV2/useGenerationService";
import { useAIService as useAIServiceV1 } from "@/hooks/ai/useAIService";

import { GoogleApiStatus } from "@/components/features/playground-v2/GoogleApiStatus";
import SimpleImagePreview from "@/components/features/playground-v2/SimpleImagePreview";
import HistoryList from "@/components/features/playground-v2/HistoryList";
import ImagePreviewModal from "@/components/features/playground-v2/Dialogs/ImagePreviewModal";
import TldrawEditorModal from "@/components/features/playground-v2/Dialogs/TldrawEditorModal";
import WorkflowSelectorDialog from "@/components/features/playground-v2/Dialogs/WorkflowSelectorDialog";
import BaseModelSelectorDialog from "@/components/features/playground-v2/Dialogs/BaseModelSelectorDialog";
import LoraSelectorDialog, { SelectedLora } from "@/components/features/playground-v2/Dialogs/LoraSelectorDialog";
import { PresetManagerDialog } from "@/components/features/playground-v2/Dialogs/PresetManagerDialog";
import type { IViewComfy } from "@/lib/providers/view-comfy-provider";
import type { WorkflowApiJSON } from "@/lib/workflow-api-parser";
import type { UIComponent } from "@/types/features/mapping-editor";
import { VISION_DESCRIBE_SYSTEM_PROMPT, type GenerationConfig, type UploadedImage, type PresetExtended, type EditPresetConfig } from "@/components/features/playground-v2/types";
import type { Generation } from "@/types/database";
import { downloadImage } from '@/lib/utils/download';
import type { TLEditorSnapshot } from 'tldraw';

import { cn } from "@/lib/utils";
import { getApiBase, formatImageUrl } from "@/lib/api-base";
import { MODEL_ID_WORKFLOW } from "@/lib/constants/models";
import { isWorkflowModel } from "@/lib/utils/model-utils";
import { History, Image as ImageIcon, Edit2, Sparkles, Palette } from "lucide-react";
import { TooltipButton } from "@/components/ui/tooltip-button";
import dynamic from "next/dynamic";

const GalleryView = dynamic(() => import("@/components/features/playground-v2/GalleryView"), {
  loading: () => <div className="flex items-center justify-center h-full text-white">Loading Gallery...</div>,
  ssr: false
});
import { StyleStacksView } from '@/components/features/playground-v2/StyleStacksView';
import { usePlaygroundStore } from "@/lib/store/playground-store";
import { useMediaQuery } from "@/hooks/common/use-media-query";
import { PresetGridOverlay } from "@/components/features/playground-v2/PresetGridOverlay";
import { PlaygroundBackground } from "@/components/features/playground-v2/PlaygroundBackground";
import { PlaygroundInputSection } from "@/components/features/playground-v2/PlaygroundInputSection";
import { AR_MAP } from "@/components/features/playground-v2/constants/aspect-ratio";
import { StylesMarquee } from "@/components/features/playground-v2/StylesMarquee";
import { v4 as uuidv4 } from 'uuid';


import gsap from "gsap";
import { Flip } from "gsap/all";
import { useGSAP } from "@gsap/react";
import { observer } from "mobx-react-lite";
import { projectStore } from "@/lib/store/project-store";
import { AllProjectsView } from "@/components/features/playground-v2/ProjectSection/project-sidebar/AllProjectsView";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  defaultDropAnimationSideEffects
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

gsap.registerPlugin(Flip, useGSAP);

export interface PlaygroundV2PageProps {
  onEditMapping?: (workflow: IViewComfy) => void;
  onGenerate?: () => void;
  onHistoryChange?: (history: Generation[]) => void;

}


export const PlaygroundV2Page = observer(function PlaygroundV2Page({
  onEditMapping,
}: PlaygroundV2PageProps) {
  const { toast } = useToast();
  const isDesktop = useMediaQuery("(min-width: 1440px)");
  const config = usePlaygroundStore(s => s.config);
  const updateConfig = usePlaygroundStore(s => s.updateConfig);
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
  const fetchGallery = usePlaygroundStore(s => s.fetchGallery);
  const applyModel = usePlaygroundStore(s => s.applyModel);
  const addStyle = usePlaygroundStore(s => s.addStyle);
  const updateUploadedImage = usePlaygroundStore(s => s.updateUploadedImage);
  const updateDescribeImage = usePlaygroundStore(s => s.updateDescribeImage);
  const syncLocalImageToHistory = usePlaygroundStore(s => s.syncLocalImageToHistory);


  const setConfig = React.useCallback((val: GenerationConfig | ((prev: GenerationConfig) => GenerationConfig)) => {
    const currentConfig = usePlaygroundStore.getState().config;
    if (typeof val === 'function') {
      updateConfig(val(currentConfig));
    } else {
      updateConfig(val);
    }
  }, [updateConfig]);

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
    // 预加载历史记录
    fetchHistory(1, mobxProjectId || undefined);
    // 预加载图库 (之前图库只有在切换到图库标签且组件挂载后才加载)
    fetchGallery(1);
  }, [fetchHistory, fetchGallery, mobxProjectId]);

  const filteredHistory = useMemo(() => {
    if (!mobxProjectId) return generationHistory;
    return generationHistory.filter(h => h.projectId === mobxProjectId);
  }, [generationHistory, mobxProjectId]);

  const [selectedAIModel, setSelectedAIModel] = useState<AIModel>('auto'); // 默认使用settings中的配置
  const [isWorkflowDialogOpen, setIsWorkflowDialogOpen] = useState(false);
  const [isBaseModelDialogOpen, setIsBaseModelDialogOpen] = useState(false);
  const [isLoraDialogOpen, setIsLoraDialogOpen] = useState(false);
  const [workflows, setWorkflows] = useState<IViewComfy[]>([]);
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState(false);
  const [isDescribing, setIsDescribing] = useState(false);
  // const [isDescribeMode, setIsDescribeMode] = useState(false); // Refactored to viewMode
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isDraggingOverPanel, setIsDraggingOverPanel] = useState(false);
  const [historyLayoutMode, setHistoryLayoutMode] = useState<'grid' | 'list'>('list');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [batchSize, setBatchSize] = useState(4); // Default batch size
  const [pendingPresetEditConfig, setPendingPresetEditConfig] = useState<EditPresetConfig | undefined>(undefined);


  const {
    showHistory,
    setShowHistory,
    showProjectSidebar,
    selectedPresetName,
    setSelectedPresetName,
    viewMode,
    setViewMode,
    activeTab,
    setActiveTab,
    previewImageUrl,
    previewLayoutId,
    setPreviewImage,
    setIsSelectionMode,
    selectedHistoryIds,
    clearHistorySelection,
    setGenerationHistory: setGlobalGenerationHistory
  } = usePlaygroundStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const [activeDragItem, setActiveDragItem] = useState<Generation | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'history-item') {
      setActiveDragItem(event.active.data.current.generation);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { over } = event;
    if (!over) return;

    const selectedItems = generationHistory.filter(h => selectedHistoryIds.has(h.id));

    if (over.data.current?.type === 'project') {
      const targetProjectId = over.data.current.projectId;

      // 1. Update project store
      await projectStore.addGenerationsToProject(targetProjectId, selectedItems);

      // 2. Update global store
      setGlobalGenerationHistory(prev => prev.map(item =>
        selectedHistoryIds.has(item.id) ? { ...item, projectId: targetProjectId } : item
      ));

      toast({ title: "Success", description: `Moved ${selectedItems.length} items to project` });
      setIsSelectionMode(false);
      clearHistorySelection();
    } else if (over.data.current?.type === 'new-project') {
      // 1. Create new project
      const newProject = await projectStore.createProjectWithHistory('New Project', selectedItems);

      // 2. Update global store
      setGlobalGenerationHistory(prev => prev.map(item =>
        selectedHistoryIds.has(item.id) ? { ...item, projectId: newProject.id } : item
      ));

      toast({ title: "Success", description: `Created new project with ${selectedItems.length} items` });
      setIsSelectionMode(false);
      clearHistorySelection();
    }
  };

  useEffect(() => {
    projectStore.toggleSidebar(showProjectSidebar);
  }, [showProjectSidebar]);

  // Sync showHistory with viewMode for side effects (like project sidebar)
  useEffect(() => {
    if (viewMode === 'dock') {
      if (!showHistory) setShowHistory(true);
    } else {
      if (showHistory) setShowHistory(false);
    }
  }, [viewMode, setShowHistory, showHistory]);

  useEffect(() => {
    if (isWorkflowModel(selectedModel) && config.presetName && !selectedWorkflowConfig) {
      const wf = workflows.find(w => w.viewComfyJSON.title === config.presetName);
      if (wf) {
        setSelectedWorkflowConfig(wf);
      }
    }
  }, [config.presetName, selectedModel, workflows, selectedWorkflowConfig, setSelectedWorkflowConfig]);

  // Removed click outside listener for Describe panel as it is now a persistent tab in Dock Mode.

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
        createdAt: item.createdAt || new Date().toISOString(),
      };
      await fetch(`${getApiBase()}/history`, {
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
        const res = await fetch(`${getApiBase()}/view-comfy`);
        if (res.ok) {
          const data = await res.json();
          setWorkflows(data.viewComfys || []);
        }
      } catch (error) {
        console.error("Failed to fetch workflows", error);
      }
    };
    fetchWorkflows();
  }, []);

  useEffect(() => {
    const path = uploadedImages[0]?.path;
    updateConfig({ sourceImageUrls: path ? [path] : [] });
  }, [uploadedImages, updateConfig]);


  const updateHistorySourceUrl = usePlaygroundStore(s => s.updateHistorySourceUrl);

  const applyWorkflowDefaults = React.useCallback((workflow: IViewComfy) => {
    const mappingConfig = workflow.viewComfyJSON.mappingConfig as { components: UIComponent[] } | undefined;
    const newLoras: SelectedLora[] = [];

    // 我们不再在外部创建 newConfig = { ...config }，而是通过 setConfig(prev => ...) 来构造
    setConfig(prev => {
      const nextConfig = { ...prev };
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
            if (actualValue && typeof actualValue === 'string') nextConfig.prompt = actualValue;
            else if (defaultValue) nextConfig.prompt = defaultValue;
          } else if (paramName === 'width') {
            if (actualValue && (typeof actualValue === 'number' || typeof actualValue === 'string')) nextConfig.width = Number(actualValue);
            else if (defaultValue) nextConfig.width = Number(defaultValue);
          } else if (paramName === 'height') {
            if (actualValue && (typeof actualValue === 'number' || typeof actualValue === 'string')) nextConfig.height = Number(actualValue);
            else if (defaultValue) nextConfig.height = Number(defaultValue);
          } else if (paramName === 'model' || paramName === 'base_model') {
            if (actualValue && typeof actualValue === 'string') nextConfig.model = actualValue;
            else if (defaultValue) nextConfig.model = defaultValue;
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
            if (typeof val === "string") nextConfig.prompt = val;
          } else if (title === "width" || title.includes("width")) {
            if (typeof val === "number" || typeof val === "string") nextConfig.width = Number(val);
          } else if (title === "height" || title.includes("height")) {
            if (typeof val === "number" || typeof val === "string") nextConfig.height = Number(val);
          } else if (title.includes("model") || title.includes("模型")) {
            if (!title.includes("lora")) {
              if (typeof val === "string") nextConfig.model = val;
            }
          }
          if (title.includes("lora")) {
            if (typeof val === "string" && val) {
              newLoras.push({ model_name: val, strength: 1.0 });
            }
          }
        });
      }

      // 这里直接返回修改后的配置，同时也更新 Loras
      return {
        ...nextConfig,
        loras: newLoras,
        presetName: usePlaygroundStore.getState().selectedPresetName || nextConfig.presetName
      };
    });

    if (!isWorkflowModel(selectedModel)) setSelectedModel(MODEL_ID_WORKFLOW);
    setSelectedLoras(newLoras);
  }, [setConfig, selectedModel, setSelectedModel, setSelectedLoras]);

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Generation | undefined>(undefined);
  /* Tldraw Editor States from Store */
  const isTldrawEditorOpen = usePlaygroundStore((s) => s.isTldrawEditorOpen);
  const tldrawEditingImageUrl = usePlaygroundStore((s) => s.tldrawEditingImageUrl);
  const setTldrawEditorOpen = usePlaygroundStore((s) => s.setTldrawEditorOpen);
  const tldrawSnapshot = usePlaygroundStore((s) => s.tldrawSnapshot);

  // States for other dialogs
  const [isPresetGridOpen, setIsPresetGridOpen] = useState(false);
  const { handleGenerate: singleGenerate, executeGeneration, syncHistoryConfig, isGenerating } = useGenerationService();

  // Wrapper for batch generation
  const handleGenerate = React.useCallback(async (options: GenerateOptions = {}) => {
    const { configOverride } = options;
    // Switch to Dock Mode and History Tab
    setViewMode('dock');
    setActiveTab('history');
    setShowHistory(true); // Explicitly set for immediate effect

    // Create a unified timestamp and taskId for the entire batch to ensure grouping
    const startTime = new Date().toISOString();
    const batchTaskId = options.taskId || configOverride?.taskId || (Date.now().toString() + Math.random().toString(36).substring(2, 7));

    // Determine the effective batch size: 1 if overriding config (e.g. regenerate), otherwise current batchSize
    const effectiveBatchSize = configOverride ? 1 : batchSize;

    // Launch generation tasks
    // Frontend logic: call singleGenerate for each task immediately to show loading cards
    // Backend logic: singleGenerate handles the sequential submission or we use a custom delay here for the API call only
    for (let i = 0; i < effectiveBatchSize; i++) {
      // Create history item immediately to show all cards at once
      const currentConfig = usePlaygroundStore.getState().config;
      const currentLoras = usePlaygroundStore.getState().selectedLoras;
      const finalConfig = {
        ...currentConfig,
        ...(configOverride && typeof configOverride === 'object' ? configOverride : {}),
        loras: currentLoras,
        taskId: batchTaskId,
        isPreset: !!(currentConfig.presetName || (configOverride as GenerationConfig)?.presetName)
      };
      const currentUploadedImages = usePlaygroundStore.getState().uploadedImages;
      const sourceImageUrls = currentUploadedImages.map(img => img.path || img.previewUrl);

      // 1. Immediately create and show the pending card
      // 关键修复：普通生成显式禁用 isEdit，逻辑上它不是编辑。
      // 使用显式合并逻辑，并保证 prompt 不为空
      const displayConfigOverride: GenerationConfig = {
        ...currentConfig,
        ...(configOverride || {}),
        prompt: (configOverride as Partial<GenerationConfig>)?.prompt || currentConfig.prompt || '',
        isEdit: false
      };

      singleGenerate({
        configOverride: displayConfigOverride,
        fixedCreatedAt: startTime,
        isBackground: true,
        editConfig: undefined,
        taskId: batchTaskId,
        sourceImageUrls
      }).then((uniqueId) => {
        // 2. Schedule the actual backend execution with a staggered delay
        if (uniqueId) {
          setTimeout(() => {
            // 确保执行任务也显式携带 isEdit: false
            if (typeof uniqueId === 'string') {
              executeGeneration(uniqueId, batchTaskId, { ...finalConfig, isEdit: false }, startTime, sourceImageUrls);
            }
          }, i * 1100);
        }
      });
    }
  }, [batchSize, singleGenerate, executeGeneration, setViewMode, setActiveTab, setShowHistory]);

  const { optimizePrompt, isOptimizing } = usePromptOptimization();
  const { callVision } = useAIServiceV1();

  const handleFilesUpload = React.useCallback(async (files: File[] | FileList, target: 'reference' | 'describe' = 'reference') => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    const setImages = target === 'describe' ? setDescribeImages : setUploadedImages;
    const updateImage = target === 'describe' ? updateDescribeImage : updateUploadedImage;

    for (const file of uploads) {
      const tempId = uuidv4(); // Use uuid for better ID management

      // 1. Generate local preview and base64 immediately
      const dataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result));
        reader.readAsDataURL(file);
      });
      const base64Data = dataUrl.split(',')[1];

      // 2. Get image dimensions
      const dimensions: { width: number; height: number } = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.src = dataUrl;
      });


      // 4. Add to UI immediately (prepend to show on top)
      setImages((prev: UploadedImage[]) => [{
        id: tempId,
        localId: tempId,
        file,
        base64: base64Data,
        previewUrl: dataUrl,
        isUploading: true,
        width: dimensions.width,
        height: dimensions.height
      }, ...prev]);

      // 5. Update config for 'auto' mode if it's the first image in reference
      if (target === 'reference' && usePlaygroundStore.getState().config.aspectRatio === 'auto') {
        let { width, height } = dimensions;
        const minSide = Math.min(width, height);
        if (minSide < 1024) {
          const scale = 1024 / minSide;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        updateConfig({ width, height });
      }

      // 6. Start background upload (NO await)
      (async () => {
        const form = new FormData();
        form.append('file', file);

        const originalUrl = dataUrl; // Keep track of the local URL

        try {
          const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: form });
          const json = await resp.ok ? await resp.json() : null;
          const path = json?.path ? String(json.path) : undefined;

          // Update the specific image with its CDN path
          updateImage(tempId, { path, isUploading: false });

          // Also update history records that were using this local URL or localId
          if (path) {
            updateHistorySourceUrl(originalUrl, path);
            await syncLocalImageToHistory(tempId, path);
          }
        } catch (err) {
          console.error("Upload failed in background", err);
          updateImage(tempId, { isUploading: false });
        }
      })();
    }
  }, [setDescribeImages, setUploadedImages, updateDescribeImage, updateUploadedImage, updateHistorySourceUrl, updateConfig, syncLocalImageToHistory]);
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (!files) return;
    // 默认通过 input 上传的归为参考图，除非有特殊逻辑
    await handleFilesUpload(files, activeTab === 'describe' ? 'describe' : 'reference');
  };
  const removeImage = React.useCallback((index: number) => { setUploadedImages(prev => prev.filter((_, i) => i !== index)); }, [setUploadedImages]);

  const handleStyleUpload = async (files: File[] | FileList) => {
    const uploads = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (uploads.length === 0) return;

    toast({ title: "正在上传图片", description: `正在为新风格处理 ${uploads.length} 张图片...` });

    try {
      const uploadPromises = uploads.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${getApiBase()}/upload`, { method: 'POST', body: formData });
        if (!resp.ok) throw new Error('Upload failed');
        const data = await resp.json();
        return data.path;
      });

      const imagePaths = await Promise.all(uploadPromises);

      const newStyle = {
        id: uuidv4(),
        name: `新风格 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        prompt: '',
        imagePaths,
        updatedAt: new Date().toISOString()
      };

      await addStyle(newStyle);
      toast({ title: "风格创建成功", description: `已成功创建新风格并包含 ${uploads.length} 张图片` });
    } catch (error) {
      console.error("Failed to upload images for new style", error);
      toast({
        title: "创建失败",
        description: "上传图片过程中出现错误，请重试",
        variant: "destructive"
      });
    }
  };




  const handlePresetSelect = (p: PresetExtended) => {
    const preset = p as PresetExtended;
    const effectiveConfig = (preset.config as GenerationConfig) || (preset as unknown as GenerationConfig);
    const workflowId = (preset as PresetExtended & { workflow_id?: string }).workflow_id || effectiveConfig.presetName;
    const presetName = (preset as PresetExtended & { title?: string; name?: string }).title || (preset as PresetExtended & { title?: string; name?: string }).name || effectiveConfig.presetName || 'Preset';

    if (preset.editConfig) {
      setTldrawEditorOpen(true, formatImageUrl(preset.editConfig.originalImageUrl, true), preset.editConfig.tldrawSnapshot as unknown as TLEditorSnapshot);
    } else {
      // If no specific edit config, ensure editor is closed or reset
      setTldrawEditorOpen(false);
    }

    // If it's a workflow preset, find and select the workflow first
    if (workflowId) {
      const workflow = workflows.find(w => w.viewComfyJSON.id === workflowId);
      if (workflow) {
        setSelectedWorkflowConfig(workflow, presetName);
        setSelectedModel(MODEL_ID_WORKFLOW);

        // 比例和尺寸处理
        const resSize = effectiveConfig.imageSize || '1K';
        const arName = effectiveConfig.aspectRatio || '1:1';
        const dims = AR_MAP[arName]?.[resSize] || { w: effectiveConfig.width || 1024, h: effectiveConfig.height || 1024 };

        // Apply fixed config from preset
        setConfig(prev => ({
          ...prev,
          prompt: effectiveConfig.prompt || '',
          width: dims.w,
          height: dims.h,
          model: effectiveConfig.model || MODEL_ID_WORKFLOW,
          imageSize: resSize,
          aspectRatio: arName as GenerationConfig['aspectRatio'],
          presetName: presetName,
          isPreset: true
        }));
        // Then apply remaining defaults from workflow (loras, etc)
        applyWorkflowDefaults(workflow);
      }
    } else {
      // Regular preset
      const modelToSet = effectiveConfig.model || 'Nano banana';
      const resSize = effectiveConfig.imageSize || '1K';
      const arName = effectiveConfig.aspectRatio || '1:1';
      const dims = AR_MAP[arName]?.[resSize] || { w: effectiveConfig.width || 1024, h: effectiveConfig.height || 1024 };

      setConfig(prev => ({
        ...prev,
        ...effectiveConfig,
        presetName: presetName,
        loras: effectiveConfig.loras || [],
        model: modelToSet,
        width: dims.w,
        height: dims.h,
        imageSize: resSize,
        aspectRatio: arName as GenerationConfig['aspectRatio'],
        isPreset: true
      }));
      setSelectedWorkflowConfig(undefined, undefined);
      if (modelToSet !== config.model) {
        setSelectedModel(modelToSet);
      }
    }

    setSelectedPresetName(presetName);
    setIsPresetGridOpen(false);
  };
  const handleOptimizePrompt = React.useCallback(async () => {
    const optimizedText = await optimizePrompt(config.prompt, selectedAIModel);
    if (optimizedText) setConfig(prev => ({ ...prev, prompt: optimizedText }));
  }, [config.prompt, optimizePrompt, selectedAIModel, setConfig]);

  const handleDescribe = React.useCallback(async () => {
    if (describeImages.length === 0) {
      toast({ title: "错误", description: "请先上传图片", variant: "destructive" });
      return;
    }

    setIsDescribing(true);
    setHasGenerated(true); // Trigger split layout immediately like generate
    setViewMode('dock');
    setActiveTab('history');
    setShowHistory(true); // Auto-expand history panel

    const startTime = new Date().toISOString();

    // Create a temporary loading card
    const loadingId = `describe-loading-${Date.now()}`;
    const image = describeImages[0];
    const imageUrl = image.path || image.previewUrl;

    const loadingCard: import('@/types/database').Generation = {
      id: loadingId,
      userId: 'anonymous',
      projectId: 'default',
      outputUrl: imageUrl,
      config: {
        prompt: "Analyzing image...",
        width: config.width,
        height: config.height,
        model: config.model,
        loras: config.loras,
        isEdit: false, // 放入 config 中
      },
      status: 'pending',
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

      if (!base64 && imageUrl.startsWith('data:')) {
        base64 = imageUrl.split(',')[1];
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
          outputUrl: imageUrl,
          config: {
            prompt: desc,
            width: config.width || 1024,
            height: config.height || 1024,
            model: "gemini-3-pro-image-preview",
            loras: config.loras,
          },
          status: 'completed',
          createdAt: startTime,
        }));

        // Remove loading card and add real results
        setGenerationHistory((prev: import('@/types/database').Generation[]) => [...newHistoryItems, ...prev.filter(item => item.id !== loadingId)]);

        // Also save each description to backend and sync to gallery
        newHistoryItems.forEach(item => {
          saveHistoryToBackend(item);
          usePlaygroundStore.getState().addGalleryItem(item);
        });

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
  }, [describeImages, setHasGenerated, setViewMode, setActiveTab, setShowHistory, config, setGenerationHistory, callVision, toast]);

  const handleBatchUse = async (results: Generation[]) => {
    if (!results || results.length === 0) return;
    toast({ title: "批量生成中", description: `即将开始 ${results.length} 个生成任务...` });
    for (const result of results) {
      const newConfig = { ...config, prompt: result.config?.prompt || "" };
      await handleGenerate({ configOverride: newConfig });
      await new Promise(r => setTimeout(r, 200));
    }
  };


  const handleRegenerate = async (result: Generation) => {
    // 1. 从原始记录配置中提取参数，显式排除 taskId，确保 rerun 产生新分组
    const originalRecordConfig = { ...(result.config || {}) };
    delete originalRecordConfig.taskId;

    // 2. 从当前状态中提取通用配置，同样显式排除可能存在的陈旧 taskId
    const currentStoreConfig = { ...usePlaygroundStore.getState().config };
    delete currentStoreConfig.taskId;

    // 3. 构建完整的 rerun 配置，以原始记录的参数为准
    const fullConfig: GenerationConfig = {
      ...currentStoreConfig,
      ...originalRecordConfig,
      // 显式确保这些字段保持原始记录的状态
      prompt: originalRecordConfig.prompt || '',
      width: originalRecordConfig.width || 1024,
      height: originalRecordConfig.height || 1024,
      model: originalRecordConfig.model || currentStoreConfig.model,
      baseModel: originalRecordConfig.baseModel || currentStoreConfig.baseModel,
      loras: originalRecordConfig.loras || [],
      isEdit: originalRecordConfig.isEdit || false,
      editConfig: originalRecordConfig.editConfig,
      parentId: originalRecordConfig.parentId,
      // 显式让 taskId 为空，让 handleGenerate 生成一个全新的 ID
      taskId: undefined,
    };

    // 4. 计算应该使用的参考图列表
    const sourceImageUrls = originalRecordConfig.sourceImageUrls ||
      (originalRecordConfig.editConfig?.referenceImages?.map(img => img.dataUrl) || []);
    const localSourceIds = originalRecordConfig.localSourceIds || [];

    // 5. 执行生成
    await handleGenerate({
      configOverride: fullConfig,
      sourceImageUrls,
      localSourceIds
    });
  };

  const handleDownload = (imageUrl: string) => {
    downloadImage(imageUrl, `PlaygroundV2-${Date.now()}.png`);
  };

  const openImageModal = (result: Generation) => {
    setSelectedResult(result);
    setIsImageModalOpen(true);
    // Ensure dock mode is active if we're viewing a specific result
    if (viewMode !== 'dock') {
      setViewMode('dock');
      setActiveTab('history');
    }
  };

  // Image Navigation Logic
  const currentIndex = selectedResult ? filteredHistory.findIndex(h => h.id === selectedResult.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < filteredHistory.length - 1 && currentIndex !== -1;

  const handleNextImage = () => {
    if (hasNext) {
      setSelectedResult(filteredHistory[currentIndex + 1]);
    }
  };

  const handlePrevImage = () => {
    if (hasPrev) {
      setSelectedResult(filteredHistory[currentIndex - 1]);
    }
  };

  const closeImageModal = () => {
    setIsImageModalOpen(false);
    // Don't clear selectedResult here to allow exit animation to use the data
  };

  const handleEditImage = useCallback((historyItem: Generation, isAgain?: boolean) => {
    // 尝试从 config.tldrawSnapshot 获取，或者旧的 editConfig 中获取
    const snapshot = historyItem.config?.tldrawSnapshot || (historyItem.config?.editConfig as unknown as EditPresetConfig)?.tldrawSnapshot;

    // 定位原始底图：
    // 如果是 Edit Again (isAgain === true)，我们希望找回最初进入编辑器的图
    // 1. 优先找 config.sourceImageUrls[0] (handleGenerate 保存的)
    // 2. 其次找 editConfig.originalImageUrl
    // 3. 最后 fallback 到 outputUrl (如果是常规 Edit 或是之前的兼容逻辑)
    let imageUrl = historyItem.outputUrl;

    if (isAgain) {
      const originalUrl = historyItem.config?.sourceImageUrls?.[0] || (historyItem.config?.editConfig as unknown as EditPresetConfig)?.originalImageUrl;
      if (originalUrl) {
        imageUrl = originalUrl;
      }
    }

    setTldrawEditorOpen(true, imageUrl, snapshot as unknown as TLEditorSnapshot);

    // 同时更新 config 状态以便后续生成使用正确的上下文
    updateConfig({
      isEdit: true,
      parentId: historyItem.id,
      prompt: historyItem.config.prompt,
      // 清空 loras 和其他可能干扰的配置
      loras: [],
      isPreset: false,
      presetName: undefined
    });
  }, [setTldrawEditorOpen, updateConfig]);

  const handleEditUploadedImage = useCallback(() => {
    const imageToEdit = usePlaygroundStore.getState().uploadedImages[0];
    const imageUrl = imageToEdit ? (imageToEdit.path || imageToEdit.previewUrl) : "";

    // Pass undefined for snapshot as this is a fresh edit session
    // Even if imageUrl is empty, we allow opening the editor (blank canvas)
    setTldrawEditorOpen(true, imageUrl, undefined);

    updateConfig({
      isEdit: true,
      prompt: config.prompt,
      loras: [],
      isPreset: false,
      presetName: undefined
    });
  }, [setTldrawEditorOpen, updateConfig, config.prompt, toast]);

  const handleSaveEditedImage = useCallback(async (dataUrl: string, prompt?: string, referenceImageUrls?: string[], shouldGenerate?: boolean, snapshot?: TLEditorSnapshot, keepOpen?: boolean, taskId?: string) => {
    // 只有在 keepOpen 为 false 时才关闭编辑器
    if (!keepOpen) {
      setTldrawEditorOpen(false, "", snapshot);
    } else {
      // 即使不关闭编辑器，也尽可能更新 snapshot 状态（虽然 setTldrawEditorOpen 此时不做 UI 关闭）
      // 更新 TldrawEditor store 中的 snapshot？其实 playground 状态只需在下次打开时用
      // 但这里我们是在生成时调用，意味着我们可能希望保存当前的 snapshot 到 history config 中
      // 下面的逻辑会处理 prompt 和 history，但 snapshot 传递给了 generation config
    }

    // 如果需要生成，且不保持开启（通常生成时我们希望根据新需求保持开启，但也可能希望回到列表看结果）
    // 现在的需求是：生成后不要退出。
    // 所以 keepOpen=true 时，不切换视图
    if (shouldGenerate && !keepOpen) {
      setViewMode('dock');
      setActiveTab('history');
    }

    try {
      // 更新 prompt 和 snapshot 到全局配置（虽然 setTldrawEditorOpen 已经更新了 snapshot，但这里可能需要持久化到 config）
      // 注意：snapshot 通常很大，也许不需要每次都存到 localStorage 的 config 中，而是通过 generationHistory 关联
      if (prompt) {
        setConfig(prev => ({ ...prev, prompt }));
      }

      // 需求：退出时保存最新的 snapshot 到历史记录。
      // 如果不生成且有新快照且有 taskId/parentId，说明需要“离场保存”
      if (!shouldGenerate && snapshot && (taskId || config.parentId)) {
        syncHistoryConfig({
          id: config.parentId, // 可能是一个具体的 ID
          taskId: taskId,      // 也可以是整个 session 的 taskId
          config: { tldrawSnapshot: snapshot as unknown as Record<string, unknown> }
        });
      }

      // 上传主图（标注后的图）
      const mainRes = await fetch(dataUrl);
      const mainBlob = await mainRes.blob();
      const mainFile = new File([mainBlob], `annotated-${Date.now()}.png`, { type: 'image/png' });

      // 现有逻辑是：Edit 模式下，UploadedImages 就是参考图列表。
      // 我们应该先清空旧的（如果是重新开始）或者追加？
      // 通常 Save 后是生成，生成使用 UploadedImages。

      // 简化策略：
      // 1. 清空当前 UploadedImages (或者保留？根据需求。通常编辑结果作为新的参考图)
      usePlaygroundStore.getState().setUploadedImages([]);

      // 2. 上传主图
      await handleFilesUpload([mainFile]);

      // 3. 上传其他参考图
      if (referenceImageUrls && referenceImageUrls.length > 0) {
        for (const refUrl of referenceImageUrls) {
          // 如果是 dataUrl 或 blobUrl (本地生成的)，需要转换并上传
          // 如果是 http url (已存在的)，则直接构造 UploadedImage 对象添加到 store
          if (refUrl.startsWith('data:') || refUrl.startsWith('blob:')) {
            const rRes = await fetch(refUrl);
            const rBlob = await rRes.blob();
            const rFile = new File([rBlob], `ref-${Date.now()}.png`, { type: 'image/png' });
            await handleFilesUpload([rFile]);
          } else {
            // 已有 URL，直接添加
            const existingImg: UploadedImage = {
              id: uuidv4(),
              file: new File([], "existing.png"), // Dummy
              base64: "",
              previewUrl: refUrl,
              path: refUrl,
              isUploading: false
            };
            usePlaygroundStore.getState().setUploadedImages(prev => [...prev, existingImg]);
          }
        }
      }

      if (shouldGenerate) {
        // 给一点时间让 state 更新
        setTimeout(() => {
          handleGenerate();
        }, 500);
      }

    } catch (e) {
      console.error("Failed to save edited image", e);
      toast({ title: "保存失败", description: String(e), variant: "destructive" });
    }
  }, [setTldrawEditorOpen, setViewMode, setActiveTab, setConfig, handleGenerate, toast, handleFilesUpload, config.parentId, syncHistoryConfig]);





  // Input UI Helper to avoid duplication
  const inputSectionProps = useMemo(() => ({
    showHistory: viewMode === 'dock', // Map dock mode to showHistory for layout adaptation
    config,
    uploadedImages,
    describeImages,
    isStackHovered,
    isInputFocused,
    isOptimizing,
    isGenerating,
    isDescribing,
    isDescribeMode: activeTab === 'describe', // Map describe tab to isDescribeMode
    isDraggingOver,
    isDraggingOverPanel,
    isPresetGridOpen,
    isAspectRatioLocked,
    isMockMode,
    isSelectorExpanded,
    batchSize,
    selectedModel,
    selectedAIModel,
    selectedLoras,
    selectedPresetName,
    selectedWorkflowConfig,
    workflows,
    fileInputRef,
    describePanelRef,
    setConfig,
    setIsStackHovered,
    setIsInputFocused,
    setPreviewImage,
    removeImage,
    handleFilesUpload,
    handleOptimizePrompt,
    handleGenerate: () => handleGenerate({}),
    handleDescribe,
    setSelectedAIModel,
    setSelectedModel: (model: string) => applyModel(model),
    setIsAspectRatioLocked,
    setSelectedWorkflowConfig,
    applyWorkflowDefaults,
    setMockMode,
    setIsSelectorExpanded,
    setBatchSize,
    setIsLoraDialogOpen,
    setIsPresetGridOpen,
    onClearPreset: () => {
      setSelectedPresetName(undefined);
      setSelectedWorkflowConfig(undefined);
      updateConfig({ presetName: undefined, isPreset: false });
    },
    setIsDescribeMode: (val: boolean) => {
      if (val) {
        setViewMode('dock');
        setActiveTab('describe');
      } else {
        // If attempting to close describe mode, maybe go to history?
        // Or stay in dock mode but change tab?
        // For now, if val is false, switch to history if we were in describe
        if (activeTab === 'describe') setActiveTab('history');
      }
    },
    setDescribeImages,
    setIsDraggingOver,
    setIsDraggingOverPanel,
  }), [
    viewMode, config, uploadedImages, describeImages, isStackHovered, isInputFocused,
    isOptimizing, isGenerating, isDescribing, activeTab, isDraggingOver,
    isDraggingOverPanel, isPresetGridOpen, isAspectRatioLocked, isMockMode,
    isSelectorExpanded, batchSize, selectedModel, selectedAIModel, selectedLoras,
    selectedPresetName, selectedWorkflowConfig, workflows, fileInputRef,
    describePanelRef, setConfig, setIsStackHovered, setIsInputFocused,
    setPreviewImage, removeImage, handleFilesUpload, handleOptimizePrompt,
    handleGenerate, handleDescribe, setSelectedAIModel, setSelectedModel,
    setIsAspectRatioLocked, setSelectedWorkflowConfig, applyWorkflowDefaults,
    setMockMode, setIsSelectorExpanded, setBatchSize, setIsLoraDialogOpen,
    setIsPresetGridOpen, setDescribeImages, setIsDraggingOver,
    setIsDraggingOverPanel, setViewMode, setSelectedPresetName, setActiveTab, applyModel, updateConfig
  ]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="flex-1 relative p-6 pt-16 h-full flex flex-col overflow-hidden"
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(true);
          // 只有在非 Style Tab 下才自动切换到 Describe Tab
          if (activeTab !== 'describe' && activeTab !== 'style') {
            setViewMode('dock');
            setActiveTab('describe');
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
            // 如果退出且没有图片，自动收起 (Optional: Switch back to history?)
            // For persistent dock, we might want to stay in Describe
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

            // 如果是在 Style Tab 下，执行风格上传逻辑
            if (activeTab === 'style') {
              handleStyleUpload(files);
            } else if (activeTab === 'describe' || dropY < windowHeight * 0.4) {
              // 如果是在 Describe 面板区域附近（或当前面板已展开），上传到 Describe
              handleFilesUpload(files, 'describe');
            } else {
              toast({ title: "已添加参考图", description: "图片已上传至当前生成配置中" });
              handleFilesUpload(files, 'reference');
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

            <div className="relative w-full h-full flex flex-col items-center">
              <PlaygroundBackground />

              {/* Dock Sidebar - Persistent in Dock Mode */}
              {viewMode === 'dock' && (
                <div className={cn(
                  "z-[60] transition-all duration-300",
                  isDesktop
                    ? "absolute left-10 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4"
                    : "relative top-4 flex flex-row justify-center gap-8 mb-6 w-full pt-2"
                )}>
                  {/* 抽取统一的样式逻辑 */}
                  {(() => {
                    const getButtonStyle = (isActive: boolean) => cn(
                      "w-10 h-10 rounded-2xl transition-all duration-200",
                      isActive
                        ? "bg-primary/20 text-white border border-white/40 hover:bg-primary/30 hover:border-white/60 hover:scale-105"
                        : "bg-white/5 border border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:scale-110"
                    );

                    const tooltipSide = isDesktop ? "right" : "bottom";

                    return (
                      <>
                        <div className="flex flex-col items-center gap-1">
                          <TooltipButton
                            icon={<Sparkles className="w-5 h-5" />}
                            label="Describe"
                            tooltipContent="Describe image"
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(activeTab === 'describe')}
                            onClick={() => activeTab === 'describe' ? setActiveTab('history') : setActiveTab('describe')}

                          />
                          <span className="text-[10px]">Describe</span>


                        </div>


                        <div className="flex flex-col items-center gap-1">

                          <TooltipButton
                            icon={<Edit2 className="w-5 h-5" />}
                            label="Edit Image"
                            tooltipContent={uploadedImages.length > 0 ? "Edit Image" : "Image Editor"}
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(false)}
                            onClick={handleEditUploadedImage}
                          />
                          <span className="text-[10px]">Edit</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">

                          <TooltipButton
                            icon={<History className="w-5 h-5" />}
                            label="History"
                            tooltipContent="History"
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(activeTab === 'history')}
                            onClick={() => setActiveTab('history')}
                          />
                          <span className="text-[10px]">History</span>

                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <TooltipButton
                            icon={<ImageIcon className="w-5 h-5" />}
                            label="Gallery"
                            tooltipContent="Gallery"
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(activeTab === 'gallery')}
                            onClick={() => setActiveTab('gallery')}
                          />
                          <span className="text-[10px]">Gallery</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <TooltipButton
                            icon={<Palette className="w-5 h-5" />}
                            label="Styles"
                            tooltipContent="Styles"
                            tooltipSide={tooltipSide}
                            className={getButtonStyle(activeTab === 'style')}
                            onClick={() => setActiveTab('style')}
                          />
                          <span className="text-[10px]">Moodboards</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 全局底部渐进模糊 - 仅在预设面板展开且历史记录隐藏时显示 */}
              {/* {isPresetGridOpen && viewMode === 'dock' && (
                <GradualBlur
                  position="bottom"
                  height="8rem"
                  strength={5}
                  animated={true}
                  duration="0.4s"
                  className="pointer-events-none z-30"
                />
              )} */}



              {/* 三栏布局 - Dock Mode 为 true 时启用 */}
              <div className={cn(
                "relative z-20 w-full  h-full",
                viewMode === 'dock'
                  ? "flex justify-center"
                  : "flex flex-col items-center justify-center"
              )}>

                {/* 中间内容区 */}
                <div className={cn(
                  "flex flex-col items-center relative z-30 w-full px-4 md:px-6",
                  (activeTab === 'gallery' || activeTab === 'style')
                    ? "hidden"
                    : viewMode === 'dock'
                      ? "max-w-full sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px] xl:max-w-[1200px] 2xl:max-w-[1200px] mt-10 h-full pt-4 overflow-hidden"
                      : "max-w-full sm:max-w-[540px] md:max-w-[720px] lg:max-w-[800px] xl:max-w-[900px] 2xl:max-w-[1000px]",
                  (viewMode === 'home') && (isPresetGridOpen ? "mt-0" : "-mt-60")
                )}>

                  <div className={cn(
                    "flex flex-col w-full items-center relative z-30",
                    (viewMode === 'dock') && "h-full"
                  )}>


                    {/* Input UI - Always present but layout changes based on viewMode */}
                    {activeTab !== 'gallery' && activeTab !== 'style' && (
                      <div ref={promptWrapperRef} className={cn(
                        "w-full transition-all duration-300",
                        (viewMode === 'dock' && activeTab === 'describe') ? "h-full flex flex-col" : "h-auto"
                      )}>
                        <div className={cn(
                          "w-full transition-all duration-300",
                          (viewMode === 'dock' && activeTab === 'describe') ? "flex-1 min-h-0" : ""
                        )}>
                          <PlaygroundInputSection {...inputSectionProps} />
                        </div>
                      </div>
                    )}

                    {/* Capsule Triggers - Only visible in Home Mode */}
                    {viewMode === 'home' && !isPresetGridOpen && (
                      <div className="flex justify-center mt-4 gap-4">
                        <button
                          onClick={() => { setViewMode('dock'); setActiveTab('describe'); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all bg-black/10",
                            "border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <Sparkles className="w-4 h-4" />
                          <span className="text-sm font-medium">Describe</span>
                        </button>
                        <button
                          onClick={handleEditUploadedImage}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md transition-all bg-black/10 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            Edit
                          </span>
                        </button>
                        <button
                          onClick={() => { setViewMode('dock'); setActiveTab('history'); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md transition-all bg-black/10 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <History className="w-4 h-4" />
                          <span className="text-sm font-medium">History</span>
                        </button>
                        <button
                          onClick={() => { setViewMode('dock'); setActiveTab('gallery'); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all",
                            "bg-black/10 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <ImageIcon className="w-4 h-4" />
                          <span className="text-sm font-medium">Gallery</span>
                        </button>

                        <button
                          onClick={() => { setViewMode('dock'); setActiveTab('style'); }}
                          className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-md transition-all",
                            "bg-black/10 border-white/20 text-white/80 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <Palette className="w-4 h-4" />
                          <span className="text-sm font-medium">Moodboards</span>
                        </button>



                      </div>
                    )}

                    {/* History List - Visible in History Tab */}
                    {viewMode === 'dock' && activeTab === 'history' && (
                      <div className="mt-2  w-full relative flex-1 overflow-hidden z-30">
                        <HistoryList
                          variant="sidebar"
                          history={filteredHistory}
                          onRegenerate={(res) => {
                            if (res.config) {
                              applyModel(res.config.model, {
                                ...res.config,
                                loras: res.config.loras || [],
                                presetName: res.config.presetName,
                              });
                            }
                            handleRegenerate(res);
                          }}
                          onDownload={handleDownload}
                          onEdit={handleEditImage}
                          onImageClick={openImageModal}
                          onBatchUse={handleBatchUse}
                          layoutMode={historyLayoutMode}
                          onLayoutModeChange={(mode) => setHistoryLayoutMode(mode)}
                          onClose={() => setViewMode('home')}
                        />
                      </div>
                    )}

                  </div>
                </div>

                {/* Gallery View - Now a sibling to History List, full width if needed */}
                {viewMode === 'dock' && activeTab === 'gallery' && (
                  <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-20 md:pl-28 lg:pl-28">
                    <div className="h-full w-full  overflow-hidden relative">
                      <Suspense fallback={<div className="flex w-[90%] items-center justify-center h-full text-white">Loading Gallery...</div>}>
                        <GalleryView onSelectItem={(item) => {
                          setSelectedResult(item);
                          setIsImageModalOpen(true);
                        }} />
                      </Suspense>
                    </div>
                  </div>
                )}

                {/* Style View */}
                {viewMode === 'dock' && activeTab === 'style' && (
                  <div className="w-full h-full relative flex overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-4 duration-300 pl-20 md:pl-28 lg:pl-32">
                    <div className="h-full w-full  overflow-hidden relative">
                      <Suspense fallback={<div className="flex  w-[90%] items-center justify-center h-full text-white">Loading Styles...</div>}>
                        <StyleStacksView isDragging={isDraggingOver} />
                      </Suspense>
                    </div>
                  </div>
                )}

              </div>

            </div>

            {!isPresetGridOpen && !isPresetManagerOpen && viewMode === 'home' && (
              <div className="absolute bottom-0 w-full overflow-visible z-50">
                <StylesMarquee />
              </div>
            )}

            <GoogleApiStatus className="fixed bottom-10 right-10 z-[60]" />

            {showAllProjects && <AllProjectsView onClose={() => setShowAllProjects(false)} />}

            <WorkflowSelectorDialog open={isWorkflowDialogOpen} onOpenChange={setIsWorkflowDialogOpen} onSelect={(wf) => setSelectedWorkflowConfig(wf)} onEdit={onEditMapping} />
            <BaseModelSelectorDialog open={isBaseModelDialogOpen} onOpenChange={setIsBaseModelDialogOpen} value={config.model || selectedModel} onConfirm={(m) => updateConfig({ model: m })} />
            <LoraSelectorDialog open={isLoraDialogOpen} onOpenChange={setIsLoraDialogOpen} value={selectedLoras} onConfirm={(list) => setSelectedLoras(list)} />
            <PresetGridOverlay
              open={isPresetGridOpen}
              onOpenChange={setIsPresetGridOpen}
              onOpenManager={() => setIsPresetManagerOpen(true)}
              onSelectPreset={handlePresetSelect}
            />
            <PresetManagerDialog
              open={isPresetManagerOpen}
              onOpenChange={(open) => {
                setIsPresetManagerOpen(open);
                if (!open) {
                  setPendingPresetEditConfig(undefined);
                }
              }}
              workflows={workflows}
              currentConfig={config}
              currentEditConfig={pendingPresetEditConfig}
            />
          </main>
        </div>

        <ImagePreviewModal
          isOpen={isImageModalOpen}
          onClose={closeImageModal}
          result={selectedResult}
          onEdit={handleEditImage}
          onNext={handleNextImage}
          onPrev={handlePrevImage}
          hasNext={hasNext}
          hasPrev={hasPrev}
        />

        {
          isTldrawEditorOpen && (
            <TldrawEditorModal
              isOpen={isTldrawEditorOpen}
              onClose={() => setTldrawEditorOpen(false)}
              imageUrl={tldrawEditingImageUrl}
              onSave={handleSaveEditedImage}
              inputSectionProps={inputSectionProps}
              initialSnapshot={tldrawSnapshot as unknown as TLEditorSnapshot}
              onSaveAsPreset={async (editConfig, name) => {
                if (name) {
                  try {
                    const presetToSave = {
                      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      name: name,
                      coverUrl: editConfig.originalImageUrl,
                      category: 'General',
                      type: 'edit',
                      config: {
                        ...config,
                        model: config.model || 'gemini-3-pro-image-preview',
                        isEdit: true,
                        tldrawSnapshot: editConfig.tldrawSnapshot
                      },
                      editConfig: editConfig,
                      createdAt: new Date().toISOString()
                    } as import('@/types/database').Preset;

                    const addPreset = usePlaygroundStore.getState().addPreset;
                    await addPreset(presetToSave);
                    toast({ title: "存储成功", description: `预设「${name}」已保存` });
                  } catch (err) {
                    console.error('Failed to save preset in playground:', err);
                    toast({
                      title: "保存失败",
                      description: err instanceof Error ? err.message : "未知错误",
                      variant: "destructive"
                    });
                  }
                } else {
                  setPendingPresetEditConfig(editConfig);
                  setIsPresetManagerOpen(true);
                }
              }}
            />
          )
        }

        <SimpleImagePreview
          imageUrl={previewImageUrl}
          layoutId={previewLayoutId}
          onClose={() => setPreviewImage(null)}
        />

        <DragOverlay
          dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}
          modifiers={[snapCenterToCursor]}
        >
          {activeDragItem ? (
            <div
              className="flex items-center w-[200px] gap-3 p-3 bg-black/70 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl pointer-events-none"
            >
              {activeDragItem.outputUrl ? (
                <NextImage
                  src={activeDragItem.outputUrl}
                  alt="dragging"
                  width={40}
                  height={40}
                  className="w-10 h-10 object-cover rounded-lg border border-white/10"
                />
              ) : (
                <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
                  <ImageIcon className="w-4 h-4 text-white/20" />
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-white">
                  Moving {selectedHistoryIds.size} items
                </span>
                <span className="text-[9px] text-white/40 uppercase font-mono tracking-wider">
                  Release to move
                </span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div >
    </DndContext >
  );
});

export default function PlaygroundV2Route() {
  return <PlaygroundV2Page />;
}
